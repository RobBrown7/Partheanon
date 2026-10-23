import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIngest,readIngestJson,mergeIngestSources} from './ingest-contract.mjs';
const now=Date.parse('2026-10-23T20:00:00Z');
const batch=()=>({schemaVersion:1,batchId:'0aa48dc5-33ce-4d36-b6c1-95712a1665c9',provider:'google',account:'TEST@example.com',resourceType:'calendar',syncMode:'incremental',generatedAt:'2026-10-23T20:00:00Z',testMode:true,scope:{containerId:'primary',complete:false,windowStart:'2026-10-23T00:00:00Z',windowEnd:'2026-11-23T00:00:00Z'},records:[{id:'one',updatedAt:'2026-10-23T19:00:00Z',title:'Synthetic meeting',start:'2026-10-24T09:00:00-07:00',end:'2026-10-24T10:00:00-07:00'}],deleted:[]});
test('contract normalizes account and explicit timezone timestamps',()=>{const b=parseIngest(batch(),now);assert.equal(b.account,'test@example.com');assert.equal(b.records[0].start,'2026-10-24T16:00:00.000Z');});
test('rejects ambiguous timestamps, duplicate IDs, bodies and future clocks',()=>{
 let b=batch();b.records[0].start='2026-10-24T09:00:00';assert.throws(()=>parseIngest(b,now),/schemaVersion/);
 b=batch();b.deleted=[{id:'one',updatedAt:b.generatedAt}];assert.throws(()=>parseIngest(b,now),/only once/);
 b=batch();b.records[0].body='full email content';assert.throws(()=>parseIngest(b,now),/schemaVersion/);
 b=batch();b.generatedAt='2026-10-24T20:00:00Z';assert.throws(()=>parseIngest(b,now),/future/);
});
test('partial initial sync and test streams cannot replace cached live data',()=>{
 const legacy={google:{events:[{id:'old'}]}};const s={id:'s',sourceKey:'google',published:false,testMode:false};
 assert.deepEqual(mergeIngestSources(legacy,[s],[]),legacy);assert.deepEqual(mergeIngestSources(legacy,[{...s,published:true,testMode:true}],[]),legacy);
});
test('published partial streams retain visible records; explicit tombstones hide records',()=>{
 const b=parseIngest(batch(),now),s={id:'s',sourceKey:'google',provider:'google',account:b.account,resourceType:'calendar',containerId:'primary',published:true,testMode:false,complete:false,lane:'Personal',receivedAt:b.generatedAt,...b.scope};
 const rows=[{streamId:'s',recordId:'one',deleted:false,payload:JSON.stringify(b.records[0])},{streamId:'s',recordId:'two',deleted:true,payload:JSON.stringify(b.records[0])}];
 const result=mergeIngestSources({},[s],rows);assert.equal(result.google.events.length,1);assert.equal(result.google.partial,true);assert.equal(result.google.syncTransport,'n8n');
});
test('bounded UTF-8 JSON reader rejects oversized and malformed bodies',async()=>{
 await assert.rejects(()=>readIngestJson(new Request('https://test',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(1048577)})),/1 MiB/);
 await assert.rejects(()=>readIngestJson(new Request('https://test',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})),/valid UTF-8 JSON/);
});
