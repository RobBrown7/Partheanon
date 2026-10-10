export function overlapDetails(a,b){
 const starts=[Date.parse(a.start),Date.parse(b.start)],ends=[Date.parse(a.end),Date.parse(b.end)];
 if([...starts,...ends].some(v=>!Number.isFinite(v)))return null;
 const start=Math.max(...starts),end=Math.min(...ends);
 if(end<=start)return null;
 const from=Math.min(...starts),to=Math.max(...ends),span=to-from;
 return {start,end,minutes:Math.round((end-start)/60000),bars:starts.map((s,i)=>({left:(s-from)/span*100,width:(ends[i]-s)/span*100})),highlight:{left:(start-from)/span*100,width:(end-start)/span*100}};
}
