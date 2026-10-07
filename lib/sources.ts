import { connectorsForRequest } from "./connectors";
import { normalizeEvents,normalizeEmails,dateKey,plusDays,dayAt } from "./planning.mjs";
import { saveSnapshot } from "./repository";
const connectors={google:"connector_947e0d954944416db111db556030eea6",outlook:"connector_e6a7394682e24467ac68c60696f275a4",gmail:"connector_2128aebfecb84f64a069897515042a44",unityMail:"connector_4aaab2856305417b993eca9a216aaf6e"};
const unityLink="link_687c5291e29081918d1a6c0d151e7d47";
export async function loadSource(owner:string,source:keyof typeof connectors,offset:number,target?:{account:string;lane:string;snapshotKey:string}){
 const api=connectorsForRequest(),cid=connectors[source];let lastResult:any;
 const context=await api.getContext();const toolHints=context.status==="success"?context.connectors.find(c=>c.connectorId===cid)?.tools:null;
 const call=async(action:string,args:Record<string,any>={})=>{
  const hint=toolHints?.find(t=>t.actionName.replace(/-/g,"_")===action);
  const selectedAction=hint?.actionName||action;
  if(source==="unityMail"&&hint&&args.link_id&&!(hint.inputSchema.properties as Record<string,unknown>|undefined)?.link_id){const {link_id,...rest}=args;args=rest;}
  lastResult=await api.invoke(cid,selectedAction,args);if(lastResult.status!=="success")throw new Error(lastResult.message||"Source unavailable");
  let data=lastResult.result.structuredContent;
  if(data===undefined||data===null){const content=lastResult.result.content.find((c:any)=>c.type==="text"&&typeof c.text==="string");if(content){try{data=JSON.parse(content.text);}catch{throw new Error("Source returned an unreadable result");}}}
  if(data===undefined||data===null)throw new Error("Source did not return structured data");return data;
 };
 try {
  const profile=await call("get_profile",source==="unityMail"&&!target?{link_id:unityLink}:{});
  const expected=target?.account||((source==="google"||source==="gmail")?"rob.k.brown.7@gmail.com":"rbrown@unityhomes.org");
  if(profile.email?.toLowerCase()!==expected)throw new Error(`The connected app currently exposes ${profile.email||"an unknown account"}. This connection needs ${expected}. Open Manage accounts in ChatGPT, select that account, then verify again.`);
  let payload:any={account:profile.email,events:[],emails:[],partial:false,notes:[]};
  if(source==="google"||source==="outlook") {
   const key=plusDays(dateKey(),offset),timeMin=new Date(dayAt(key)).toISOString(),timeMax=new Date(dayAt(plusDays(key,14))).toISOString();
   const calendars=await call("list_calendars",source==="google"?{max_results:100}:{});
   const selected=(source==="google"?calendars.calendars.filter((c:any)=>c.primary||c.summary==="Family"):calendars.value.filter((c:any)=>c.is_default_calendar||c.name?.startsWith("iCloud"))).slice(0,5);
   if(!selected.length)throw new Error("No eligible calendars found");
   for(const calendar of selected){
    try {
     let token: string|undefined;
     for(let page=0;page<(source==="google"?4:1);page++) {
      const data=await call(source==="google"?"search_events":"list_events",source==="google"?{calendar_id:calendar.id,time_min:timeMin,time_max:timeMax,timezone_str:"America/Phoenix",max_results:100,...(token?{next_page_token:token}:{})}:{calendar_id:calendar.id,start_datetime:timeMin,end_datetime:timeMax,top:250});
      const raw=data.events||data.value||[];const events=normalizeEvents(data,source,calendar);payload.events.push(...events);
      if(events.length<raw.filter((e:any)=>e.status!=="cancelled"&&!e.is_cancelled).length)payload.notes.push(`${calendar.summary||calendar.name}: some events omitted (declined or unrecognized timestamps).`);
      token=data.next_page_token;if(source==="outlook"&&data.next_link){payload.partial=true;payload.notes.push(`${calendar.name}: first 250 events shown.`);}if(!token)break;if(page===3){payload.partial=true;payload.notes.push(`${calendar.summary}: first 400 events shown.`);}
     }
    }catch(e){payload.partial=true;payload.notes.push(`${calendar.summary||calendar.name}: ${e instanceof Error?e.message:"unavailable"}`);}
   }
   payload.events=[...new Map(payload.events.map((e:any)=>[e.id,e])).values()];payload.windowStart=timeMin;payload.windowEnd=timeMax;
  }else {
   const data=await call(source==="gmail"?"search_emails":"list_messages",source==="gmail"?{query:"in:inbox -category:promotions -category:social newer_than:14d",max_results:40}:{...(!target?{link_id:unityLink}:{}),folder_id:"inbox",order_by:"receivedDateTime desc",top:40});
   payload.emails=normalizeEmails(data,source);payload.partial=!!(data.next_page_token||data.has_more||data.next_link);payload.notes=["Latest 40 inbox candidates. Importance signals are rules, not confirmed commitments."];
  }
  if(target){payload.events=payload.events.map((e:any)=>({...e,id:`${target.snapshotKey}:${e.id}`,lane:target.lane}));payload.emails=payload.emails.map((e:any)=>({...e,id:`${target.snapshotKey}:${e.id}`,lane:target.lane}));}
  const updatedAt=await saveSnapshot(owner,target?.snapshotKey||source,payload);return {status:"success",payload:{...payload,updatedAt}};
 }catch(e){return {status:lastResult?.status==="success"?"upstream_error":lastResult?.status||"upstream_error",message:e instanceof Error?e.message:"Source unavailable",retryAfterMs:lastResult?.retryAfterMs,result:lastResult?.result};}
}
