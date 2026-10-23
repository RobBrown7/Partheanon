import {z} from 'zod';
// The saved n8n worker contract. Unknown removal/initial shapes fail closed until
// the sender supplies their exact, bounded reconciliation semantics.
const id=z.string().min(1).max(512);
const stamp=z.string().datetime({offset:true});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
const account=z.string().email().max(240);
const point=z.object({dateTime:stamp.nullable(),date:date.nullable(),timeZone:z.string().min(1).max(100)}).strict();
const identity={recordKey:id,provider:z.literal('google'),account,containerType:z.enum(['mailbox','calendar']),containerId:id,sourceId:id};
const mail=z.object({...identity,messageId:id,threadId:id,senderAddress:z.string().max(320),subject:z.string().max(120),receivedAt:stamp,read:z.boolean(),inScopeLabel:id,sourceVersion:id,sourceUpdatedAt:id}).strict();
const event=z.object({...identity,iCalUID:id,title:z.string().max(200),start:point,end:point,allDay:z.boolean(),busyFree:z.enum(['busy','free']),status:z.enum(['confirmed','tentative','cancelled']),cancelled:z.boolean(),eventType:z.string().max(100),visibility:z.string().max(100),recurringEventId:id.nullable(),originalStartTime:point.nullable(),isRecurringInstance:z.boolean(),sourceUpdatedAt:stamp.nullable()}).strict();
const coverage=z.object({complete:z.boolean(),authoritative:z.boolean(),pagesFetched:z.number().int().min(0).max(100000),recordCount:z.number().int().min(0),deletionCount:z.number().int().min(0),scopeExitCount:z.number().int().min(0),reconciliationRule:z.string().max(1000)}).strict();
const base={schemaVersion:z.literal('partheanon.sync.v1'),batchId:z.string().regex(/^gsync_[a-f0-9]{40}$/),provider:z.literal('google'),account,syncMode:z.enum(['incremental','initial','reconcile']),container:z.object({type:z.enum(['mailbox','calendar']),id}).strict(),deletions:z.array(z.unknown()).max(200),scopeExits:z.array(z.unknown()).max(200),coverage,generatedAt:stamp,producer:z.object({name:z.string().min(1).max(120),version:z.string().min(1).max(40)}).strict()};
const worker=z.discriminatedUnion('resourceType',[
 z.object({...base,resourceType:z.literal('email_message'),scope:z.object({emailScope:z.literal('inbox'),labelId:z.literal('INBOX'),receivedAfter:stamp,alignment:z.literal('utc_day')}).strict(),records:z.array(mail).max(200)}).strict(),
 z.object({...base,resourceType:z.literal('calendar_event'),scope:z.object({window:z.object({start:stamp,end:stamp,alignment:z.literal('utc_day')}).strict()}).strict(),records:z.array(event).max(200)}).strict()
]);
export function canonicalJson(value){
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function ingestFingerprintInput(value){
 if(value?.schemaVersion!=='partheanon.sync.v1')return canonicalJson(value);
 const {generatedAt,...stable}=value;return canonicalJson(stable);
}
// Preserve the original history ID in the payload; this is only its comparison
// key. Comparing arbitrary precision decimal strings never passes through Number.
export function gmailVersionKey(value){
 if(!/^\d+$/.test(value))throw new Error('Gmail history IDs require decimal-string ordering; an unrecognized version cannot be applied safely.');
 const digits=value.replace(/^0+(?=\d)/,'');return `gmail:${String(digits.length).padStart(4,'0')}:${digits}`;
}
function asIso(value){return new Date(value).toISOString();}
function utcDay(value){return asIso(value).endsWith('T00:00:00.000Z');}
// Resolve date-only all-day boundaries in the named zone, never the worker's
// local timezone. Iterate across offset/DST changes, then verify the result.
export function eventPoint(value,allDay){
 if(allDay){
  if(value.dateTime!==null||value.date===null)throw new Error('All-day events require a date and no dateTime.');
  const target=Date.parse(value.date+'T00:00:00Z');
  const format=new Intl.DateTimeFormat('en-CA',{timeZone:value.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let time=target;
  for(let i=0;i<4;i++){
   const p=Object.fromEntries(format.formatToParts(time).map(p=>[p.type,p.value]));
   const observed=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
   if(observed===target)return new Date(time).toISOString();
   time+=target-observed;
  }
  throw new Error('All-day boundary cannot be resolved in its time zone.');
 }
 if(value.dateTime===null||value.date!==null)throw new Error('Timed events require dateTime and no date.');
 new Intl.DateTimeFormat('en',{timeZone:value.timeZone});return asIso(value.dateTime);
}
export function parseWorkerIngest(value,IntakeError,now){
 const parsed=worker.safeParse(value);
 if(!parsed.success)throw new IntakeError(422,'invalid_payload','Payload does not match the saved partheanon.sync.v1 worker contract. No records were changed.');
 const b=parsed.data,email=b.resourceType==='email_message';
 const fail=(code,message)=>{throw new IntakeError(422,code,message);};
 if(b.coverage.recordCount!==b.records.length||b.coverage.deletionCount!==b.deletions.length||b.coverage.scopeExitCount!==b.scopeExits.length)fail('coverage_counts','Coverage counts must match this envelope.');
 if(b.syncMode!=='incremental'||b.coverage.authoritative)fail('reconciliation_not_verified','Initial/reconcile and authoritative envelopes are not enabled until the sender’s bounded reconciliation contract has been verified. Keep delivery at the mock.');
 if(b.deletions.length||b.scopeExits.length)fail('removal_contract_not_verified','Removal entries are not enabled until the sender’s deletion and scope-exit shapes have been verified. No removals or upserts were applied.');
 const generatedAt=asIso(b.generatedAt);
 if(Date.parse(generatedAt)>now+300000)fail('future_timestamp','generatedAt is more than five minutes in the future.');
 if(b.container.type!==(email?'mailbox':'calendar'))fail('identity_mismatch','Container type does not match the resource.');
 const start=email?b.scope.receivedAfter:b.scope.window.start,end=email?null:b.scope.window.end;
 if(!utcDay(start)||end&&!utcDay(end))fail('invalid_scope','utc_day scope boundaries must be midnight UTC.');
 if(end&&Date.parse(end)<=Date.parse(start))fail('invalid_scope','Calendar window end must follow start.');
 const seen=new Set();
 const records=b.records.map(r=>{
  const expected=[b.provider,b.account,b.container.type,b.container.id,r.sourceId].join('|');
  if(r.provider!==b.provider||r.account!==b.account||r.containerType!==b.container.type||r.containerId!==b.container.id||r.recordKey!==expected)fail('identity_mismatch','Record identity must match its envelope and canonical recordKey.');
  if(seen.has(r.sourceId))fail('duplicate_record','A source ID may appear only once in a batch.');seen.add(r.sourceId);
  if(email){
   if(r.sourceId!==r.messageId||r.sourceUpdatedAt!==r.sourceVersion||r.inScopeLabel!==b.scope.labelId)fail('identity_mismatch','Gmail IDs, history version or scope label do not match.');
   let version;try{version=gmailVersionKey(r.sourceVersion);}catch(e){fail('unsupported_source_version',e.message);}
   if(Date.parse(r.receivedAt)<Date.parse(start))fail('outside_scope','Email receivedAt is before the approved scope.');
   return {id:r.sourceId,updatedAt:version,threadId:r.threadId,subject:r.subject,sender:r.senderAddress,receivedAt:asIso(r.receivedAt),snippet:'',unread:!r.read,starred:false,labels:[r.inScopeLabel],url:'',sourceVersion:r.sourceVersion,sourceUpdatedAt:r.sourceUpdatedAt,recordKey:r.recordKey};
  }
  if(r.cancelled||r.status==='cancelled')fail('removal_contract_not_verified','Calendar cancellations must use the verified removal contract.');
  // A missing source timestamp has no safe ordering against a previous version.
  // Fail the whole delivery rather than silently dropping or overwriting it.
  if(r.sourceUpdatedAt===null)fail('missing_source_version','Calendar sourceUpdatedAt is null. A durable ordering rule is required before this record can be applied.');
  if(Date.parse(r.sourceUpdatedAt)>Date.parse(generatedAt)+300000)fail('future_timestamp','Calendar sourceUpdatedAt is later than generatedAt.');
  let from,to,original;try{from=eventPoint(r.start,r.allDay);to=eventPoint(r.end,r.allDay);if(r.originalStartTime)original=eventPoint(r.originalStartTime,r.allDay);}catch(e){fail('invalid_event_time',e.message);}
  if(Date.parse(to)<=Date.parse(from))fail('invalid_event_time','Calendar event end must follow start.');
  if(Date.parse(to)<=Date.parse(start)||Date.parse(from)>=Date.parse(end))fail('outside_scope','Calendar event does not overlap the approved window.');
  return {id:r.sourceId,updatedAt:asIso(r.sourceUpdatedAt),title:r.title,start:from,end:to,allDay:r.allDay,busy:r.busyFree==='busy',cancelled:false,calendarName:b.container.id,url:'',uid:r.iCalUID,recurringEventId:r.recurringEventId??undefined,originalStart:original,sourceUpdatedAt:r.sourceUpdatedAt,recordKey:r.recordKey,eventType:r.eventType,visibility:r.visibility,isRecurringInstance:r.isRecurringInstance};
 });
 return {schemaVersion:b.schemaVersion,batchId:b.batchId,provider:b.provider,account:b.account.toLowerCase(),resourceType:email?'email':'calendar',syncMode:b.syncMode,generatedAt,testMode:false,scope:{containerId:b.container.id,complete:false,windowStart:asIso(start),windowEnd:email?'9999-12-31T00:00:00.000Z':asIso(end)},records,deleted:[],scopeIdentity:canonicalJson(b.scope)};
}
