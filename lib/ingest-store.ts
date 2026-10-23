import {env} from "cloudflare:workers";
import {eq,and,count} from "drizzle-orm";
import {getDb} from "../db";
import {accountConnections,ingestKeys,ingestStreams,ingestRecords} from "../db/schema";
import {allSourceInfo} from "./connections";
import {IntakeError,parseIngest,mergeIngestSources} from "./ingest-contract.mjs";
import {z} from "zod";

export async function digest(value:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,"0")).join("");}
async function targets(owner:string){const connections=await getDb().select().from(accountConnections).where(eq(accountConnections.owner,owner));return Object.entries(allSourceInfo(connections)).filter(([,s])=>s.kind!=="notes").map(([sourceKey,s])=>({...s,sourceKey,provider:sourceKey==="google"||sourceKey==="gmail"||sourceKey.endsWith(":google")||sourceKey.endsWith(":gmail")?"google":"microsoft",resourceType:s.kind==="mail"?"email":"calendar"}));}
export async function ingestOverview(owner:string){
 const db=getDb();const keys=await db.select({id:ingestKeys.id,provider:ingestKeys.provider,account:ingestKeys.account,containers:ingestKeys.containers,createdAt:ingestKeys.createdAt,expiresAt:ingestKeys.expiresAt,revoked:ingestKeys.revoked}).from(ingestKeys).where(eq(ingestKeys.owner,owner));
 const streams=await db.select().from(ingestStreams).where(eq(ingestStreams.owner,owner));
 const counts=await db.select({streamId:ingestRecords.streamId,records:count()}).from(ingestRecords).where(and(eq(ingestRecords.owner,owner),eq(ingestRecords.deleted,false))).groupBy(ingestRecords.streamId);
 return {keys:keys.map(k=>({...k,containers:JSON.parse(k.containers)})),streams:streams.map(({generation,owner,...s})=>({...s,records:counts.find(c=>c.streamId===s.id)?.records||0})),accounts:[...new Map((await targets(owner)).map(t=>[`${t.provider}:${t.account}`,{provider:t.provider,account:t.account}])).values()],platformHeader:"OAI-Sites-Authorization",intakeHeader:"Authorization"};
}
export async function issueIngestKey(owner:string,input:unknown){
 const ids=z.array(z.string().trim().min(1).max(512)).max(20);
 const v=z.object({provider:z.enum(["google","microsoft"]),account:z.string().email().transform(v=>v.toLowerCase()),calendarIds:ids,mailboxIds:ids}).strict().parse(input);
 if(!v.calendarIds.length&&!v.mailboxIds.length)throw new Error("Choose at least one calendar or mailbox.");
 const allowed=await targets(owner);
 for(const resource of [v.calendarIds.length?"calendar":null,v.mailboxIds.length?"email":null].filter(Boolean))if(!allowed.some(t=>t.provider===v.provider&&t.account.toLowerCase()===v.account&&t.resourceType===resource))throw new Error("That account/resource is not configured in Connections.");
 const db=getDb(),existing=await db.select().from(ingestKeys).where(eq(ingestKeys.owner,owner));
 if(existing.filter(k=>!k.revoked&&Date.parse(k.expiresAt)>Date.now()).length>=20)throw new Error("Revoke an unused key before creating another.");
 const bytes=crypto.getRandomValues(new Uint8Array(32)),token="ptn_"+[...bytes].map(v=>v.toString(16).padStart(2,"0")).join("");
 const key={id:crypto.randomUUID(),owner,digest:await digest(token),provider:v.provider,account:v.account,containers:JSON.stringify({calendar:[...new Set(v.calendarIds)],email:[...new Set(v.mailboxIds)]}),createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+90*86400000).toISOString()};
 await db.insert(ingestKeys).values(key);return {id:key.id,token,expiresAt:key.expiresAt};
}
export async function revokeIngestKey(owner:string,id:string){z.string().uuid().parse(id);await getDb().update(ingestKeys).set({revoked:true}).where(and(eq(ingestKeys.id,id),eq(ingestKeys.owner,owner)));}
export async function authenticateIngest(request:Request){
 const match=/^Bearer (ptn_[a-f0-9]{64})$/.exec(request.headers.get("authorization")||"");
 if(!match)throw new IntakeError(401,"unauthorized","A valid account-scoped intake credential is required.");
 const [key]=await getDb().select().from(ingestKeys).where(eq(ingestKeys.digest,await digest(match[1])));
 if(!key||key.revoked||Date.parse(key.expiresAt)<=Date.now())throw new IntakeError(401,"unauthorized","A valid account-scoped intake credential is required.");
 return key;
}
export async function acceptIngest(key:typeof ingestKeys.$inferSelect,input:unknown){
 const b=parseIngest(input),containers=JSON.parse(key.containers);
 if(b.provider!==key.provider||b.account!==key.account||!containers[b.resourceType]?.includes(b.scope.containerId))throw new IntakeError(403,"scope_denied","This credential does not permit that account, provider, or container.");
 const target=(await targets(key.owner)).find(t=>t.provider===b.provider&&t.account.toLowerCase()===b.account&&t.resourceType===b.resourceType);
 if(!target)throw new IntakeError(403,"scope_denied","This source is no longer configured in Connections.");
 if(!env.DB)throw new Error("Storage unavailable");
 const db=env.DB.withSession("first-primary"),window=new Date().toISOString().slice(0,16);
 const rate=await db.prepare("UPDATE ingest_keys SET rate_count=CASE WHEN rate_window=? THEN rate_count+1 ELSE 1 END,rate_window=? WHERE id=? AND revoked=0 AND expires_at>? RETURNING rate_count").bind(window,window,key.id,new Date().toISOString()).first<{rate_count:number}>();
 if(!rate)throw new IntakeError(401,"unauthorized","Credential is no longer active.");
 if(rate.rate_count>60)throw new IntakeError(429,"rate_limited","Maximum 60 deliveries per minute per credential. Retry in one minute.");
 const streamId=await digest(JSON.stringify([key.owner,b.provider,b.account,b.resourceType,b.scope.containerId,b.testMode])),hash=await digest(JSON.stringify(b));
 const prior=await db.prepare("SELECT * FROM ingest_receipts WHERE stream_id=? AND batch_id=?").bind(streamId,b.batchId).first<any>();
 if(prior){if(prior.digest!==hash)throw new IntakeError(409,"batch_id_reused","This batchId was already used with different content.");return {ok:true,batchId:b.batchId,status:"duplicate",testMode:b.testMode,receivedAt:prior.received_at};}
 const stream=await db.prepare("SELECT generation,generated_at FROM ingest_streams WHERE id=?").bind(streamId).first<any>();
 if(stream&&b.generatedAt<stream.generated_at)throw new IntakeError(409,"stale_batch","A newer batch already arrived. Reconcile before retrying an older delivery.");
 const count=await db.prepare("SELECT count(*) AS n FROM ingest_records WHERE stream_id=?").bind(streamId).first<{n:number}>();
 const known=await db.prepare("SELECT count(*) AS n FROM json_each(?) AS incoming WHERE EXISTS(SELECT 1 FROM ingest_records WHERE stream_id=? AND record_id=json_extract(incoming.value,'$.id'))").bind(JSON.stringify([...b.records,...b.deleted].map(r=>({id:r.id}))),streamId).first<{n:number}>();
 if((count?.n||0)+b.records.length+b.deleted.length-(known?.n||0)>5000)throw new IntakeError(409,"stream_capacity","Stream capacity reached. Review the reconciliation scope before continuing.");
 const generation=crypto.randomUUID(),receivedAt=new Date().toISOString(),guard="EXISTS(SELECT 1 FROM ingest_streams WHERE id=? AND generation=?)";
 const records=b.records.map(r=>({id:r.id,updatedAt:r.updatedAt,deleted:"cancelled" in r&&r.cancelled?1:0,payload:r}));
 const removed=b.deleted.map(r=>({...r,deleted:1,payload:null}));
 const commands=[
  db.prepare("INSERT INTO ingest_streams(id,owner,provider,account,resource_type,container_id,source_key,lane,test_mode,window_start,window_end) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(streamId,key.owner,b.provider,b.account,b.resourceType,b.scope.containerId,target.sourceKey,target.lane,b.testMode?1:0,b.scope.windowStart,b.scope.windowEnd),
  db.prepare("UPDATE ingest_streams SET source_key=?,lane=?,generation=?,generated_at=?,received_at=?,window_start=?,window_end=?,complete=?,published=CASE WHEN ?=1 THEN 1 ELSE published END WHERE id=? AND generation=? AND generated_at<=? AND EXISTS(SELECT 1 FROM ingest_keys WHERE id=? AND revoked=0 AND expires_at>?)").bind(target.sourceKey,target.lane,generation,b.generatedAt,receivedAt,b.scope.windowStart,b.scope.windowEnd,b.scope.complete?1:0,b.scope.complete?1:0,streamId,stream?.generation||"",b.generatedAt,key.id,receivedAt),
  ...[records,removed].map(rows=>db.prepare(`INSERT INTO ingest_records(owner,stream_id,record_id,updated_at,deleted,payload) SELECT ?,?,json_extract(value,'$.id'),json_extract(value,'$.updatedAt'),json_extract(value,'$.deleted'),json_extract(value,'$.payload') FROM json_each(?) WHERE ${guard} ON CONFLICT(stream_id,record_id) DO UPDATE SET updated_at=excluded.updated_at,deleted=excluded.deleted,payload=excluded.payload WHERE excluded.updated_at>=ingest_records.updated_at`).bind(key.owner,streamId,JSON.stringify(rows),streamId,generation)),
  db.prepare(`INSERT INTO ingest_receipts(stream_id,batch_id,digest,received_at,record_count,deleted_count) SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(streamId,b.batchId,hash,receivedAt,b.records.length,b.deleted.length,streamId,generation)
 ];
 const result=await db.batch(commands);
 if(result[1].meta.changes!==1){const receipt=await db.prepare("SELECT digest FROM ingest_receipts WHERE stream_id=? AND batch_id=?").bind(streamId,b.batchId).first<any>();if(receipt?.digest===hash)return {ok:true,batchId:b.batchId,status:"duplicate",testMode:b.testMode};throw new IntakeError(409,"concurrent_delivery","The source changed during delivery. Retry this exact batch after checking the previous response.");}
 return {ok:true,batchId:b.batchId,status:"accepted",testMode:b.testMode,receivedAt,records:b.records.length,deleted:b.deleted.length};
}
export async function ingestSources(owner:string,legacy:Record<string,any>){
 const db=getDb(),configured=await targets(owner),allStreams=await db.select().from(ingestStreams).where(eq(ingestStreams.owner,owner)),streams=allStreams.filter(s=>configured.some(t=>t.sourceKey===s.sourceKey&&t.account.toLowerCase()===s.account&&t.provider===s.provider));
 if(!streams.some(s=>s.published&&!s.testMode))return legacy;
 const rows=await db.select().from(ingestRecords).where(and(eq(ingestRecords.owner,owner),eq(ingestRecords.deleted,false))).limit(10001);
 const projected=mergeIngestSources(legacy,streams,rows.slice(0,10000));
 const keys=await db.select().from(ingestKeys).where(and(eq(ingestKeys.owner,owner),eq(ingestKeys.revoked,false)));
 for(const stream of streams.filter(s=>s.published&&!s.testMode)){const expected=new Set(keys.filter(k=>k.account===stream.account&&k.provider===stream.provider&&Date.parse(k.expiresAt)>Date.now()).flatMap(k=>JSON.parse(k.containers)[stream.resourceType]||[]));if([...expected].some(id=>!streams.some(s=>s.sourceKey===stream.sourceKey&&s.containerId===id&&s.published&&!s.testMode))){projected[stream.sourceKey].partial=true;projected[stream.sourceKey].notes.push("At least one configured intake container has not completed its first delivery.");}}
 if(rows.length>10000)for(const source of Object.values(projected) as any[])if(source.syncTransport==="n8n"){source.partial=true;source.notes.push("Intake view reached its record limit; review sync scope.");}
 return projected;
}

export async function removeIngestAccount(owner:string,provider:string,account:string){if(!env.DB)throw new Error("Storage unavailable");const db=env.DB,params=[owner,provider,account.toLowerCase()];await db.batch([db.prepare("DELETE FROM ingest_records WHERE stream_id IN(SELECT id FROM ingest_streams WHERE owner=? AND provider=? AND account=?)").bind(...params),db.prepare("DELETE FROM ingest_receipts WHERE stream_id IN(SELECT id FROM ingest_streams WHERE owner=? AND provider=? AND account=?)").bind(...params),db.prepare("DELETE FROM ingest_streams WHERE owner=? AND provider=? AND account=?").bind(...params),db.prepare("UPDATE ingest_keys SET revoked=1 WHERE owner=? AND provider=? AND account=?").bind(...params)]);}
