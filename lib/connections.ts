export const connectionProviders={google:"Google / Google Workspace",microsoft:"Microsoft / Outlook",notion:"Notion workspace",apple:"Apple / iCloud"};
export type Connection={id:string;provider:keyof typeof connectionProviders;account:string;lane:string;calendar:boolean;mail:boolean;createdAt?:string};
export type SourceInfo={name:string;account:string;kind:"calendar"|"mail"|"notes";lane:string;connectionId?:string};
export const baseSourceInfo:Record<string,SourceInfo>={notion:{name:"Notion notes & tasks",account:"Current Notion connection",kind:"notes",lane:"Personal"},google:{name:"Google Calendar",account:"rob.k.brown.7@gmail.com",kind:"calendar",lane:"Personal"},outlook:{name:"Unity Homes calendar",account:"rbrown@unityhomes.org",kind:"calendar",lane:"Unity Homes"},gmail:{name:"Gmail",account:"rob.k.brown.7@gmail.com",kind:"mail",lane:"Personal"},unityMail:{name:"Unity Homes email",account:"rbrown@unityhomes.org",kind:"mail",lane:"Unity Homes"}};
export function connectionSources(c:Connection):Record<string,SourceInfo>{
 if(!["google","microsoft"].includes(c.provider))return {};
 return Object.fromEntries([...(c.calendar?[c.provider==="google"?"google":"outlook"]:[]),...(c.mail?[c.provider==="google"?"gmail":"unityMail"]:[])].map(service=>[`account:${c.id}:${service}`,{name:c.provider==="google"?(service==="google"?"Google Calendar":"Gmail"):(service==="outlook"?"Outlook Calendar":"Outlook Email"),account:c.account,lane:c.lane,kind:service==="google"||service==="outlook"?"calendar":"mail",connectionId:c.id}]));
}
export function allSourceInfo(connections:Connection[]){return {...baseSourceInfo,...Object.assign({},...connections.map(connectionSources))} as Record<string,SourceInfo>;}
export const suggestedConnections:Omit<Connection,"id">[]=[
 {provider:"google",account:"robert.brown@shpbeds.org",lane:"SHP Beds",calendar:true,mail:true},
 {provider:"google",account:"aegis@athenaworx.io",lane:"AthenaWorx",calendar:true,mail:true},
 {provider:"google",account:"rob@athenaworx.io",lane:"AthenaWorx",calendar:true,mail:true},
 {provider:"microsoft",account:"rob.k.brown@outlook.com",lane:"Personal",calendar:true,mail:true},
 {provider:"microsoft",account:"jrblaster@msn.com",lane:"Personal",calendar:true,mail:true},
 {provider:"apple",account:"jrblaster@me.com",lane:"Personal",calendar:true,mail:true}
];
