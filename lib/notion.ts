import { connectorsForRequest } from "./connectors";
import { readState, saveSnapshot } from "./repository";
import { safeUrl } from "./planning.mjs";
const pageKey=(v:string)=>{const matches=v.replace(/-/g,"").match(/[a-f0-9]{32}/gi);return matches?.at(-1)?.toLowerCase()||v;};
const cid="asdk_app_69c18c28f1188191bf5b8445c4ab0a2e";
export async function loadNotion(owner:string,batch?:number){
 const api=connectorsForRequest(),context=await api.getContext();let lastResult:any;
 const hints=context.status==="success"?context.connectors.find(c=>c.connectorId===cid)?.tools:null;
 const call=async(action:string,args:Record<string,any>={})=>{
  const selected=hints?.find(t=>t.actionName.replace(/-/g,"_")===action)?.actionName||action;
  lastResult=await api.invoke(cid,selected,args);if(lastResult.status!=="success")throw new Error(lastResult.message||"Notion read was not confirmed");
  if(lastResult.result.structuredContent!==undefined&&lastResult.result.structuredContent!==null)return lastResult.result.structuredContent;
  for(const c of lastResult.result.content){if(c.type==="text"&&typeof c.text==="string"){try{const value=JSON.parse(c.text);if(value!==null)return value;}catch{}}}throw new Error("Notion did not return structured content");
 };
 try {
  if(batch!==undefined){
   const previous=(await readState(owner)).sources.notion;if(!previous)throw new Error("Index Notion before reading pages");
   const candidates=previous.candidates||[],documents=[...(previous.documents||[])],notes=[...(previous.notes||[])];
   const priority=(p:any)=>/meet|mtg|follow.?up|1.?on.?1|catchup|standup/i.test(p.title||"")?0:1;
  {const i=batch*4;await Promise.all(candidates.slice(i,i+4).map(async (p:any)=>{try{const fetched=await call("fetch",{id:p.url,include_transcript:true}),text=typeof fetched.text==="string"?fetched.text:"";
   let props:any={};try{props=JSON.parse(text.match(/<properties>\s*([\s\S]*?)\s*<\/properties>/)?.[1]||"{}");}catch{}
   const content=text.match(/<content>([\s\S]*?)<\/content>/)?.[1]||"";
   const summary=content.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]||content.split(/<transcript/)[0];
   const clean=(v:string)=>v.replace(/\[\^[^\]]*\]/g,"").replace(/<[^>]+>/g,"").replace(/\[([^\]]+)\]\([^)]*\)/g,"$1").replace(/\*\*/g,"").replace(/\\([\$~])/g,"$1").trim();
   const actions=[...new Set(summary.split("\n").filter((line:string)=>/^\s*-\s*\[ \]/.test(line)).map((line:string)=>clean(line.replace(/^\s*-\s*\[ \]\s*/,""))))];
   const meeting=/<meeting-notes|Meeting Notes/i.test(text)||priority(p)===0;
   const lineage=clean(text.match(/<ancestor-path>([\s\S]*?)<\/ancestor-path>/)?.[1]||"");
   const lane=/Unity|UHI|EBMC|Rent Cafe/i.test(fetched.title+" "+lineage+" "+summary.slice(0,1000))?"Unity Homes":/SHP|Sleep in Heavenly/i.test(fetched.title+" "+props.Teamspace)?"SHP Beds":/Athena|Tessera|STUDi|GWS/i.test(fetched.title+" "+props.Teamspace)?"AthenaWorx":"Personal";
   const propSummary=Object.entries(props).filter(([k])=>["Status","Priority","Notes","Next step","Description","Teamspace","date:Due:start","date:Due date:start","Estimate (hours)"].includes(k)).map(([k,v])=>`${k.replace(/^date:|:start$/g,"")}: ${typeof v==="string"?v:JSON.stringify(v)}`).join("\n");
   documents.push({fetchedAt:new Date().toISOString(),id:fetched.id||new URL(p.url).pathname,title:fetched.title||p.title||"Untitled page",url:safeUrl(fetched.url||p.url),kind:meeting?"meeting":"page",lane,summary:clean(summary||propSummary).slice(0,12000),actions:actions.slice(0,80),properties:props,sourceEditedAt:fetched.page_last_edited_at||props["Last Edited"]||props["Last updated time"]||null,truncated:!!fetched.truncated||text.includes("<truncated"),unknownBlocks:fetched.unknown_block_count||0});
  }catch(e){notes.push(`${p.title||"Page"}: ${e instanceof Error?e.message:"Read failed"}`);}}));}

   const merged=[...new Map(documents.map((d:any)=>[pageKey(d.id||d.url),d])).values()];const payload={...previous,documents:merged,notes:notes.filter((n:string)=>!n.includes("pages read of")&&!n.includes("cached source pages;")).slice(0,90).concat(`${merged.length} cached source pages; ${previous.pages.length} indexed pages and databases seen across scans. Database rows outside these listings are not yet indexed.`)};
   const updatedAt=await saveSnapshot(owner,"notion",payload);return {status:"success",payload:{...payload,updatedAt},nextBatch:(batch+1)*4<candidates.length?batch+1:null};
  }
  const teams=await call("notion_get_teams");const notes=["Current connected Notion workspace only. Teamspaces are not separate workspaces.","This first index browses recent, private, shared, and favorite pages. It is not a complete recursive database scan."];
  const pages:any[]=[];let limited=false;
  for(const action of ["notion_list_recent_pages","notion_list_private_pages","notion_list_shared_pages","notion_list_favorite_pages"]){let cursor:string|undefined;for(let n=0;n<3;n++){const r=await call(action,{limit:200,...(cursor?{cursor}:{})});pages.push(...(r.results||[]));cursor=r.next_cursor||r.nextCursor||r.cursor;if(!cursor)break;if(n===2)limited=true;}}
  const cached=(await readState(owner)).sources.notion;
  const unique=[...new Map([...(cached?.pages||[]),...(cached?.documents||[]).map((d:any)=>({url:d.url,title:d.title,type:"page"})),...pages].filter(p=>safeUrl(p.url)).map(p=>[pageKey(p.url),p])).values()];
  const priority=(p:any)=>/meet|mtg|follow.?up|1.?on.?1|catchup|standup/i.test(p.title||"")?0:/task|action|complete|review|resolve|schedule|investigate|activate|set up/i.test(p.title||"")?1:2;
  const documents:any[]=[...new Map((cached?.documents||[]).map((d:any)=>[pageKey(d.id||d.url),{...d,fetchedAt:d.fetchedAt||cached.updatedAt}])).values()];
  const candidates=unique.filter(p=>p.type==="page"&&!documents.some(d=>pageKey(d.id||d.url)===pageKey(p.url)&&Date.now()-Date.parse(d.fetchedAt)<300000)).sort((a,b)=>priority(a)-priority(b));
  const payload={account:"Current Notion connection",events:[],emails:[],partial:true,notes:[...notes,...(limited?["Listing reached the pagination limit."]:[]),`${documents.length} cached source pages; ${unique.length} indexed pages and databases seen across scans. Database rows outside these listings are not yet indexed.`],teamspaces:[...(teams.joinedTeams||[]),...(teams.otherTeams||[])].map(t=>({id:t.id,name:t.name})),pages:unique,documents,candidates};const updatedAt=await saveSnapshot(owner,"notion",payload);return {status:"success",payload:{...payload,updatedAt},nextBatch:candidates.length?0:null};
 }catch(e){return {status:lastResult?.status==="success"?"upstream_error":lastResult?.status||"upstream_error",message:e instanceof Error?e.message:"Notion unavailable",retryAfterMs:lastResult?.retryAfterMs};}
}
