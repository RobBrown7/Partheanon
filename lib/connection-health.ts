import {connectorsForRequest} from "./connectors";
const services=[
 {id:"gmail",name:"Gmail",connectorId:"connector_2128aebfecb84f64a069897515042a44",settingsUrl:"https://chatgpt.com/settings/plugins-settings/plugin_connector_1p_95d39881713c8191931482a62d6edff9"},
 {id:"google",name:"Google Calendar",connectorId:"connector_947e0d954944416db111db556030eea6",settingsUrl:"https://chatgpt.com/settings/plugins-settings/plugin_connector_1p_f8509de903288191b14a160c6c5d20b0"},
 {id:"unityMail",name:"Outlook Email",connectorId:"connector_4aaab2856305417b993eca9a216aaf6e",settingsUrl:"https://chatgpt.com/settings/plugins-settings/plugin_connector_1p_6bcb5879c73c819196abc70016166099"},
 {id:"outlook",name:"Outlook Calendar",connectorId:"connector_e6a7394682e24467ac68c60696f275a4",settingsUrl:"https://chatgpt.com/settings/plugins-settings/plugin_connector_1p_fd0f4f41caa88191a9456514bbffa06d"}
];
export async function connectionHealth(){
 const api=connectorsForRequest(),context=await api.getContext();
 const results=await Promise.allSettled(services.map(async(service)=>{
  const hint=context.status==="success"?context.connectors.find(c=>c.connectorId===service.connectorId):null;
  const profileTool=hint?.tools?.find(t=>t.actionName.replace(/-/g,"_")==="get_profile");
  const result=await api.invoke(service.connectorId,profileTool?.actionName||"get_profile",{});
  const base={id:service.id,name:service.name,settingsUrl:service.settingsUrl,accountSelector:profileTool?Object.hasOwn((profileTool.inputSchema.properties||{}) as object,"link_id"):null};
  if(result.status!=="success")return {...base,status:result.status,message:result.message,retryAfterMs:result.retryAfterMs};
  let profile:any=result.result.structuredContent;
  if(!profile){const text=result.result.content.find(c=>c.type==="text"&&typeof c.text==="string");if(text)try{profile=JSON.parse(String(text.text));}catch{}}
  const account=typeof profile?.email==="string"?profile.email.trim():"";
  return account?{...base,status:"success",account}:{...base,status:"upstream_error",message:"The provider returned no account identity. Access is not verified."};
 }));
 return {checkedAt:new Date().toISOString(),contextStatus:context.status,services:results.map((r,i)=>r.status==="fulfilled"?r.value:{id:services[i].id,name:services[i].name,settingsUrl:services[i].settingsUrl,status:"upstream_error",message:"The account check did not complete."})};
}
