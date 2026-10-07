import test from 'node:test';
import assert from 'node:assert/strict';
import {freeWindows,analyze,suggest,eventTime,collisions,normalizeEvents,dayAt,union} from './planning.mjs';
const now=dayAt('2026-10-07',9),prefs={startHour:9,endHour:17};
const ev=(title,start,end,busy=true)=>({title,start:`2026-10-07T${start}:00-07:00`,end:`2026-10-07T${end}:00-07:00`,busy});
test('busy intervals merge rather than double-count overlapping calendars',()=>{
 assert.deepEqual(union([[1,5],[3,7],[9,10]]),[[1,7],[9,10]]);
 const free=freeWindows([ev('a','10:00','11:00'),ev('b','10:30','12:00')],[],prefs,now,dayAt('2026-10-07',17));
 assert.equal(free.reduce((s,[a,b])=>s+(b-a)/60000,0),330);
});
test('transparent appointments do not consume work capacity',()=>{
 const free=freeWindows([ev('optional','09:00','17:00',false)],[],prefs,now,dayAt('2026-10-07',17));
 assert.equal(free.reduce((s,[a,b])=>s+(b-a)/60000,0),480);
});
test('weekend and all-day busy events leave no proposed work',()=>{
 assert.equal(freeWindows([],[],prefs,dayAt('2026-10-10'),dayAt('2026-10-12')).length,0);
 assert.equal(freeWindows([ev('away','00:00','23:59')],[],prefs,now,dayAt('2026-10-07',17)).length,0);
});
test('deadline feasibility compares cumulative work against available capacity',()=>{
 const tasks=[{id:'a',deadline:'2026-10-07',minutes:300,status:'open'},{id:'b',deadline:'2026-10-07',minutes:300,status:'open'}];
 const result=analyze(tasks,[],[],prefs,now);assert.equal(result.risks.length,1);assert.match(result.risks[0].reason,/120 minutes short/);
});
test('suggestions respect deadlines, calendar buffers and existing task reservations',()=>{
 const task={id:'a',title:'Deliver',deadline:'2026-10-07',minutes:120};
 const blocks=[{taskId:'a',start:'2026-10-07T09:00:00-07:00',end:'2026-10-07T10:00:00-07:00'}];
 const proposals=suggest(task,[ev('meeting','10:00','11:00')],blocks,prefs,now);
 assert.equal(proposals.length,1);assert.equal(proposals[0].start,'2026-10-07T18:15:00.000Z');assert.equal(Date.parse(proposals[0].end)-Date.parse(proposals[0].start),60*60000);
});
test('Outlook UTC timestamps retain timezone; unknown timezone is omitted',()=>{
 assert.equal(eventTime({dateTime:'2026-10-07T14:30:00',timeZone:'UTC'}),'2026-10-07T14:30:00Z');
 assert.equal(eventTime({dateTime:'2026-10-07T14:30:00',timeZone:'Unknown'}),null);
});
test('cancelled events are dropped and matching iCal UIDs avoid false conflicts',()=>{
 const a=ev('a','10:00','11:00');assert.equal(collisions([{...a,uid:'same'},{...a,uid:'same'}]).length,0);
 assert.equal(normalizeEvents({events:[{id:'x',summary:'cancelled',start:a.start,end:a.end,status:'cancelled'}]},'google',{id:'primary'}).length,0);
});
