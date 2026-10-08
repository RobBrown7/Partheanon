import {authorize,json,failure} from "../../../lib/api";
import {askAegis,applyAegis} from "../../../lib/aegis";
export const dynamic="force-dynamic";
export async function POST(r:Request){try{const owner=await authorize(r);if(Number(r.headers.get("content-length")||0)>70000)throw new Error("Message too large");const body:any=await r.json();return json(body.action==="apply"?await applyAegis(owner,body.id):await askAegis(owner,body.messages));}catch(e){return failure(e);}}
