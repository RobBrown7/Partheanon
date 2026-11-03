import {z} from 'zod';
export const FOCUS_SCHEMA='partheanon.focus.v1';
export const pointSchema=z.string().datetime({offset:true}).transform(v=>new Date(v).toISOString());
export const windowSchema=z.object({start:pointSchema,end:pointSchema}).refine(v=>Date.parse(v.end)>Date.parse(v.start)&&Date.parse(v.end)-Date.parse(v.start)<=8*3600000,'Choose a block of up to eight hours.');
export function eventId(blockId){return 'ptn'+z.string().uuid().parse(blockId).replaceAll('-','');}
export function eventBody(job){return {summary:job.title,start:{dateTime:job.start,timeZone:'America/Phoenix'},end:{dateTime:job.end,timeZone:'America/Phoenix'},visibility:'private',transparency:'opaque',attendees:[],extendedProperties:{private:{partheanonBlockId:job.blockId,partheanonCommandId:job.id}}};}
export function validateReadback(job,event){
 const v=z.object({id:z.string(),etag:z.string().min(1).max(512),summary:z.string(),start:z.object({dateTime:pointSchema}),end:z.object({dateTime:pointSchema}),status:z.literal('confirmed'),visibility:z.literal('private'),transparency:z.literal('opaque'),attendees:z.array(z.unknown()).max(0).default([]),extendedProperties:z.object({private:z.object({partheanonBlockId:z.string(),partheanonCommandId:z.string()})})}).parse(event);
 if(v.id!==job.eventId||v.summary!==job.title||v.start.dateTime!==job.start||v.end.dateTime!==job.end||v.extendedProperties.private.partheanonBlockId!==job.blockId||v.extendedProperties.private.partheanonCommandId!==job.id)throw new Error('Provider readback does not match the approved focus block.');
 return {id:v.id,etag:v.etag,start:v.start.dateTime,end:v.end.dateTime,status:v.status};
}
// Used by the n8n decision node and fixture tests. Never overwrite an unrelated event.
export function planMutation(job,status,event){
 if(status===404){if(job.operation!=='create')throw new Error('The published event is missing. Review it before creating anything else.');return {method:'POST',body:{id:job.eventId,...eventBody(job)}};}
 if(status!==200)throw new Error('Provider lookup failed. Resolve delivery before retrying.');
 try{validateReadback(job,event);return {method:null};}catch{}
 if(job.operation!=='reschedule'||event?.extendedProperties?.private?.partheanonBlockId!==job.blockId||event.etag!==job.expectedEtag||event.status==='cancelled'||(event.attendees||[]).length)throw new Error('The calendar event changed or belongs to another operation. Review before writing.');
 return {method:'PATCH',etag:event.etag,body:eventBody(job)};
}
