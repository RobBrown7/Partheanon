import {analyze,dateKey,dayAt,freeWindows} from './planning.mjs';
export const impactLabels={unknown:'Consequence not recorded',people:'Someone cannot move forward',service:'Service or operations disrupted',financial:'Financial loss or missed obligation',safety:'Safety or compliance exposure',opportunity:'Personal or strategic opportunity lost'};
const impactWeight={unknown:0,people:40,service:45,financial:55,safety:80,opportunity:25};
// A transparent heuristic, not an AI judgment. Consequences are explicitly entered by the user.
export function prioritize(tasks,events,blocks,prefs,now=Date.now()){
 const active=tasks.filter(t=>t.status!=='done'),riskIds=new Set(analyze(tasks,events,blocks,prefs,now).risks.map(r=>r.task.id));
 const next=active.filter(t=>t.status!=='waiting'&&t.minutes>0).map(task=>{
  let deadline=task.deadline,parent=task.parentId;const seen=new Set([task.id]);
  while(parent&&!seen.has(parent)){seen.add(parent);const p=tasks.find(t=>t.id===parent);if(!p)break;if(p.status!=='done'&&p.deadline<deadline)deadline=p.deadline;parent=p.parentId;}
  const due=dayAt(deadline,17),days=Math.ceil((due-now)/86400000),past=due<now,reasons=[];
  const windows=freeWindows(events,blocks.filter(b=>b.taskId!==task.id),prefs,now,Math.min(due,now+14*86400000));
  const capacity=windows.reduce((s,[a,b])=>s+(b-a)/60000,0),slack=capacity-task.minutes;
  const todayWindows=windows.filter(([a])=>dateKey(a)===dateKey(now)),fit=todayWindows.some(([a,b])=>(b-a)/60000>=Math.min(task.minutes,60));
  const underway=blocks.some(b=>b.taskId===task.id&&Date.parse(b.start)<=now&&Date.parse(b.end)>now);
  const protectedToday=blocks.some(b=>b.taskId===task.id&&Date.parse(b.end)>now&&dateKey(b.start)===dateKey(now));
  const pinned=prefs.focusTaskId===task.id;
  if(pinned)reasons.push('You chose this next');
  if(task.delayImpact&&task.delayImpact!=='unknown')reasons.push(impactLabels[task.delayImpact]);
  if(task.peopleBlocked)reasons.push(task.stakeholder?`${task.stakeholder} is held up`:'Someone is held up');
  if(past)reasons.push('Deadline passed — confirm the next step or reset it');
  else if(days<=2)reasons.push('Due within two days');else if(days<=7)reasons.push('Due within a week');
  if(deadline!==task.deadline)reasons.push(`Parent commitment needs this by ${deadline}`);
  if(!past&&days<=14&&slack<0)reasons.push('Remaining work exceeds time available before due date');
  else if(riskIds.has(task.id)&&!past)reasons.push('Competing deadlines leave too little room');
  if(underway)reasons.push('Protected work block is underway');else if(protectedToday)reasons.push('Work time is protected today');
  if(task.status==='doing')reasons.push('Already in progress');
  if(fit)reasons.push('A useful work session fits today');
  if(task.parentId)reasons.push('Moves a parent commitment toward completion');
  if(!task.delayImpact||task.delayImpact==='unknown')reasons.push('Add the consequence of delay to sharpen the order');
  const pressure=past?65:days<=2?55:days<=7?30:days<=14?15:0;
  const score=(impactWeight[task.delayImpact]||0)+(task.peopleBlocked&&task.delayImpact!=='people'?40:0)+pressure+(!past&&days<=14&&(slack<0||riskIds.has(task.id))?25:0)+(task.status==='doing'?8:0)+(protectedToday?10:0)+(fit?3:0)+(task.parentId?5:0);
  return {task,deadline,reasons,score,pinned,underway,fit,protectedToday,capacityMinutes:Math.round(capacity),slackMinutes:Math.round(slack)};
 }).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||Number(b.underway)-Number(a.underway)||b.score-a.score||a.deadline.localeCompare(b.deadline)||a.task.id.localeCompare(b.task.id));
 const followUp=active.filter(t=>t.status==='waiting').sort((a,b)=>a.deadline.localeCompare(b.deadline));
 const clarify=active.filter(t=>t.status!=='waiting'&&t.minutes===0).map(task=>({task,reason:active.some(c=>c.parentId===task.id)?'Work sits in the subtasks; focus on those first':'No remaining work estimate — confirm completion or add an estimate'}));
 return {next,followUp,clarify};
}
