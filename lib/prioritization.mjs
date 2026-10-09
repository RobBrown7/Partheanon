import {downstream,prerequisites} from './task-dependencies.mjs';
import {analyze,dateKey,dayAt,freeWindows} from './planning.mjs';
export const impactLabels={unknown:'Consequence not recorded',people:'Someone cannot move forward',service:'Service or operations disrupted',financial:'Financial loss or missed obligation',safety:'Safety or compliance exposure',opportunity:'Personal or strategic opportunity lost'};
const impactWeight={unknown:0,people:40,service:45,financial:55,safety:80,opportunity:25};
// A transparent heuristic, not an AI judgment. Consequences are explicitly entered by the user.
export function prioritize(tasks,events,blocks,prefs,now=Date.now()){
 const baseDomain=t=>t.lifeHealthSafety?2:t.securityPrivacy?1:0;
 const domain=t=>{let tier=baseDomain(t),parent=t.parentId;const seen=new Set([t.id]);while(parent&&!seen.has(parent)){seen.add(parent);const p=tasks.find(t=>t.id===parent);if(!p)break;tier=Math.max(tier,baseDomain(p));parent=p.parentId;}return tier;};
 const ownImportant=t=>domain(t)>0?true:t.important??(t.peopleBlocked||(t.delayImpact&&t.delayImpact!=='unknown')?true:null);
 const active=tasks.filter(t=>t.status!=='done'),riskIds=new Set(analyze(tasks,events,blocks,prefs,now).risks.map(r=>r.task.id));
 const next=active.filter(t=>t.status!=='waiting'&&t.minutes>0&&!prerequisites(tasks,t).length).map(task=>{
  const opens=downstream(tasks,task.id),inherited=opens.reduce((highest,t)=>Math.max(highest,domain(t)),0);
  let tier=Math.max(domain(task),inherited),important=ownImportant(task),deadline=opens.reduce((due,t)=>t.deadline<due?t.deadline:due,task.deadline),parent=task.parentId;const seen=new Set([task.id]);
  while(parent&&!seen.has(parent)){seen.add(parent);const p=tasks.find(t=>t.id===parent);if(!p)break;if(p.status!=='done'){if(p.deadline<deadline)deadline=p.deadline;tier=Math.max(tier,domain(p));if(ownImportant(p)===true)important=true;}parent=p.parentId;}
  const due=dayAt(deadline,17),days=Math.ceil((due-now)/86400000),past=due<now,reasons=[];
  const windows=freeWindows(events,blocks.filter(b=>b.taskId!==task.id),prefs,now,Math.min(due,now+14*86400000));
  const capacity=windows.reduce((s,[a,b])=>s+(b-a)/60000,0),slack=capacity-task.minutes;
  const todayWindows=windows.filter(([a])=>dateKey(a)===dateKey(now)),fit=todayWindows.some(([a,b])=>(b-a)/60000>=Math.min(task.minutes,60));
  const underway=blocks.some(b=>b.taskId===task.id&&Date.parse(b.start)<=now&&Date.parse(b.end)>now);
  const protectedToday=blocks.some(b=>b.taskId===task.id&&Date.parse(b.end)>now&&dateKey(b.start)===dateKey(now));
  if(opens.some(t=>ownImportant(t)===true))important=true;
  if(tier>0)important=true;
  const urgent=past||days<=2||(!past&&days<=14&&(slack<0||riskIds.has(task.id)));
  const quadrant=important===null?'Clarify importance':important?urgent?'Act now':'Protect time':urgent?'Delegate or triage':'Reconsider';
  const pinned=prefs.focusTaskId===task.id;
  if(tier===2)reasons.push(domain(task)===2?'Life / health / safety protection':'Enables life / health / safety work');
  else if(tier===1)reasons.push(domain(task)===1?'Security / privacy protection':'Enables security / privacy work');
  if(opens.length)reasons.push(`Unlocks ${opens.length} open commitment${opens.length===1?'':'s'} through recorded dependencies`);
  if(pinned)reasons.push('Your next choice within protection groups');
  if(task.delayImpact&&task.delayImpact!=='unknown')reasons.push(impactLabels[task.delayImpact]);
  if(task.peopleBlocked)reasons.push(task.stakeholder?`${task.stakeholder} is held up`:'Someone is held up');
  if(past)reasons.push('Deadline passed — confirm the next step or reset it');
  else if(days<=2)reasons.push('Due within two days');else if(days<=7)reasons.push('Due within a week');
  if(deadline!==task.deadline)reasons.push(`Related commitments need this by ${deadline}`);
  if(!past&&days<=14&&slack<0)reasons.push('Remaining work exceeds time available before due date');
  else if(riskIds.has(task.id)&&!past)reasons.push('Competing deadlines leave too little room');
  if(underway)reasons.push('Protected work block is underway');else if(protectedToday)reasons.push('Work time is protected today');
  if(task.status==='doing')reasons.push('Already in progress');
  if(fit)reasons.push('A useful work session fits today');
  if(task.parentId)reasons.push('Moves a parent commitment toward completion');
  if(!task.delayImpact||task.delayImpact==='unknown')reasons.push('Add the consequence of delay to sharpen the order');
  const pressure=past?65:days<=2?55:days<=7?30:days<=14?15:0;
  const score=(important===true?30:0)+Math.min(opens.length,10)*8+(impactWeight[task.delayImpact]||0)+(task.peopleBlocked&&task.delayImpact!=='people'?40:0)+pressure+(!past&&days<=14&&(slack<0||riskIds.has(task.id))?25:0)+(task.status==='doing'?8:0)+(protectedToday?10:0)+(fit?3:0)+(task.parentId?5:0);
  return {task,tier,directTier:baseDomain(task),inheritedFromParent:domain(task)>baseDomain(task),downstreamProtectionSources:opens.filter(t=>domain(t)>baseDomain(task)).map(t=>({id:t.id,title:t.title,tier:domain(t)})),important,urgent,quadrant,unlocks:opens.map(t=>({id:t.id,title:t.title})),deadline,reasons,score,pinned,underway,fit,protectedToday,capacityMinutes:Math.round(capacity),slackMinutes:Math.round(slack)};
 }).sort((a,b)=>b.tier-a.tier||Number(b.pinned)-Number(a.pinned)||Number(b.underway)-Number(a.underway)||b.score-a.score||a.deadline.localeCompare(b.deadline)||a.task.id.localeCompare(b.task.id));
 const followUp=active.filter(t=>t.status==='waiting').sort((a,b)=>domain(b)-domain(a)||a.deadline.localeCompare(b.deadline));
 const protectedWaiting=followUp.filter(t=>domain(t)>0).map(task=>({task,tier:domain(task)}));
 const clarify=active.filter(t=>t.status!=='waiting'&&t.minutes===0&&!prerequisites(tasks,t).length).map(task=>({task,reason:active.some(c=>c.parentId===task.id)?'Work sits in the subtasks; focus on those first':'No remaining work estimate — confirm completion or add an estimate'}));
 const blocked=active.filter(t=>t.status!=='waiting'&&prerequisites(tasks,t).length).map(task=>({task,tier:domain(task),prerequisites:(task.dependsOn||[]).filter(id=>tasks.find(t=>t.id===id)?.status!=='done').map(id=>({id,title:tasks.find(t=>t.id===id)?.title||'Unavailable prerequisite'}))})).sort((a,b)=>b.tier-a.tier||a.task.deadline.localeCompare(b.task.deadline));
 const quadrants=Object.fromEntries(['Act now','Protect time','Delegate or triage','Reconsider','Clarify importance'].map(label=>[label,next.filter(r=>r.quadrant===label).length]));
 return {next,followUp,clarify,blocked,quadrants,protectedWaiting};
}
