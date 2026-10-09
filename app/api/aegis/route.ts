import {authorize,json,failure} from "../../../lib/api";
import {askAegis,applyAegis} from "../../../lib/aegis";
import {CHAT_REQUEST_BYTE_LIMIT} from "../../../lib/chat-messages.mjs";
export const dynamic="force-dynamic";
export async function POST(r:Request){try{const owner=await authorize(r);const text=await r.text();if(new TextEncoder().encode(text).length>CHAT_REQUEST_BYTE_LIMIT)throw new Error("This conversation is too large to send. Send a shorter message or start a new conversation.");let body:any;try{body=JSON.parse(text);}catch{throw new Error("Aegis could not read the request. Please try sending your message again.");}return json(body?.action==="apply"?await applyAegis(owner,body.id):await askAegis(owner,body?.messages));}catch(e){return failure(e);}}
