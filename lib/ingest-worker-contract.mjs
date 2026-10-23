import {z} from 'zod';
// Saved worker wire schema, interpreted using the October 23 handoff v1.1.
// Complete scans establish an additive baseline; absence pruning stays disabled.
const id=z.string().min(1).max(512);
const stamp=z.string().datetime({offset:true});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
const account=z.string().email().max(240);
const point=z.object({dateTime:stamp.nullable(),date:date.nullable(),timeZone:z.string().min(1).max(100)}).strict();
const originalPoint=z.object({dateTime:stamp.nullable().optional(),date:date.nullable().optional(),timeZone:z.string().min(1).max(100).optional()}).strict().refine(p=>!!p.dateTime!==!!p.date);
const removalIdentity={recordKey:id,sourceId:id};
const mailDeletion=z.object({...removalIdentity,kind:z.literal('deleted_at_source'),sourceUpdatedAt:id.nullable()}).strict();
const calDeletion=z.object({...removalIdentity,kind:z.literal('cancelled'),recurringEventId:id.nullable(),originalStartTime:originalPoint.nullable(),sourceUpdatedAt:stamp.nullable()}).strict();
const mailExit=z.object({...removalIdentity,reason:z.enum(['out_of_scope','left_scope','source_not_found','outside_window','spam','trashed']),sourceUpdatedAt:id.nullable()}).strict();
const calExit=z.object({...removalIdentity,reason:z.literal('outside_window'),sourceUpdatedAt:stamp.nullable()}).strict();
const identity={recordKey:id,provider:z.literal('google'),account,containerType:z.enum(['mailbox','calendar']),containerId:id,sourceId:id};
const mail=z.object({...identity,messageId:id,threadId:id,senderAddress:z.string().max(320),subject:z.string().max(120),receivedAt:stamp,read:z.boolean(),inScopeLabel:id,sourceVersion:id,sourceUpdatedAt:id}).strict();
const event=z.object({...identity,iCalUID:id,title:z.string().max(200),start:point,end:point,allDay:z.boolean(),busyFree:z.enum(['busy','free']),status:z.enum(['confirmed','tentative','cancelled']),cancelled:z.boolean(),eventType:z.string().max(100),visibility:z.string().max(100),recurringEventId:id.nullable(),originalStartTime:originalPoint.nullable(),isRecurringInstance:z.boolean(),sourceUpdatedAt:stamp.nullable()}).strict();
const coverage=z.object({complete:z.boolean(),authoritative:z.boolean(),pagesFetched:z.number().int().min(0).max(100000),recordCount:z.number().int().min(0),deletionCount:z.number().int().min(0),scopeExitCount:z.number().int().min(0),reconciliationRule:z.string().max(1000)}).strict();
const base={schemaVersion:z.literal('partheanon.sync.v1'),batchId:z.string().regex(/^gsync_[a-f0-9]{40}$/),provider:z.literal('google'),account,syncMode:z.enum(['incremental','initial','reconcile']),container:z.object({type:z.enum(['mailbox','calendar']),id}).strict(),coverage,generatedAt:stamp,producer:z.object({name:z.string().min(1).max(120),version:z.string().min(1).max(40)}).strict()};
const worker=z.discriminatedUnion('resourceType',[
 z.object({...base,resourceType:z.literal('email_message'),scope:z.object({emailScope:z.literal('inbox'),labelId:z.literal('INBOX'),receivedAfter:stamp,alignment:z.literal('utc_day')}).strict(),records:z.array(mail).max(400),deletions:z.array(mailDeletion).max(2000),scopeExits:z.array(mailExit).max(2000)}).strict(),
 z.object({...base,resourceType:z.literal('calendar_event'),scope:z.object({window:z.object({start:stamp,end:stamp,alignment:z.literal('utc_day')}).strict()}).strict(),records:z.array(event).max(2000),deletions:z.array(calDeletion).max(2000),scopeExits:z.array(calExit).max(2000)}).strict()
]);
export function canonicalJson(value){
 if(value===undefined)return 'null';
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';
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
 if(!b.coverage.complete)fail('incomplete_scan','The saved worker aggregates a complete scan. Incomplete envelopes cannot be accepted.');
 if(b.coverage.authoritative!==(b.syncMode!=='incremental'))fail('coverage_mode','Only initial/reconcile may assert authoritative coverage.');
 if(b.coverage.pagesFetched>20||b.records.length+b.deletions.length+b.scopeExits.length>5000)fail('scan_budget','The delivery exceeds the agreed scan budget.');
 if(!email&&b.syncMode!=='incremental'&&b.scopeExits.length)fail('coverage_mode','Full Calendar scans do not emit scope exits.');
 if(email&&b.syncMode!=='incremental'&&(b.deletions.length||b.scopeExits.some(r=>r.reason==='out_of_scope')))fail('coverage_mode','Full Gmail scans do not emit history deletions or generic out_of_scope exits.');
 const generatedAt=asIso(b.generatedAt);
 if(Date.parse(generatedAt)>now+300000)fail('future_timestamp','generatedAt is more than five minutes in the future.');
 if(b.container.type!==(email?'mailbox':'calendar'))fail('identity_mismatch','Container type does not match the resource.');
 const start=email?b.scope.receivedAfter:b.scope.window.start,end=email?null:b.scope.window.end;
 if(!utcDay(start)||end&&!utcDay(end))fail('invalid_scope','utc_day scope boundaries must be midnight UTC.');
 if(end&&Date.parse(end)<=Date.parse(start))fail('invalid_scope','Calendar window end must follow start.');
 const seen=new Set();
 const checkIdentity=r=>{
  const expected=[b.provider,b.account,b.container.type,b.container.id,r.sourceId].join('|');
  if(r.recordKey!==expected)fail('identity_mismatch','Record identity must match its envelope and canonical recordKey.');
  if(seen.has(r.sourceId))fail('duplicate_record','A source ID may appear only once across all three arrays.');seen.add(r.sourceId);
 };
 const version=value=>{if(value===null)return '';if(!email){if(Date.parse(value)>Date.parse(generatedAt)+300000)fail('future_timestamp','A source timestamp is later than generatedAt.');return asIso(value);}try{return gmailVersionKey(value);}catch(e){fail('unsupported_source_version',e.message);}};
 const records=b.records.map(r=>{
  checkIdentity(r);
  if(r.provider!==b.provider||r.account!==b.account||r.containerType!==b.container.type||r.containerId!==b.container.id)fail('identity_mismatch','Record identity does not match its envelope.');
  if(email){
   if(r.sourceId!==r.messageId||r.sourceUpdatedAt!==r.sourceVersion||r.inScopeLabel!==b.scope.labelId)fail('identity_mismatch','Gmail IDs, history version or scope label do not match.');
   const order=version(r.sourceVersion);
   if(Date.parse(r.receivedAt)<Date.parse(start))fail('outside_scope','Email receivedAt is before the approved scope.');
   return {id:r.sourceId,updatedAt:order,threadId:r.threadId,subject:r.subject,sender:r.senderAddress,receivedAt:asIso(r.receivedAt),snippet:'',unread:!r.read,starred:false,labels:[r.inScopeLabel],url:'',sourceVersion:r.sourceVersion,sourceUpdatedAt:r.sourceUpdatedAt,recordKey:r.recordKey};
  }
  if(r.cancelled||r.status==='cancelled')fail('invalid_cancellation','Cancelled events belong in deletions, using the exact occurrence identity.');
  let from,to,original;try{from=eventPoint(r.start,r.allDay);to=eventPoint(r.end,r.allDay);if(r.originalStartTime)original=eventPoint({date:r.originalStartTime.date??null,dateTime:r.originalStartTime.dateTime??null,timeZone:r.originalStartTime.timeZone||r.start.timeZone},r.allDay);}catch(e){fail('invalid_event_time',e.message);}
  if(Date.parse(to)<=Date.parse(from))fail('invalid_event_time','Calendar event end must follow start.');
  const outside=Date.parse(to)<=Date.parse(start)||Date.parse(from)>=Date.parse(end);
  if(outside&&!r.allDay)fail('outside_scope','Calendar event does not overlap the approved window.');
  return {id:r.sourceId,updatedAt:version(r.sourceUpdatedAt),title:r.title,start:from,end:to,allDay:r.allDay,busy:r.busyFree==='busy',cancelled:false,calendarName:b.container.id,url:'',uid:r.iCalUID,recurringEventId:r.recurringEventId??undefined,originalStart:original,sourceUpdatedAt:r.sourceUpdatedAt,recordKey:r.recordKey,eventType:r.eventType,visibility:r.visibility,isRecurringInstance:r.isRecurringInstance,originalStartTime:r.originalStartTime,windowAmbiguous:outside};
 });
 const normalizeRemoval=(r,state)=>{checkIdentity(r);return {id:r.sourceId,updatedAt:version(r.sourceUpdatedAt),state,reason:'reason' in r?r.reason:r.kind,evidence:r};};
 const deleted=b.deletions.map(r=>normalizeRemoval(r,email?'source_deleted':'cancelled')),scopeExits=b.scopeExits.map(r=>normalizeRemoval(r,'scope_exit'));
 // Rolling bounds belong in stream state, not its identity. Each destination DB
 // and owner owns an isolated stream; legacy/unmapped rows are never adopted.
 const scopeIdentity=canonicalJson(email?{emailScope:b.scope.emailScope,labelId:b.scope.labelId,alignment:b.scope.alignment}:{alignment:b.scope.window.alignment});
 return {schemaVersion:b.schemaVersion,batchId:b.batchId,provider:b.provider,account:b.account.toLowerCase(),resourceType:email?'email':'calendar',syncMode:b.syncMode,generatedAt,testMode:false,scope:{containerId:b.container.id,complete:b.coverage.authoritative,windowStart:asIso(start),windowEnd:email?'9999-12-31T00:00:00.000Z':asIso(end)},records,deleted,scopeExits,scopeIdentity};
}
