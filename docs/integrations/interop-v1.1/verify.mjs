// Offline verification only. No requests, credentials, account creation or delivery.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {canonicalJson,ingestFingerprintInput,receiptDigest} from './canonicalize.mjs';
const json=file=>JSON.parse(readFileSync(new URL(file,import.meta.url),'utf8'));
const manifest=json('vectors.json'),base=json('envelope.json');
for(const vector of manifest.vectors){
 const envelope=json(vector.file),canonical=ingestFingerprintInput(envelope);
 assert.equal(await receiptDigest(envelope),vector.receiptDigest,vector.name);
 assert.equal(createHash('sha256').update(canonical,'utf8').digest('hex'),vector.receiptDigest,'independent Node hash');
 assert.equal(vector.receiptDigest===manifest.baseDigest,vector.sameAsBase,vector.name);
}
assert.equal(readFileSync(new URL('canonical-envelope.txt',import.meta.url),'utf8'),ingestFingerprintInput(base));
const accepted=json('accepted.example.json'),lookup=json('lookup.example.json'),duplicate=json('duplicate.example.json');
assert.deepEqual(accepted,lookup);assert.deepEqual({...duplicate,status:'accepted'},accepted);
assert.equal(accepted.receiptDigest,manifest.baseDigest);assert.equal(accepted.batchId,base.batchId);
if(process.argv.includes('--receiver')){
 const production=await import('../../../lib/ingest-worker-contract.mjs');
 const {parseIngest}=await import('../../../lib/ingest-contract.mjs');
 for(const vector of manifest.vectors){const envelope=json(vector.file);parseIngest(envelope,Date.parse('2026-10-23T21:00:00Z'));assert.equal(production.ingestFingerprintInput(envelope),ingestFingerprintInput(envelope));}
 assert.equal(canonicalJson({a:[2,1],b:{x:'café'}}),production.canonicalJson({a:[2,1],b:{x:'café'}}));
 parseIngest(json('deferred-removal.json'),Date.parse('2026-10-23T21:00:00Z'));
}
console.log('PASS: five immutable digest vectors, Web Crypto and Node hashing APIs, canonical bytes and receipt examples'+(process.argv.includes('--receiver')?', plus deployed receiver helper/schema parity.':'.'));
console.log('Base receiptDigest: '+manifest.baseDigest);
