export function dedupePublishedFocus(sources,blocks,commands,config){
 if(!config)return sources;
 const matched=commands.filter(c=>c.state==='confirmed'&&blocks.some(b=>b.id===c.blockId&&b.start===c.start&&b.end===c.end));
 return Object.fromEntries(Object.entries(sources).map(([key,source])=>{
  if(!source.events)return [key,source];
  const events=source.events.filter(e=>!matched.some(c=>e.recordKey===`google|${config.account}|calendar|${config.calendarId}|${c.eventId}`&&Date.parse(e.start)===Date.parse(c.start)&&Date.parse(e.end)===Date.parse(c.end)));
  return [key,events.length===source.events.length?source:{...source,events,notes:[...(source.notes||[]),'Published focus events appear through their matching protected work blocks.']}];
 }));
}
