"use client";
import {useEffect,useState} from "react";
import {CheckCircle2,Mail,RefreshCw} from "lucide-react";

export function deliveryTime(value:string){
 return new Intl.DateTimeFormat("en-US",{timeZone:"America/Phoenix",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value));
}

export default function IngestDeliveryStatus({onInbox,onConnections}:{onInbox:()=>void;onConnections:()=>void}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(""),[checking,setChecking]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let active=true;let controller:AbortController|undefined;
  async function read(){
   controller?.abort();controller=new AbortController();setChecking(true);
   try{const response=await fetch("/api/ingest-admin",{cache:"no-store",signal:controller.signal});const value:any=await response.json();if(!response.ok)throw new Error(value.error||"Could not check delivery status.");if(active){setData(value);setError("");}}
   catch(e:any){if(active&&e.name!=="AbortError")setError("Delivery status could not be checked. The last confirmed receipt is shown below.");}
   finally{if(active)setChecking(false);}
  }
  read();const timer=setInterval(()=>{if(!document.hidden)read();},30000);
  const visible=()=>{if(!document.hidden)read();};document.addEventListener("visibilitychange",visible);
  return()=>{active=false;controller?.abort();clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
 },[revision]);
 const streams=(data?.streams||[]).filter((s:any)=>s.published&&!s.testMode&&s.resourceType==="email");
 return <section className="panel ingest-delivery-status" aria-label="n8n email delivery status"><div className="panel-heading"><div><h2><Mail size={19}/> Your email connections</h2><p>Confirmed deliveries into Partheanon · updates every 30 seconds</p></div><button className="secondary" disabled={checking} onClick={()=>setRevision(r=>r+1)}><RefreshCw size={14} className={checking?"spinning":""}/> {checking?"Checking…":"Check delivery"}</button></div>
 {error&&<p className="footnote danger" role="status">{error}</p>}
 {!data&&!error?<p className="footnote">Checking received email…</p>:streams.length?streams.map((s:any)=>{
  const receipt=data.receipts?.find((r:any)=>r.streamId===s.id),result=receipt?.result;
  const recent=Number.isFinite(Date.parse(s.receivedAt))&&Date.now()-Date.parse(s.receivedAt)<15*60000;
  return <div className="ingest-delivery-row" key={s.id}><div><span className="pill"><CheckCircle2 size={13}/> {recent&&!error?"Receiving updates":"Delivery confirmed"}</span><h3>{s.provider==="google"?"Gmail":"Outlook"} <span>via n8n</span></h3><p className="ingest-delivery-account">{s.account}</p><p>Last accepted {deliveryTime(s.receivedAt)} · Phoenix</p>{result&&<p>{result.applied===0&&result.deferred===0?"Last batch: no changes to apply":`Last batch: ${result.applied??0} changes applied · ${result.deferred??0} held for review`}</p>}{s.reviewCount>0&&<p className="danger">{s.reviewCount} changes held for review</p>}</div><div className="ingest-delivery-count"><strong>{s.records.toLocaleString()}</strong><span>imported emails</span><small>{s.sequence||"—"} accepted batches</small></div></div>;
 }):<p className="footnote">{error&&!data?"Open Connections to inspect intake status.":"No published email deliveries yet. An initial load must be accepted before imported emails appear."}</p>}
 <div className="ingest-delivery-actions"><button className="primary" onClick={onInbox}>Review emails</button><button className="secondary" onClick={onConnections}>View delivery details</button></div><p className="footnote">The count covers imported records, including emails you have removed from review. A successful no-change batch confirms delivery too. It does not verify every account or guarantee future runs.</p></section>;
}
