import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getDb} from '../db';
import {eq,and,desc} from 'drizzle-orm';
import {focusCalendars,focusCommands,accountConnections} from '../db/schema';
import {readState} from './repository';
import {digest} from './ingest-store';
import {eventId,validateReadback,windowSchema,FOCUS_SCHEMA} from './focus-contract.mjs';
import {allSourceInfo} from './connections';
const uuid=z.string().uuid();
const now=()=>new Date().toISOString();
function sqlDb(){if(!env.DB)throw new Error('Storage unavailable');return env.DB.withSession('first-primary');}
export async function focusOverview(owner:string){
 const db=getDb(),[config]=await db.select().from(focusCalendars).where(eq(focusCalendars.owner,owner));
 const commands=await db.select().from(focusCommands).where(eq(focusCommands.owner,owner)).orderBy(desc(focusCommands.createdAt)).limit(100);
 const accounts=await db.select().from(accountConnections).where(and(eq(accountConnections.owner,owner),eq(accountConnections.provider,'google'),eq(accountConnections.calendar,true)));
 return {config:config?{id:config.id,account:config.account,calendarId:config.calendarId,enabled:config.enabled,keyActive:!!config.keyDigest&&Date.parse(config.keyExpiresAt||'')>Date.now(),keyExpiresAt:config.keyExpiresAt}:null,
 accounts:[...new Set(['rob.k.brown.7@gmail.com',...accounts.map(a=>a.account)])],commands:commands.map(({owner,claimToken,...j})=>({...j,receipt:j.receipt?JSON.parse(j.receipt):null}))};
}
export async function configureFocus(owner:string,input:unknown){
 const v=z.object({account:z.string().email().toLowerCase(),calendarId:z.string().trim().min(5).max(512)}).strict().parse(input);
 if(!v.calendarId.endsWith('@group.calendar.google.com'))throw new Error('Use the dedicated secondary Partheanon Focus calendar ID ending in @group.calendar.google.com.');
 const overview=await focusOverview(owner);if(!overview.accounts.includes(v.account))throw new Error('Choose a configured Google calendar account.');
 if(overview.config){if(overview.config.account===v.account&&overview.config.calendarId===v.calendarId)return overview.config;throw new Error('The pilot is pinned to one calendar. Changing its destination requires a separate reviewed migration.');}
 await getDb().insert(focusCalendars).values({owner,id:crypto.randomUUID(),...v,createdAt:now()}).onConflictDoNothing();return (await focusOverview(owner)).config;
}
export async function issueFocusKey(owner:string){
 const db=sqlDb(),config=await db.prepare('SELECT * FROM focus_calendars WHERE owner=?').bind(owner).first<any>();if(!config)throw new Error('Save the dedicated calendar first.');
 const token='ptf_'+[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join(''),expiresAt=new Date(Date.now()+7*86400000).toISOString();
 await db.prepare('UPDATE focus_calendars SET key_digest=?,key_expires_at=? WHERE owner=?').bind(await digest(token),expiresAt,owner).run();return {token,expiresAt};
}
export async function setFocusEnabled(owner:string,enabled:boolean){await getDb().update(focusCalendars).set({enabled}).where(eq(focusCalendars.owner,owner));return {enabled};}
export async function revokeFocusKey(owner:string){await getDb().update(focusCalendars).set({keyDigest:null,keyExpiresAt:null,enabled:false}).where(eq(focusCalendars.owner,owner));return {revoked:true};}
export async function approveFocus(owner:string,input:unknown){
 const v=z.object({blockId:uuid,start:z.string(),end:z.string(),acknowledgeProvisional:z.literal(true)}).strict().parse(input),times=windowSchema.parse(v);
 if(Date.parse(times.start)<Date.now()+60000||Date.parse(times.end)>Date.now()+61*86400000)throw new Error('Choose future time within the next 60 days.');
 const db=sqlDb(),config=await db.prepare('SELECT * FROM focus_calendars WHERE owner=? AND enabled=1 AND key_digest IS NOT NULL AND key_expires_at>?').bind(owner,now()).first<any>();if(!config)throw new Error('Configure and enable the pilot with a current worker key first.');
 const state=await readState(owner),block=state.blocks.find(b=>b.id===v.blockId),task=state.tasks.find(t=>t.id===block?.taskId);
 if(!block||!task||task.status==='done'||task.status==='waiting'||task.dependsOn.some((id:string)=>!state.tasks.some(t=>t.id===id&&t.status==='done')))throw new Error('Choose an active protected block with completed prerequisites.');
 const prior=await db.prepare("SELECT * FROM focus_commands WHERE owner=? AND block_id=? AND state='confirmed' ORDER BY created_at DESC LIMIT 1").bind(owner,block.id).first<any>();
 const info=allSourceInfo(state.connections),sources=Object.entries(state.sources).filter(([key])=>info[key]?.kind==='calendar');
 const identity=`google|${config.account}|calendar|${config.calendar_id}|${eventId(block.id)}`;
 const busy=sources.flatMap(([,s]:any)=>(s.events||[])).filter((e:any)=>e.busy&&e.recordKey!==identity);
 if(busy.some((e:any)=>Date.parse(e.start)-900000<Date.parse(times.end)&&Date.parse(e.end)+900000>Date.parse(times.start))||state.blocks.some(b=>b.id!==block.id&&b.start<times.end&&b.end>times.start))throw new Error('The proposed time overlaps a cached calendar event, buffer, or protected block.');
 if(prior&&prior.start===times.start&&prior.end===times.end)return {id:prior.id,state:prior.state};
 const id=crypto.randomUUID(),operation=prior?'reschedule':'create';
 const result=await db.prepare(`INSERT INTO focus_commands(id,owner,calendar_config_id,block_id,task_id,event_id,operation,title,start,end,baseline_start,baseline_end,expected_etag,state,attempts,error,created_at)
 SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,'queued',0,'',? WHERE NOT EXISTS(SELECT 1 FROM focus_commands WHERE owner=? AND block_id=? AND state IN ('queued','sending','attention')) AND (SELECT count(*) FROM focus_commands WHERE owner=?)<500`).bind(id,owner,config.id,block.id,task.id,eventId(block.id),operation,'Focus time',times.start,times.end,block.start,block.end,prior?JSON.parse(prior.receipt).etag:null,now(),owner,block.id,owner).run();
 if(!result.meta.changes)throw new Error('This block already has an unresolved request, or the pilot has reached its 500-request limit. Review it first.');return {id,state:'queued'};
}
export async function authenticateFocusWorker(r:Request){
 const m=/^Bearer (ptf_[a-f0-9]{64})$/.exec(r.headers.get('authorization')||'');if(!m)throw new Error('Worker authorization required');
 const db=sqlDb(),config=await db.prepare('SELECT * FROM focus_calendars WHERE key_digest=? AND key_expires_at>?').bind(await digest(m[1]),now()).first<any>();if(!config)throw new Error('Worker authorization required');return config;
}
function wireJob(j:any,c:any){return {schemaVersion:FOCUS_SCHEMA,id:j.id,blockId:j.block_id,taskId:j.task_id,eventId:j.event_id,operation:j.operation,title:j.title,start:j.start,end:j.end,expectedEtag:j.expected_etag,account:c.account,calendarId:c.calendar_id,claimToken:j.claim_token,sendUpdates:'none',attendees:[]};}
export async function claimFocus(config:any){
 if(!config.enabled)throw new Error('Pilot is paused');const db=sqlDb(),instant=Date.now();
 await db.prepare("UPDATE focus_commands SET state='attention',error='Recovery attempt limit reached. Review and reconcile the same request.' WHERE owner=? AND calendar_config_id=? AND state='sending' AND attempts>=5 AND EXISTS(SELECT 1 FROM focus_calendars WHERE owner=? AND lease_until<?)").bind(config.owner,config.id,config.owner,instant).run();
 const job=await db.prepare("SELECT * FROM focus_commands WHERE owner=? AND calendar_config_id=? AND state IN ('queued','sending') AND attempts<5 ORDER BY CASE WHEN state='sending' THEN 0 ELSE 1 END,created_at LIMIT 1").bind(config.owner,config.id).first<any>();if(!job)return {job:null};
 const claimToken=crypto.randomUUID(),until=instant+300000;
 const results=await db.batch([
 db.prepare('UPDATE focus_calendars SET lease_command=?,lease_until=?,lease_token=? WHERE owner=? AND id=? AND enabled=1 AND key_digest=? AND lease_until<?').bind(job.id,until,claimToken,config.owner,config.id,config.key_digest,instant),
 db.prepare("UPDATE focus_commands SET state='sending',claim_token=?,attempts=attempts+1 WHERE id=? AND state IN ('queued','sending') AND EXISTS(SELECT 1 FROM focus_calendars WHERE owner=? AND lease_command=? AND lease_until=? AND lease_token=?)").bind(claimToken,job.id,config.owner,job.id,until,claimToken)
 ]);
 if(!results[0].meta.changes||!results[1].meta.changes)return {job:null};
 return {job:wireJob({...job,claim_token:claimToken},config)};
}
export async function workerStatus(config:any,input:unknown){
 const v=z.object({id:uuid,claimToken:uuid}).strict().parse(input),db=sqlDb();
 const job=await db.prepare('SELECT * FROM focus_commands WHERE id=? AND owner=? AND calendar_config_id=?').bind(v.id,config.owner,config.id).first<any>();
 if(!job)throw new Error('Request not available');
 return {id:job.id,state:job.state,receipt:job.receipt?JSON.parse(job.receipt):null,mayWrite:!!config.enabled&&job.state==='sending'&&job.claim_token===v.claimToken&&config.lease_command===job.id&&config.lease_until>Date.now()&&Date.parse(job.start)>Date.now()+60000};
}
export async function finishFocus(config:any,input:unknown){
 const v=z.object({id:uuid,claimToken:uuid,event:z.unknown()}).strict().parse(input),db=sqlDb();
 const job=await db.prepare('SELECT * FROM focus_commands WHERE id=? AND owner=? AND calendar_config_id=?').bind(v.id,config.owner,config.id).first<any>();if(!job)throw new Error('Request not available');
 const receipt=validateReadback(wireJob(job,config),v.event);
 if(job.state==='confirmed'){if(JSON.stringify(JSON.parse(job.receipt))!==JSON.stringify(receipt))throw new Error('Conflicting receipt');return {id:job.id,state:'confirmed',duplicate:true};}
 if(job.claim_token!==v.claimToken||job.state!=='sending')throw new Error('A newer attempt owns this request. Look up its receipt.');
 const receivedAt=now();
 await db.batch([
 db.prepare("UPDATE focus_commands SET state='confirmed',receipt=?,confirmed_at=?,error='' WHERE id=? AND claim_token=? AND state='sending'").bind(JSON.stringify(receipt),receivedAt,job.id,v.claimToken),
 db.prepare("UPDATE focus_blocks SET start=?,end=? WHERE id=? AND owner=? AND start=? AND end=? AND EXISTS(SELECT 1 FROM focus_commands WHERE id=? AND state='confirmed' AND confirmed_at=?)").bind(job.start,job.end,job.block_id,config.owner,job.baseline_start,job.baseline_end,job.id,receivedAt),
 db.prepare('UPDATE focus_calendars SET lease_command=NULL,lease_until=0 WHERE owner=? AND lease_command=?').bind(config.owner,job.id)
 ]);
 return {id:job.id,state:'confirmed',duplicate:false};
}
export async function failFocus(config:any,input:unknown){
 const v=z.object({id:uuid,claimToken:uuid}).strict().parse(input),db=sqlDb();
 await db.batch([
 db.prepare("UPDATE focus_commands SET state='attention',error='The worker could not verify provider completion. Keep the same request and reconcile before any further write.' WHERE id=? AND owner=? AND claim_token=? AND state='sending'").bind(v.id,config.owner,v.claimToken),
 db.prepare('UPDATE focus_calendars SET lease_command=NULL,lease_until=0 WHERE owner=? AND lease_command=? AND EXISTS(SELECT 1 FROM focus_commands WHERE id=? AND claim_token=? AND state=\'attention\')').bind(config.owner,v.id,v.id,v.claimToken)
 ]);return {id:v.id,state:'attention'};
}
export async function retryFocus(owner:string,id:string){
 uuid.parse(id);await sqlDb().prepare("UPDATE focus_commands SET state='queued',error='',attempts=0 WHERE id=? AND owner=? AND state='attention'").bind(id,owner).run();return {id};
}
