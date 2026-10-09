import { descendants,validateParent } from "./task-work.mjs";
import { allSourceInfo } from "./connections";
import { getDb } from "../db";
import { commitments, focusBlocks, sourceSnapshots, preferences, accountConnections, workLogs, oauthAccounts, oauthStates, dismissedEmails, workOutputs } from "../db/schema";
import { and, eq, gt, sql, like } from "drizzle-orm";
import { z } from "zod";
export const taskSchema=z.object({id:z.string().uuid(),title:z.string().trim().min(1).max(240),project:z.string().trim().max(100),lane:z.enum(["Unity Homes","AthenaWorx","SHP Beds","Personal"]),stakeholder:z.string().trim().max(240),deadline:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>new Date(v+"T12:00:00Z").toISOString().slice(0,10)===v),minutes:z.number().int().min(0).max(30000),status:z.enum(["open","doing","waiting","done"]),delayImpact:z.enum(["unknown","people","service","financial","safety","opportunity"]).optional(),peopleBlocked:z.boolean().optional(),delayConsequence:z.string().trim().max(1000).optional(),output:z.string().max(2000),parentId:z.string().uuid().nullable().optional(),sourceKey:z.string().max(30000).optional(),sourceUrl:z.string().max(3000).refine(v=>!v||v.startsWith("https://"))});
export const blockSchema=z.object({id:z.string().uuid(),taskId:z.string().uuid(),title:z.string().min(1).max(240),start:z.string().datetime(),end:z.string().datetime()}).refine(b=>Date.parse(b.end)>Date.parse(b.start)&&Date.parse(b.end)-Date.parse(b.start)<=8*3600000,"Work block must last between 1 minute and 8 hours");
export async function readState(owner:string) {
 const db=getDb();const [tasks,blocks,snapshots,prefs,connections,logs,dismissed,outputs]=await Promise.all([db.select().from(commitments).where(eq(commitments.owner,owner)),db.select().from(focusBlocks).where(eq(focusBlocks.owner,owner)),db.select().from(sourceSnapshots).where(eq(sourceSnapshots.owner,owner)),db.select().from(preferences).where(eq(preferences.owner,owner)),db.select().from(accountConnections).where(eq(accountConnections.owner,owner)),db.select().from(workLogs).where(eq(workLogs.owner,owner)),db.select().from(dismissedEmails).where(eq(dismissedEmails.owner,owner)),db.select().from(workOutputs).where(eq(workOutputs.owner,owner))]);
 return {workOutputs:outputs.map(({owner,...o})=>o),dismissedEmails:dismissed.map(d=>d.emailId),workLogs:logs.map(({owner,...l})=>({...l,skills:JSON.parse(l.skills)})),connections:connections.map(({owner,...c})=>c),tasks:tasks.map(({owner,...t})=>t),blocks:blocks.map(({owner,...b})=>b),sources:Object.fromEntries(snapshots.map(s=>[s.source,{...JSON.parse(s.payload),updatedAt:s.updatedAt}])),preferences:prefs[0]?{startHour:prefs[0].startHour,endHour:prefs[0].endHour,theme:prefs[0].theme,focusTaskId:tasks.some(t=>t.id===prefs[0].focusTaskId&&t.status!=="done"&&t.status!=="waiting"&&t.minutes>0)?prefs[0].focusTaskId:null}:{startHour:9,endHour:17,theme:"dark" as const,focusTaskId:null}};
}
export async function saveTask(owner:string,input:unknown) {
 const t=taskSchema.parse(input),db=getDb();const existing=await db.select().from(commitments).where(eq(commitments.id,t.id));if(existing.length&&existing[0].owner!==owner)throw new Error("Task not available");
 const owned=await db.select().from(commitments).where(eq(commitments.owner,owner));
 const parentId=t.parentId===undefined?existing[0]?.parentId||null:t.parentId;
 validateParent(owned,{...t,parentId});
 const childIds=descendants(owned,t.id);
 if(t.status==="done"&&owned.some(c=>childIds.has(c.id)&&c.status!=="done"))throw new Error("Complete the subtasks before completing this parent.");
 const priority={delayImpact:t.delayImpact??existing[0]?.delayImpact??"unknown",peopleBlocked:t.peopleBlocked??existing[0]?.peopleBlocked??false,delayConsequence:t.delayConsequence??existing[0]?.delayConsequence??""};
 const values={...t,...priority,parentId,sourceKey:existing[0]?.sourceKey||t.sourceKey||"",owner,createdAt:existing[0]?.createdAt||new Date().toISOString()};
 await db.insert(commitments).values(values).onConflictDoUpdate({target:commitments.id,set:{...t,...priority,parentId,sourceKey:values.sourceKey}});if(t.status==="done")await db.delete(focusBlocks).where(and(eq(focusBlocks.owner,owner),eq(focusBlocks.taskId,t.id),gt(focusBlocks.end,new Date().toISOString())));if(t.status==="done"||t.status==="waiting"||t.minutes===0)await db.update(preferences).set({focusTaskId:null}).where(and(eq(preferences.owner,owner),eq(preferences.focusTaskId,t.id)));return {...t,...priority,parentId,sourceKey:values.sourceKey};
}
export async function saveBlock(owner:string,input:unknown) {
 const b=blockSchema.parse(input),db=getDb();const task=await db.select().from(commitments).where(and(eq(commitments.id,b.taskId),eq(commitments.owner,owner)));if(!task.length||task[0].status==="done")throw new Error("Choose an active task");
 const existing=await db.select().from(focusBlocks).where(eq(focusBlocks.id,b.id));if(existing.length){if(existing[0].owner!==owner)throw new Error("Block not available");return existing[0];}
 const overlap=await db.select().from(focusBlocks).where(eq(focusBlocks.owner,owner));if(overlap.some(x=>x.start<b.end&&x.end>b.start))throw new Error("This overlaps another protected block. Refresh and choose a different time.");
 const snapshots=await db.select().from(sourceSnapshots).where(eq(sourceSnapshots.owner,owner));
 const configured=allSourceInfo(await db.select().from(accountConnections).where(eq(accountConnections.owner,owner)));
 const events=snapshots.filter(s=>configured[s.source]?.kind==="calendar").flatMap(s=>JSON.parse(s.payload).events||[]);
 if(events.some(e=>e.busy&&Date.parse(e.start)-900000<Date.parse(b.end)&&Date.parse(e.end)+900000>Date.parse(b.start)))throw new Error("This overlaps a calendar event or its buffer. Refresh and choose a different time.");
 if(Date.parse(b.start)<Date.now())throw new Error("Choose a future work block");
 await db.run(sql`INSERT INTO focus_blocks (id,owner,task_id,title,start,end) SELECT ${b.id},${owner},${b.taskId},${b.title},${b.start},${b.end} WHERE NOT EXISTS (SELECT 1 FROM focus_blocks WHERE owner=${owner} AND start<${b.end} AND end>${b.start}) AND EXISTS (SELECT 1 FROM commitments WHERE id=${b.taskId} AND owner=${owner} AND status!='done')`);
 const saved=await db.select().from(focusBlocks).where(and(eq(focusBlocks.id,b.id),eq(focusBlocks.owner,owner)));if(!saved.length)throw new Error("Task or protected time changed. Refresh before reserving.");return b;
}
export async function removeBlock(owner:string,id:string) {await getDb().delete(focusBlocks).where(and(eq(focusBlocks.id,id),eq(focusBlocks.owner,owner)));}
export async function saveSnapshot(owner:string,source:string,payload:unknown) {const updatedAt=new Date().toISOString();await getDb().insert(sourceSnapshots).values({owner,source,payload:JSON.stringify(payload),updatedAt}).onConflictDoUpdate({target:[sourceSnapshots.owner,sourceSnapshots.source],set:{payload:JSON.stringify(payload),updatedAt}});return updatedAt;}
export async function savePreferences(owner:string,input:unknown){const p=z.object({startHour:z.number().int().min(0).max(22),endHour:z.number().int().min(1).max(23),theme:z.enum(["dark","light","system"]).optional(),focusTaskId:z.string().uuid().nullable().optional()}).refine(p=>p.endHour>p.startHour).parse(input);if(p.focusTaskId){const [task]=await getDb().select().from(commitments).where(and(eq(commitments.id,p.focusTaskId),eq(commitments.owner,owner)));if(!task||task.status==="done"||task.status==="waiting"||task.minutes===0)throw new Error("Choose an actionable commitment with remaining work.");}await getDb().insert(preferences).values({owner,...p}).onConflictDoUpdate({target:preferences.owner,set:p});return p;}
export const connectionSchema=z.object({id:z.string().uuid(),provider:z.enum(["google","microsoft","notion","apple"]),account:z.string().trim().min(1).max(240),lane:z.enum(["Unity Homes","AthenaWorx","SHP Beds","Personal"]),calendar:z.boolean(),mail:z.boolean()}).superRefine((c,ctx)=>{
 if(c.provider!=="notion"&&!z.string().email().safeParse(c.account).success)ctx.addIssue({code:"custom",message:"Enter a valid account email address",path:["account"]});
 if(["google","microsoft"].includes(c.provider)&&!c.calendar&&!c.mail)ctx.addIssue({code:"custom",message:"Select calendar, email, or both"});
});
export async function saveConnection(owner:string,input:unknown){
 const c=connectionSchema.parse(input),db=getDb();c.account=c.provider==="notion"?c.account:c.account.toLowerCase();
 const existing=await db.select().from(accountConnections).where(eq(accountConnections.id,c.id));if(existing.length&&existing[0].owner!==owner)throw new Error("Connection not available");
 const accounts=await db.select().from(accountConnections).where(eq(accountConnections.owner,owner));
 if(!existing.length&&accounts.length>=20)throw new Error("You can save up to 20 additional connections");
 if(accounts.some(a=>a.id!==c.id&&a.provider===c.provider&&a.account.toLowerCase()===c.account.toLowerCase()))throw new Error("This account is already in your connection list");
 if((c.provider==="google"&&c.account==="rob.k.brown.7@gmail.com")||(c.provider==="microsoft"&&c.account==="rbrown@unityhomes.org"))throw new Error("This account is already a built-in source. Use Manage access on its source card.");
 if(existing.length&&(existing[0].account!==c.account||existing[0].provider!==c.provider))throw new Error("Save a new connection to change the account or provider");
 const values={...c,owner,createdAt:existing[0]?.createdAt||new Date().toISOString()};await db.insert(accountConnections).values(values).onConflictDoUpdate({target:accountConnections.id,set:{lane:c.lane,calendar:c.calendar,mail:c.mail}});
 return c;
}
export async function removeConnection(owner:string,id:string){z.string().uuid().parse(id);const db=getDb();const [connection]=await db.select().from(accountConnections).where(and(eq(accountConnections.id,id),eq(accountConnections.owner,owner)));if(connection)await db.delete(oauthStates).where(and(eq(oauthStates.owner,owner),eq(oauthStates.provider,connection.provider),eq(oauthStates.account,connection.account.toLowerCase())));if(connection)await db.delete(oauthAccounts).where(and(eq(oauthAccounts.owner,owner),eq(oauthAccounts.provider,connection.provider),eq(oauthAccounts.account,connection.account.toLowerCase())));await db.delete(accountConnections).where(and(eq(accountConnections.id,id),eq(accountConnections.owner,owner)));await db.delete(sourceSnapshots).where(and(eq(sourceSnapshots.owner,owner),like(sourceSnapshots.source,`account:${id}:%`)));}

export const workLogSchema=z.object({id:z.string().uuid(),taskId:z.string().uuid(),workedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+"T12:00:00Z");return !isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v;}),minutes:z.number().int().min(1).max(1440),aiMinutes:z.number().int().min(0).max(1440),skills:z.array(z.string().trim().min(1).max(100)).max(30),notes:z.string().trim().max(20000)}).refine(l=>l.aiMinutes<=l.minutes,"AI-assisted minutes must be included within elapsed minutes.");
export async function saveWorkLog(owner:string,input:unknown){const l=workLogSchema.parse(input),db=getDb();const task=await db.select().from(commitments).where(and(eq(commitments.id,l.taskId),eq(commitments.owner,owner)));if(!task.length)throw new Error("Task not available");
 const existing=await db.select().from(workLogs).where(eq(workLogs.id,l.id));if(existing.length){if(existing[0].owner!==owner||existing[0].taskId!==l.taskId)throw new Error("Work log not available");return {...existing[0],skills:JSON.parse(existing[0].skills)};}
 await db.insert(workLogs).values({...l,owner,skills:JSON.stringify([...new Set(l.skills)]),createdAt:new Date().toISOString()}).onConflictDoNothing();return l;}
export async function removeWorkLog(owner:string,id:string){z.string().uuid().parse(id);await getDb().delete(workLogs).where(and(eq(workLogs.id,id),eq(workLogs.owner,owner)));}

export async function dismissEmail(owner:string,input:unknown){
 const id=z.string().trim().min(1).max(2000).parse(input),db=getDb();
 const snapshots=await db.select().from(sourceSnapshots).where(eq(sourceSnapshots.owner,owner));
 const configured=allSourceInfo(await db.select().from(accountConnections).where(eq(accountConnections.owner,owner)));
 if(!snapshots.some(s=>configured[s.source]?.kind==="mail"&&(JSON.parse(s.payload).emails||[]).some((e:any)=>e.id===id)))throw new Error("Email is no longer available in your review list. Refresh and try again.");
 await db.insert(dismissedEmails).values({owner,emailId:id,dismissedAt:new Date().toISOString()}).onConflictDoNothing();return {id};
}
export async function restoreEmail(owner:string,input:unknown){const id=z.string().trim().min(1).max(2000).parse(input);await getDb().delete(dismissedEmails).where(and(eq(dismissedEmails.owner,owner),eq(dismissedEmails.emailId,id)));return {id};}

export const workOutputSchema=z.object({id:z.string().uuid(),taskId:z.string().uuid(),workedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+"T12:00:00Z");return !isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v;}),notes:z.string().trim().min(1).max(20000)});
export async function saveWorkOutput(owner:string,input:unknown){
 const entry=workOutputSchema.parse(input),db=getDb();const [task]=await db.select().from(commitments).where(and(eq(commitments.id,entry.taskId),eq(commitments.owner,owner)));if(!task)throw new Error("Task not available");
 const [existing]=await db.select().from(workOutputs).where(eq(workOutputs.id,entry.id));if(existing&&(existing.owner!==owner||existing.taskId!==entry.taskId))throw new Error("Work output not available");
 const now=new Date().toISOString();await db.insert(workOutputs).values({...entry,owner,createdAt:existing?.createdAt||now,updatedAt:now}).onConflictDoUpdate({target:workOutputs.id,set:{workedOn:entry.workedOn,notes:entry.notes,updatedAt:now},setWhere:and(eq(workOutputs.owner,owner),eq(workOutputs.taskId,entry.taskId))});return entry;
}
export async function removeWorkOutput(owner:string,id:string){z.string().uuid().parse(id);await getDb().delete(workOutputs).where(and(eq(workOutputs.id,id),eq(workOutputs.owner,owner)));}
