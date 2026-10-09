import {authorize,json,failure} from "../../../lib/api";
import {saveClient,startOAuth,directStatus,disconnectDirect} from "../../../lib/direct-oauth";
export const dynamic="force-dynamic";
export async function GET(r:Request){try{return json(await directStatus(await authorize(r)));}catch(e){return failure(e);}}
export async function POST(r:Request){try{const owner=await authorize(r);if(Number(r.headers.get("content-length")||0)>10000)throw new Error("Request too large");const b:any=await r.json();return json(b.action==="configure"?await saveClient(owner,b.value):b.action==="connect"?await startOAuth(owner,b.value):b.action==="disconnect"?await disconnectDirect(owner,b.value):(()=>{throw new Error("Unknown connection action");})());}catch(e){return failure(e);}}
