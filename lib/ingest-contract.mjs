import {z} from "zod";
import {parseWorkerIngest,ingestFingerprintInput} from "./ingest-worker-contract.mjs";
export {ingestFingerprintInput};
export const INGEST_BYTE_LIMIT=262144;
export const INGEST_RECORD_LIMIT=200;
export class IntakeError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
const id=z.string().trim().min(1).max(512);
const timestamp=z.string().datetime({offset:true}).transform(v=>new Date(v).toISOString());
const link=z.string().max(3000).refine(v=>!v||/^https:\/\//.test(v)).default("");
const calendar=z.object({id,updatedAt:timestamp,title:z.string().max(512),start:timestamp,end:timestamp,allDay:z.boolean().default(false),busy:z.boolean().default(true),cancelled:z.boolean().default(false),calendarName:z.string().max(240).default("Calendar"),url:link,uid:z.string().max(512).optional(),recurringEventId:id.optional(),originalStart:timestamp.optional()}).strict().refine(e=>Date.parse(e.end)>Date.parse(e.start));
const email=z.object({id,updatedAt:timestamp,threadId:id.optional(),subject:z.string().max(512),sender:z.string().max(512),receivedAt:timestamp,snippet:z.string().max(2000).default(""),unread:z.boolean().default(false),starred:z.boolean().default(false),labels:z.array(z.string().max(100)).max(50).default([]),url:link}).strict();
const base={schemaVersion:z.literal(1),batchId:z.string().uuid(),provider:z.enum(["google","microsoft"]),account:z.string().email().max(240).transform(v=>v.toLowerCase()),syncMode:z.enum(["incremental","reconciliation"]),generatedAt:timestamp,testMode:z.boolean().default(false),scope:z.object({containerId:id,complete:z.boolean(),windowStart:timestamp,windowEnd:timestamp}).strict().refine(s=>Date.parse(s.windowEnd)>Date.parse(s.windowStart)),deleted:z.array(z.object({id,updatedAt:timestamp}).strict()).max(INGEST_RECORD_LIMIT).default([])};
const contract=z.discriminatedUnion("resourceType",[z.object({...base,resourceType:z.literal("calendar"),records:z.array(calendar).max(INGEST_RECORD_LIMIT)}).strict(),z.object({...base,resourceType:z.literal("email"),records:z.array(email).max(INGEST_RECORD_LIMIT)}).strict()]);
export function parseIngest(value,now=Date.now()){
 if(value?.schemaVersion==='partheanon.sync.v1')return parseWorkerIngest(value,IntakeError,now);
 const result=contract.safeParse(value);
 if(!result.success)throw new IntakeError(422,"invalid_payload","Payload does not match schemaVersion 1. Check the published intake contract; no records were changed.");
 const b=result.data;
 if(Date.parse(b.generatedAt)>now+300000)throw new IntakeError(422,"future_timestamp","generatedAt is more than five minutes in the future.");
 const ids=[...b.records.map(r=>r.id),...b.deleted.map(r=>r.id)];
 if(new Set(ids).size!==ids.length)throw new IntakeError(422,"duplicate_record","A record ID may appear only once in a batch, including deletions.");
 if([...b.records,...b.deleted].some(r=>Date.parse(r.updatedAt)>Date.parse(b.generatedAt)+300000))throw new IntakeError(422,"future_timestamp","A source updatedAt is later than generatedAt.");
 return b;
}
export function validateIngestHeaders(request,value){
 const schema=request.headers.get('X-Partheanon-Schema'),key=request.headers.get('Idempotency-Key');
 if(value?.schemaVersion==='partheanon.sync.v1'&&(!schema||!key))throw new IntakeError(422,'missing_contract_headers','The worker contract requires X-Partheanon-Schema and Idempotency-Key.');
 if(schema!==null&&schema!==String(value?.schemaVersion)||key!==null&&key!==value?.batchId)throw new IntakeError(422,'contract_header_mismatch','Schema and idempotency headers must match the envelope.');
}
export async function readIngestJson(request){
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))throw new IntakeError(415,"content_type","Use Content-Type: application/json.");
 const reader=request.body?.getReader();if(!reader)throw new IntakeError(400,"invalid_json","A JSON body is required.");
 const chunks=[];let size=0;
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>INGEST_BYTE_LIMIT){await reader.cancel();throw new IntakeError(413,"payload_too_large","Maximum request size is 256 KiB. Split the delivery into smaller batches.");}chunks.push(value);}
 const joined=new Uint8Array(size);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(joined));}catch{throw new IntakeError(400,"invalid_json","The request body is not valid UTF-8 JSON.");}
}
export function mergeIngestSources(legacy,streams,records){
 const sources={...legacy},groups=new Map();
 for(const stream of streams.filter(s=>s.published&&!s.testMode)){
  if(!groups.has(stream.sourceKey))groups.set(stream.sourceKey,[]);groups.get(stream.sourceKey).push(stream);
 }
 for(const [sourceKey,group] of groups){
  const payload={account:group[0].account,events:[],emails:[],partial:group.some(s=>!s.complete),notes:["Synced by n8n. Internal provider refresh does not overwrite this view. Only explicit source deletions remove records."],updatedAt:group.map(s=>s.receivedAt).sort()[0],windowStart:group.map(s=>s.windowStart).sort().at(-1),windowEnd:group.map(s=>s.windowEnd).sort()[0],syncTransport:"n8n"};
  for(const stream of group)for(const row of records.filter(r=>r.streamId===stream.id&&!r.deleted)){
   const r=JSON.parse(row.payload),identity=`n8n:${stream.provider}:${stream.account}:${stream.resourceType}:${encodeURIComponent(stream.containerId)}:${encodeURIComponent(row.recordId)}`;
   if(stream.resourceType==="calendar"){
    if(Date.parse(r.end)<=Date.parse(stream.windowStart)||Date.parse(r.start)>=Date.parse(stream.windowEnd))continue;
    payload.events.push({...r,id:identity,source:stream.provider==="google"?"google":"outlook",calendar:r.calendarName,lane:stream.lane});
   }else{
    if(Date.parse(r.receivedAt)<Date.parse(stream.windowStart)||Date.parse(r.receivedAt)>=Date.parse(stream.windowEnd))continue;
    payload.emails.push({id:identity,title:r.subject,sender:r.sender,snippet:r.snippet,date:r.receivedAt,source:sourceKey,lane:stream.lane,url:r.url,unread:r.unread,starred:r.starred,signal:r.starred?"Flagged":"Recent mail"});
   }
  }
  payload.emails.sort((a,b)=>b.date.localeCompare(a.date));sources[sourceKey]=payload;
 }
 return sources;
}
