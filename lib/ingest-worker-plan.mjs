import {canonicalJson} from './ingest-worker-contract.mjs';

// No absence inference: a receiver-side CAS serializes commits, but cannot
// establish when an already-running provider scan began. generatedAt and batchId
// are not snapshot barriers. Retain absent rows until that protocol is agreed.
export function planWorkerBatch(batch,existing){
 const rows=new Map(existing.map(r=>[r.recordId,r])),changes=[],deferred=[];
 const summary={applied:0,unchanged:0,stale:0,deferred:0,absencePruning:'disabled',baseline:batch.syncMode!=='incremental'?'additive':'unchanged'};
 const defer=(r,kind,reason)=>deferred.push({id:r.id,kind,reason,payload:r});
 for(const [kind,incoming] of [['record',batch.records],['removal',batch.deleted],['scope_exit',batch.scopeExits]])for(const r of incoming){
  const prior=rows.get(r.id);
  if(kind==='record'&&r.windowAmbiguous){defer(r,kind,'ambiguous_all_day_window_boundary');continue;}
  if(!r.updatedAt){defer(r,kind,'missing_source_version');continue;}
  if(kind==='scope_exit'&&batch.resourceType==='calendar'&&(!prior?.payload||JSON.parse(prior.payload).allDay!==false)){
   defer(r,kind,'ambiguous_all_day_window_exit');continue;
  }
  if(kind==='scope_exit'&&batch.resourceType==='email'&&r.reason==='outside_window'&&prior?.payload&&Date.parse(JSON.parse(prior.payload).receivedAt)>=Date.parse(batch.scope.windowStart)){
   defer(r,kind,'receipt_window_disagrees');continue;
  }
  if(prior&&r.updatedAt<prior.updatedAt){summary.stale++;continue;}
  const state=kind==='record'?'active':r.state,reason=kind==='record'?'':r.reason;
  const payload=kind==='record'?JSON.stringify(r):prior?.payload??null;
  if(prior&&r.updatedAt===prior.updatedAt){
   if(prior.state===state&&prior.reason===reason&&(kind!=='record'||canonicalJson(JSON.parse(prior.payload))===canonicalJson(r))){summary.unchanged++;continue;}
   defer(r,kind,'equal_version_conflict');continue;
  }
  const row={recordId:r.id,updatedAt:r.updatedAt,state,reason,deleted:state!=='active',payload,evidenceBatch:batch.batchId};
  changes.push(row);rows.set(r.id,row);summary.applied++;
 }
 summary.deferred=deferred.length;
 return {changes,deferred,summary};
}
