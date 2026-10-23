import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {parseIngest,readIngestJson,mergeIngestSources} from './ingest-contract.mjs';
import {planWorkerBatch} from './ingest-worker-plan.mjs';
const root=new URL('../scripts/tests/fixtures/n8n-v11/',import.meta.url),now=Date.parse('2026-10-23T21:00:00Z');
const fixture=name=>JSON.parse(readFileSync(new URL(name+'.json',root)));
const parse=b=>parseIngest(b,now);
const row=r=>({recordId:r.id,updatedAt:r.updatedAt,state:'active',reason:'',payload:JSON.stringify(r),deleted:false});
test('all ten v1.1 bodies retain 14 top-level fields and normalize, including sparse exceptions',()=>{
 const files=readdirSync(root).filter(f=>!f.startsWith('._')&&f.endsWith('.json'));assert.equal(files.length,10);
 for(const name of files){const wire=JSON.parse(readFileSync(new URL(name,root)));assert.equal(Object.keys(wire).length,14);const b=parse(wire);assert.equal(b.records.length,wire.coverage.recordCount);assert.equal(b.deleted.length,wire.coverage.deletionCount);assert.equal(b.scopeExits.length,wire.coverage.scopeExitCount);}
 const cal=parse(fixture('calendar_removals'));assert.deepEqual(cal.deleted[0].evidence.originalStartTime,{date:'2026-10-25'});assert.equal(cal.deleted[2].evidence.recurringEventId,'synthetic-series-001');
});
test('empty incremental and authoritative scans never prune owned or legacy rows',()=>{
 const initial=parse(fixture('gmail_initial')),existing=[row(initial.records[0])];
 for(const name of ['gmail_no_change','gmail_empty_reconcile']){const p=planWorkerBatch(parse(fixture(name)),existing);assert.equal(p.changes.length,0);assert.equal(p.summary.absencePruning,'disabled');}
 // Exactly-at-cutoff messages and all-day events get the same no-prune guarantee.
 existing[0].payload=JSON.stringify({...initial.records[0],receivedAt:initial.scope.windowStart});assert.equal(planWorkerBatch(parse(fixture('gmail_empty_reconcile')),existing).changes.length,0);
});
test('known newer scope exits hide just their membership; newer re-entry restores it',()=>{
 const b=parse(fixture('gmail_initial')),r=b.records[0],current=row(r);
 const exit={id:r.id,updatedAt:r.updatedAt+'0',state:'scope_exit',reason:'left_scope'};
 const p=planWorkerBatch({...b,records:[],scopeExits:[exit]},[current]);assert.equal(p.changes[0].state,'scope_exit');assert.equal(p.changes[0].payload,current.payload);
 const newer={...r,updatedAt:r.updatedAt+'1',sourceVersion:r.sourceVersion+'1'};
 const reentered=planWorkerBatch({...b,records:[newer],scopeExits:[]},p.changes);assert.equal(reentered.changes[0].state,'active');assert.equal(reentered.changes[0].deleted,false);
});
test('old and equal-but-conflicting versions cannot overwrite newer records, even in full scans',()=>{
 const old=parse(fixture('gmail_initial')),newer=parse(fixture('gmail_reconcile')),saved=row(newer.records[0]);
 assert.equal(planWorkerBatch(old,[saved]).summary.stale,1);
 const conflict=structuredClone(newer);conflict.records[0].subject='Changed under the same version';const p=planWorkerBatch(conflict,[saved]);assert.equal(p.changes.length,0);assert.equal(p.deferred[0].reason,'equal_version_conflict');
 assert.equal(planWorkerBatch(newer,[saved]).summary.unchanged,1);
 const cal=parse(fixture('calendar_initial'));assert.equal(planWorkerBatch(cal,[row(cal.records[0])]).summary.unchanged,1,'undefined optional fields compare as stored JSON');
});
test('null versions are durable deferred candidates, never guessed from generatedAt',()=>{
 const b=parse(fixture('calendar_initial'));b.records[0].updatedAt='';b.records[0].sourceUpdatedAt=null;
 const p=planWorkerBatch(b,[]);assert.equal(p.changes.length,0);assert.equal(p.deferred[0].reason,'missing_source_version');
 const sparse=parse(fixture('calendar_reconcile')),q=planWorkerBatch(sparse,[]);assert.equal(q.summary.applied,1);assert.equal(q.summary.deferred,1);assert.equal(q.deferred[0].payload.evidence.originalStartTime.dateTime,'2026-10-24T10:00:00-07:00');
});
test('explicit cancellation targets only its exact ID; uncertain all-day exits are deferred',()=>{
 const b=parse(fixture('calendar_initial')),r=b.records[0],saved=row(r),other={...saved,recordId:'another-occurrence'};
 const removal={id:r.id,updatedAt:'2026-10-23T17:15:00.000Z',state:'cancelled',reason:'cancelled'};
 let p=planWorkerBatch({...b,records:[],deleted:[removal]},[saved,other]);assert.equal(p.changes.length,1);assert.equal(p.changes[0].recordId,r.id);assert.equal(p.changes[0].state,'cancelled');
 const exit={...removal,state:'scope_exit',reason:'outside_window'};
 p=planWorkerBatch({...b,records:[],scopeExits:[exit]},[saved]);assert.equal(p.changes[0].state,'scope_exit');
 for(const prior of [[],[{...saved,payload:JSON.stringify({...r,allDay:true})}]]){p=planWorkerBatch({...b,records:[],scopeExits:[exit]},prior);assert.equal(p.changes.length,0);assert.equal(p.deferred[0].reason,'ambiguous_all_day_window_exit');}
});
test('rolling bounds retain stream identity and cutoff-equality exits are deferred',()=>{
 const wire=fixture('gmail_initial'),before=parse(wire);wire.scope.receivedAfter='2026-10-17T00:00:00.000Z';assert.equal(before.scopeIdentity,parse(wire).scopeIdentity);
 const b=parse(fixture('gmail_initial')),r=b.records[0],saved=row({...r,receivedAt:b.scope.windowStart});
 const p=planWorkerBatch({...b,records:[],scopeExits:[{id:r.id,updatedAt:r.updatedAt+'0',state:'scope_exit',reason:'outside_window'}]},[saved]);assert.equal(p.deferred[0].reason,'receipt_window_disagrees');
});
test('aggregated 400-message scan exceeds the former limit and fits the new bounded reader',async()=>{
 const b=fixture('gmail_initial'),r=b.records[0];b.records=Array.from({length:400},(_,i)=>({...r,subject:'床'.repeat(120),sourceId:'synthetic-'+i,messageId:'synthetic-'+i,recordKey:'google|pilot@example.com|mailbox|all_mail|synthetic-'+i}));b.coverage.recordCount=400;
 const body=JSON.stringify(b);assert.ok(Buffer.byteLength(body)>262144);const json=await readIngestJson(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body}));assert.equal(parse(json).records.length,400);
});
test('unmapped legacy items survive additive baseline and imported-item tombstones',()=>{
 const b=parse(fixture('gmail_initial')),s={id:'stream',sourceKey:'gmail',provider:'google',account:b.account,resourceType:'email',containerId:'all_mail',contract:b.schemaVersion,published:true,testMode:false,complete:false,reviewCount:0,receivedAt:b.generatedAt,...b.scope};
 const legacy={gmail:{emails:[{id:'legacy-one',title:'Same display text',date:b.generatedAt}]}};
 const result=mergeIngestSources(legacy,[s],[{streamId:s.id,recordId:b.records[0].id,deleted:true,payload:JSON.stringify(b.records[0])}]);
 assert.equal(result.gmail.emails.length,1);assert.equal(result.gmail.emails[0].id,'legacy-one');assert.equal(result.gmail.emails[0].importOwnership,'legacy-unmapped');
 assert.deepEqual(legacy.gmail.emails[0],{id:'legacy-one',title:'Same display text',date:b.generatedAt});
});
