import {IntakeError} from './ingest-contract.mjs';
import {planWorkerBatch} from './ingest-worker-plan.mjs';

// Called only after account/container authorization and the per-key rate guard.
export async function commitWorkerBatch(db:D1DatabaseSession,key:any,b:any,input:unknown,target:any,streamId:string,hash:string){
 const prior=await db.prepare('SELECT digest,result FROM ingest_receipts WHERE stream_id=? AND batch_id=?').bind(streamId,b.batchId).first<any>();
 if(prior){if(prior.digest!==hash)throw new IntakeError(409,'batch_id_reused','This batchId already has a different logical envelope.');return {...JSON.parse(prior.result),status:'duplicate'};}
 const stream=await db.prepare('SELECT * FROM ingest_streams WHERE id=?').bind(streamId).first<any>();
 const stored=await db.prepare('SELECT record_id AS recordId,updated_at AS updatedAt,state,reason,payload,deleted FROM ingest_records WHERE stream_id=?').bind(streamId).all<any>();
 const rows=stored.results||[],plan=planWorkerBatch(b,rows);
 const ids=new Set([...rows.map(r=>r.recordId),...plan.changes.map(r=>r.recordId)]);
 if(ids.size>5000)throw new IntakeError(409,'stream_capacity','Review intake scope: this stream would exceed 5,000 retained identities.');
 const pending=await db.prepare('SELECT count(*) AS n FROM ingest_deferred WHERE stream_id=?').bind(streamId).first<any>();
 if((pending?.n||0)+plan.deferred.length>5000)throw new IntakeError(409,'review_capacity','Deferred evidence needs review before accepting more uncertain changes.');
 const receivedAt=new Date().toISOString(),generation=crypto.randomUUID(),sequence=(stream?.sequence||0)+1;
 const published=!!stream?.published||b.syncMode!=='incremental';
 // This clock check guards display retention, not provider version ordering.
 const useWindow=!stream||b.generatedAt>=stream.generated_at;
 const from=useWindow?[stream?.window_start||'',b.scope.windowStart].sort().at(-1)!:stream.window_start,to=useWindow?[stream?.window_end||'',b.scope.windowEnd].sort().at(-1)!:stream.window_end;
 const result={ok:true,batchId:b.batchId,status:'accepted',receivedAt,...plan.summary,sequence,published,coverage:'provisional',receiptDigest:hash};
 const guard='EXISTS(SELECT 1 FROM ingest_streams WHERE id=? AND generation=?)';
 const commands=[
  db.prepare('INSERT INTO ingest_streams(id,owner,provider,account,resource_type,container_id,source_key,lane,test_mode,window_start,window_end,contract,scope_definition) VALUES(?,?,?,?,?,?,?,?,0,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(streamId,key.owner,b.provider,b.account,b.resourceType,b.scope.containerId,target.sourceKey,target.lane,from,to,b.schemaVersion,b.scopeIdentity),
  db.prepare('UPDATE ingest_streams SET generation=?,sequence=?,generated_at=?,received_at=?,window_start=?,window_end=?,source_key=?,lane=?,published=?,complete=0,review_count=? WHERE id=? AND generation=? AND EXISTS(SELECT 1 FROM ingest_keys WHERE id=? AND revoked=0 AND expires_at>?)').bind(generation,sequence,[stream?.generated_at||'',b.generatedAt].sort().at(-1)!,receivedAt,from,to,target.sourceKey,target.lane,published?1:0,(pending?.n||0)+plan.deferred.length,streamId,stream?.generation||'',key.id,receivedAt),
  db.prepare(`INSERT INTO ingest_records(owner,stream_id,record_id,updated_at,deleted,payload,state,reason,evidence_batch) SELECT ?,?,json_extract(value,'$.recordId'),json_extract(value,'$.updatedAt'),json_extract(value,'$.deleted'),json_extract(value,'$.payload'),json_extract(value,'$.state'),json_extract(value,'$.reason'),json_extract(value,'$.evidenceBatch') FROM json_each(?) WHERE ${guard} ON CONFLICT(stream_id,record_id) DO UPDATE SET updated_at=excluded.updated_at,deleted=excluded.deleted,payload=excluded.payload,state=excluded.state,reason=excluded.reason,evidence_batch=excluded.evidence_batch`).bind(key.owner,streamId,JSON.stringify(plan.changes),streamId,generation),
  db.prepare(`INSERT INTO ingest_deferred(owner,stream_id,batch_id,record_id,kind,reason,payload,created_at) SELECT ?,?,?,json_extract(value,'$.id'),json_extract(value,'$.kind'),json_extract(value,'$.reason'),json_extract(value,'$.payload'),? FROM json_each(?) WHERE ${guard}`).bind(key.owner,streamId,b.batchId,receivedAt,JSON.stringify(plan.deferred),streamId,generation),
  db.prepare(`INSERT INTO ingest_receipts(stream_id,batch_id,digest,received_at,record_count,deleted_count,result,envelope) SELECT ?,?,?,?,?,?,?,? WHERE ${guard}`).bind(streamId,b.batchId,hash,receivedAt,b.records.length,b.deleted.length,JSON.stringify(result),JSON.stringify(input),streamId,generation)
 ];
 const outcome=await db.batch(commands);
 if(outcome[1].meta.changes!==1){
  const receipt=await db.prepare('SELECT digest,result FROM ingest_receipts WHERE stream_id=? AND batch_id=?').bind(streamId,b.batchId).first<any>();
  if(receipt?.digest===hash)return {...JSON.parse(receipt.result),status:'duplicate'};
  throw new IntakeError(409,'concurrent_delivery','Another delivery committed first. Retry the identical logical envelope.');
 }
 return result;
}
