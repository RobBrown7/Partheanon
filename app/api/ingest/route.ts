import {authenticateIngest,acceptIngest} from "../../../lib/ingest-store";
import {readIngestJson,IntakeError} from "../../../lib/ingest-contract.mjs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
export async function POST(request:Request){try{const key=await authenticateIngest(request);const result=await acceptIngest(key,await readIngestJson(request));return Response.json(result,{headers});}catch(e){if(e instanceof IntakeError)return Response.json({ok:false,error:{code:e.code,message:e.message}},{status:e.status,headers:{...headers,...(e.status===429?{"Retry-After":"60"}:{})}});return Response.json({ok:false,error:{code:"intake_unavailable",message:"Delivery could not be committed. Retry the exact batch; no successful acknowledgment was issued."}},{status:503,headers});}}
