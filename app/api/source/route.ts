import { authorize,json,failure } from "../../../lib/api";
import { readState } from "../../../lib/repository";
import { connectionSources,type Connection } from "../../../lib/connections";
import { loadNotion } from "../../../lib/notion";
import { loadSource } from "../../../lib/sources";
import { chatGPTSignInPath } from "../../chatgpt-auth";
export const dynamic="force-dynamic";
export async function POST(r:Request){try{
 const owner=await authorize(r),b:any=await r.json();
 if(typeof b.source!=="string"||!Number.isInteger(b.offset)||b.offset<0||b.offset>56)throw new Error("Invalid source window");
 if(b.batch!==undefined&&(!Number.isInteger(b.batch)||b.batch<0||b.batch>100))throw new Error("Invalid Notion batch");
 let result;
 if(["google","outlook","gmail","unityMail","notion"].includes(b.source)){result=b.source==="notion"?await loadNotion(owner,b.batch):await loadSource(owner,b.source,b.offset);}
 else {const state=await readState(owner);const c=state.connections.find(c=>Object.hasOwn(connectionSources(c as Connection),b.source));if(!c)throw new Error("Connection not available");const service=b.source.split(":")[2] as "google"|"outlook"|"gmail"|"unityMail";result=await loadSource(owner,service,b.offset,{account:c.account,lane:c.lane,snapshotKey:b.source});}
 return json({...result,chatGPTSignInPath:chatGPTSignInPath("/?view=connections")});
 }catch(e){return failure(e);}}
