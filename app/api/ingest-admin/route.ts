import {authorize,json,failure} from "../../../lib/api";
import {ingestOverview,issueIngestKey,revokeIngestKey} from "../../../lib/ingest-store";
export const dynamic="force-dynamic";
export async function GET(r:Request){try{return json(await ingestOverview(await authorize(r)));}catch(e){return failure(e);}}
export async function POST(r:Request){try{const owner=await authorize(r);const body:any=await r.json();if(body.action==="create")return json(await issueIngestKey(owner,body.value));if(body.action==="revoke"){await revokeIngestKey(owner,body.id);return json({revoked:true});}throw new Error("Unknown intake administration action");}catch(e){return failure(e);}}
