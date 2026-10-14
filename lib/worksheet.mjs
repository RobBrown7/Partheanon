export function inLane(taskLane,selectedLane){return selectedLane==="All lanes"||taskLane===selectedLane||taskLane==="Across lanes"&&selectedLane!=="Across lanes";}
export function emailUpdate(task,logs=[],outputs=[]){
 const work=logs.filter(l=>l.taskId===task.id).sort((a,b)=>a.workedOn.localeCompare(b.workedOn));
 const notes=outputs.filter(o=>o.taskId===task.id).sort((a,b)=>a.workedOn.localeCompare(b.workedOn));
 const status={open:"Open",doing:"In progress",waiting:"Waiting on someone",done:"Complete"}[task.status]||task.status;
 const lines=["Hello,","",`Here is an update on ${task.title||"this commitment"}.`,"",`Status: ${status}`,`Deadline: ${task.deadline||"Not set"}`,`Lane: ${task.lane}`];
 if(task.project)lines.push(`Project: ${task.project}`);
 if(task.stakeholder)lines.push(`Stakeholder(s): ${task.stakeholder}`);
 lines.push(`Remaining work estimate: ${task.minutes} minutes`);
 if(task.output)lines.push("","Expected output:",task.output);
 if(notes.length)lines.push("","Recorded work / output (including any pending verification notes):",...notes.flatMap(n=>[`\n${n.workedOn}`,n.notes]));
 if(work.length)lines.push("","Recorded work sessions:",...work.flatMap(l=>[`\n${l.workedOn} — ${l.minutes} minutes (${l.aiMinutes} AI-assisted minutes included)`,l.skills?.length?`Skills: ${l.skills.join(", ")}`:"",l.notes||""].filter(Boolean)));
 if(!notes.length&&!work.length)lines.push("","No work performed or output entries have been recorded yet.");
 lines.push("","Best,","Rob");
 return {to:"",subject:`Update: ${task.title||"Commitment"}`,body:lines.join("\n")};
}
