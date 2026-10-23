export function sourceSyncEnabled(info,internalMailCalendarSync){
 return info?.kind==="notes"||internalMailCalendarSync===true&&["calendar","mail"].includes(info?.kind);
}
