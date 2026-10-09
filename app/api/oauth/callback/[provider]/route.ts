import {authorize} from "../../../../../lib/api";
import {completeOAuth,providerSchema} from "../../../../../lib/direct-oauth";
export const dynamic="force-dynamic";
export async function GET(r:Request,{params}:{params:Promise<{provider:string}>}){let outcome="failed";try{const owner=await authorize(r,false),provider=providerSchema.parse((await params).provider),u=new URL(r.url);if(u.searchParams.has("error"))outcome="declined";else{await completeOAuth(owner,provider,u.searchParams.get("state")||"",u.searchParams.get("code")||"");outcome="connected";}}catch{outcome="failed";}return new Response(null,{status:303,headers:{Location:`/?view=connections&direct=${outcome}`,"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});}
