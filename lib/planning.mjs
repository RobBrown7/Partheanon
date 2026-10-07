export const ZONE = "America/Phoenix";
/** @param {string|number|Date} d */
export function dateKey(d = new Date()) { return new Intl.DateTimeFormat("en-CA", {timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(d)); }
export function dayAt(key, hour=0) { return new Date(`${key}T${String(Math.floor(hour)).padStart(2,"0")}:${hour%1?"30":"00"}:00-07:00`).getTime(); }
export function plusDays(key,n) { return dateKey(dayAt(key,12)+n*86400000); }
export function union(intervals) {
 const out=[]; for (const [a,b] of intervals.filter(([a,b])=>Number.isFinite(a)&&b>a).sort((a,b)=>a[0]-b[0])) {
  const last=out[out.length-1]; if(last&&a<=last[1])last[1]=Math.max(last[1],b);else out.push([a,b]);
 } return out;
}
export function busyIntervals(events,blocks=[],buffer=15) {
 return [...events.filter(e=>e.busy).map(e=>[Date.parse(e.start)-buffer*60000,Date.parse(e.end)+buffer*60000]), ...blocks.map(b=>[Date.parse(b.start),Date.parse(b.end)])];
}
export function freeWindows(events,blocks=[],prefs={startHour:9,endHour:17},from=Date.now(),to=from+14*86400000) {
 const busy=union(busyIntervals(events,blocks)),out=[];let key=dateKey(from);
 for(let n=0;n<15;n++,key=plusDays(key,1)) {
  const dow=new Date(dayAt(key,12)).getUTCDay();if(dow===0||dow===6)continue;
  const end=Math.min(dayAt(key,prefs.endHour),to);let cursor=Math.max(dayAt(key,prefs.startHour),from);
  if(end<=cursor)continue;
  for(const [a,b] of busy) {if(b<=cursor||a>=end)continue;if(a>cursor)out.push([cursor,Math.min(a,end)]);cursor=Math.max(cursor,b);if(cursor>=end)break;}
  if(cursor<end)out.push([cursor,end]);
 }return out;
}
export function collisions(events,blocks=[]) {
 const list=[...events.filter(e=>e.busy),...blocks.map(b=>({...b,busy:true,source:"focus"}))].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));const pairs=[];
 for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length&&Date.parse(list[j].start)<Date.parse(list[i].end);j++) {
  if(list[i].uid&&list[i].uid===list[j].uid)continue;
  pairs.push({a:list[i],b:list[j]});
 }return pairs;
}
export function analyze(tasks,events,blocks,prefs,now=Date.now()) {
 const active=tasks.filter(t=>t.status!=="done").sort((a,b)=>a.deadline.localeCompare(b.deadline));
 const risks=[];let demand=0;
 for(const t of active) {
  demand+=t.minutes;const due=dayAt(t.deadline,17);const cap=freeWindows(events,[],prefs,now,Math.min(due,now+14*86400000)).reduce((s,[a,b])=>s+(b-a)/60000,0);
  if(due<now)risks.push({task:t,reason:"Deadline has passed"});
  else if(due<=now+14*86400000&&demand>cap)risks.push({task:t,reason:`${Math.round(demand-cap)} minutes short before this deadline`});
 }
 const free=freeWindows(events,blocks,prefs,now).reduce((s,[a,b])=>s+(b-a)/60000,0);
 return {risks,conflicts:collisions(events,blocks).filter(c=>Date.parse(c.a.end)>now),freeMinutes:Math.round(free),demandMinutes:active.reduce((s,t)=>s+t.minutes,0)};
}
export function suggest(task,events,blocks,prefs,now=Date.now()) {
 const booked=blocks.filter(b=>b.taskId===task.id&&Date.parse(b.end)>now).reduce((s,b)=>s+Math.max(0,Date.parse(b.end)-Math.max(now,Date.parse(b.start)))/60000,0);
 const need=Math.max(0,task.minutes-booked);if(need===0)return [];
 let remaining=need;const proposed=[];
 for(const [a,b] of freeWindows(events,blocks,prefs,Math.ceil((now+5*60000)/(15*60000))*15*60000,Math.min(dayAt(task.deadline,17),now+14*86400000))) {
  if(b-a<15*60000)continue;const m=Math.min(remaining,120,(b-a)/60000);if(m<15)continue;
  proposed.push({id:crypto.randomUUID(),taskId:task.id,title:task.title,start:new Date(a).toISOString(),end:new Date(a+m*60000).toISOString()});remaining-=m;if(remaining<=0||proposed.length>=8)break;
 }return proposed;
}
export function safeUrl(value) { try {const u=new URL(value);return u.protocol==="https:"?u.href:"";}catch{return "";} }
export function eventTime(value) {
 if(typeof value==="string")return /^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(dayAt(value)).toISOString():value;
 if(!value)return null;const d=value.dateTime||value.date_time||value.date;if(!d)return null;
 if(/^\d{4}-\d{2}-\d{2}$/.test(d))return new Date(dayAt(d)).toISOString();
 if(/[Zz]$|[+-]\d\d:\d\d$/.test(d))return d;
 if(value.timeZone==="UTC"||value.time_zone==="UTC")return d+"Z";
 if(value.timeZone==="US Mountain Standard Time"||value.timeZone===ZONE)return d+"-07:00";
 return null; // Never guess a timezone for a scheduling decision.
}
export function normalizeEvents(raw,source,calendar) {
 return (raw.events||raw.value||[]).filter(e=>e.status!=="cancelled"&&!e.is_cancelled&&e.response_status?.response!=="declined"&&e.my_response_status!=="declined").map(e=>({
  id:`${source}:${calendar.id}:${e.id}`,uid:e.i_cal_u_id||e.iCalUID||null,title:e.summary||e.subject||"Untitled event",start:eventTime(e.start),end:eventTime(e.end),
  source,calendar:calendar.summary||calendar.name,lane:source==="google"?"Personal":"Unity Homes",allDay:!!(e.is_all_day||e.start?.date||typeof e.start==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(e.start)),
  busy:e.transparency!=="transparent"&&e.show_as!=="free",url:safeUrl(e.display_url||e.url||e.web_link)
 })).filter(e=>e.start&&e.end&&Number.isFinite(Date.parse(e.start))&&Date.parse(e.end)>Date.parse(e.start));
}
export function normalizeEmails(raw,source) {
 return (raw.emails||raw.value||[]).map(e=>({id:`${source}:${e.id}`,title:e.subject||"(No subject)",sender:e.from_||e.sender?.emailAddress?.name||e.sender?.emailAddress?.address||"Unknown sender",snippet:e.snippet||e.bodyPreview||"",date:e.email_ts||e.receivedDateTime,source,lane:source==="gmail"?"Personal":"Unity Homes",url:safeUrl(e.display_url||e.web_link),unread:e.labels?.includes("UNREAD")||e.isRead===false,starred:e.labels?.includes("STARRED")||e.importance==="high"})).map(e=>({...e,signal:e.starred?"Flagged":/deadline|due\b|action required|please (review|send|confirm|approve)|by (monday|tuesday|wednesday|thursday|friday)/i.test(e.title+" "+e.snippet)?"Possible action":"Recent mail"}));
}
