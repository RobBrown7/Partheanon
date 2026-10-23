import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseIngest,validateIngestHeaders} from './ingest-contract.mjs';
import {ingestFingerprintInput,gmailVersionKey,eventPoint} from './ingest-worker-contract.mjs';
const now=Date.parse('2026-10-23T21:00:00Z');
const fixture=name=>JSON.parse(readFileSync(new URL(`../scripts/tests/fixtures/n8n-${name}.json`,import.meta.url)));
test('actual synthetic worker envelopes normalize without source content expansion',()=>{
 const mail=parseIngest(fixture('gmail'),now),cal=parseIngest(fixture('calendar'),now);
 assert.equal(mail.batchId,'gsync_fed46cca8513e9f60437adb5b92c934fc9a6e41e');
 assert.equal(mail.records[0].sourceVersion,'9876543210123456789');
 assert.equal(mail.records[0].sourceUpdatedAt,'9876543210123456789');
 assert.equal(mail.records[0].snippet,'');assert.equal(mail.records[0].url,'');assert.equal(mail.records[0].unread,true);
 assert.equal(mail.scope.containerId,'all_mail');assert.equal(mail.scope.complete,false);
 assert.equal(cal.records[0].start,'2026-10-24T17:00:00.000Z');
 assert.equal(cal.records[0].end,'2026-10-24T17:30:00.000Z');assert.equal(cal.records[0].busy,true);
 assert.equal(cal.scope.complete,false,'a successful delta does not establish initial coverage');
});
test('Gmail history ordering preserves precision and compares different digit lengths',()=>{
 assert.ok(gmailVersionKey('10000000000000000000')>gmailVersionKey('9876543210123456789'));
 assert.ok(gmailVersionKey('9876543210123456790')>gmailVersionKey('9876543210123456789'));
 assert.equal(gmailVersionKey('000123'),gmailVersionKey('123'));
 assert.throws(()=>gmailVersionKey('opaque-future-version'));
});
test('retry fingerprint ignores top-level generatedAt and object key order only',()=>{
 const original=fixture('gmail'),retry=JSON.parse(JSON.stringify(original));retry.generatedAt='2026-10-23T20:30:00.000Z';
 const reordered=Object.fromEntries(Object.entries(retry).reverse());reordered.coverage=Object.fromEntries(Object.entries(retry.coverage).reverse());
 assert.equal(ingestFingerprintInput(original),ingestFingerprintInput(reordered));
 retry.records[0].subject='Different content';assert.notEqual(ingestFingerprintInput(original),ingestFingerprintInput(retry));
});
test('worker headers must match body and both are required',()=>{
 const b=fixture('gmail'),req=headers=>new Request('https://example.test',{headers});
 assert.throws(()=>validateIngestHeaders(req({}),b));
 assert.throws(()=>validateIngestHeaders(req({'Idempotency-Key':b.batchId,'X-Partheanon-Schema':'1'}),b));
 assert.throws(()=>validateIngestHeaders(req({'Idempotency-Key':'wrong','X-Partheanon-Schema':b.schemaVersion}),b));
 validateIngestHeaders(req({'Idempotency-Key':b.batchId,'X-Partheanon-Schema':b.schemaVersion}),b);
});
test('identity, count, scope and content mismatches reject the whole delivery',()=>{
 for(const mutate of [b=>b.records[0].account='someone@example.com',b=>b.records[0].recordKey='wrong',b=>b.records[0].messageId='wrong',b=>b.coverage.recordCount=4,b=>b.records[0].body='private text',b=>b.records[0].subject='x'.repeat(121),b=>b.records.push(b.records[0]),b=>b.scope.receivedAfter='2026-10-16T01:00:00Z',b=>b.records[0].sourceVersion='123']){
  const b=fixture('gmail');mutate(b);assert.throws(()=>parseIngest(b,now));
 }
});
test('incomplete scans, mode mismatches and malformed removals reject; null versions remain unguessed',()=>{
 const empty=fixture('gmail');empty.records=[];empty.coverage.recordCount=0;assert.equal(parseIngest(empty,now).records.length,0);
 for(const mutate of [b=>b.syncMode='initial',b=>b.coverage.authoritative=true,b=>b.coverage.complete=false,b=>{b.deletions=[{kind:'deleted_at_source'}];b.coverage.deletionCount=1;}]){const b=fixture('gmail');mutate(b);assert.throws(()=>parseIngest(b,now));}
 let b=fixture('calendar');b.records[0].cancelled=true;assert.throws(()=>parseIngest(b,now),/Cancelled events/);
 b=fixture('calendar');b.records[0].sourceUpdatedAt=null;assert.equal(parseIngest(b,now).records[0].updatedAt,'');
});
test('all-day events use the named time zone, including DST days',()=>{
 assert.equal(eventPoint({date:'2026-10-24',dateTime:null,timeZone:'America/Phoenix'},true),'2026-10-24T07:00:00.000Z');
 const start=eventPoint({date:'2026-11-01',dateTime:null,timeZone:'America/New_York'},true),end=eventPoint({date:'2026-11-02',dateTime:null,timeZone:'America/New_York'},true);
 assert.equal((Date.parse(end)-Date.parse(start))/3600000,25);
 const b=fixture('calendar');b.records[0].allDay=true;b.records[0].start={date:'2026-10-24',dateTime:null,timeZone:'America/Phoenix'};b.records[0].end={date:'2026-10-25',dateTime:null,timeZone:'America/Phoenix'};
 assert.equal(parseIngest(b,now).records[0].end,'2026-10-25T07:00:00.000Z');
});
