// Pure functions embedded verbatim into the n8n Code nodes; no secrets or network calls.
export function focusEventBody(job){return {summary:job.title,start:{dateTime:job.start,timeZone:'America/Phoenix'},end:{dateTime:job.end,timeZone:'America/Phoenix'},visibility:'private',transparency:'opaque',attendees:[],extendedProperties:{private:{partheanonBlockId:job.blockId,partheanonCommandId:job.id}}};}
export function cleanFocusReadback(job,e){
 const p=e?.extendedProperties?.private;
 if(!e||(e.recurrence||[]).length||e.recurringEventId||(e.eventType&&e.eventType!=='default')||e.id!==job.eventId||!e.etag||e.status!=='confirmed'||e.summary!==job.title||Date.parse(e.start?.dateTime)!==Date.parse(job.start)||Date.parse(e.end?.dateTime)!==Date.parse(job.end)||e.visibility!=='private'||(e.transparency||'opaque')!=='opaque'||(e.attendees||[]).length||p?.partheanonBlockId!==job.blockId||p?.partheanonCommandId!==job.id)throw new Error('Readback differs from the approved block.');
 return {id:e.id,etag:e.etag,summary:e.summary,start:{dateTime:new Date(e.start.dateTime).toISOString()},end:{dateTime:new Date(e.end.dateTime).toISOString()},status:e.status,visibility:e.visibility,transparency:'opaque',attendees:[],extendedProperties:{private:{partheanonBlockId:p.partheanonBlockId,partheanonCommandId:p.partheanonCommandId}}};
}
export function planGoogleMutation(job,status,event){
 if(job.schemaVersion!=='partheanon.focus.v1'||job.title!=='Focus time'||!job.calendarId.endsWith('@group.calendar.google.com')||job.sendUpdates!=='none'||(job.attendees||[]).length||!/^[0-9a-v]{5,64}$/.test(job.eventId))throw new Error('Unsupported pilot command.');
 if(status===404){if(job.operation!=='create')throw new Error('Published event missing; review before creating anything else.');return {method:'POST',body:{id:job.eventId,...focusEventBody(job)}};}
 if(status!==200)throw new Error('Provider lookup failed; delivery remains unresolved.');
 try{return {method:null,event:cleanFocusReadback(job,event)};}catch{}
 if(job.operation!=='reschedule'||event?.id!==job.eventId||(event.recurrence||[]).length||event.recurringEventId||event?.extendedProperties?.private?.partheanonBlockId!==job.blockId||event.etag!==job.expectedEtag||event.status==='cancelled'||(event.attendees||[]).length)throw new Error('Event changed or ownership does not match.');
 return {method:'PATCH',etag:event.etag,body:focusEventBody(job)};
}
