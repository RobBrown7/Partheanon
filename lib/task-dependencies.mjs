export function prerequisites(tasks,task){return (task.dependsOn||[]).map(id=>tasks.find(t=>t.id===id)).filter(t=>!t||t.status!=='done');}
export function downstream(tasks,id){const found=new Set(),pending=[id];while(pending.length){const current=pending.pop();for(const t of tasks)if(t.status!=='done'&&(t.dependsOn||[]).includes(current)&&t.id!==id&&!found.has(t.id)){found.add(t.id);pending.push(t.id);}}return tasks.filter(t=>found.has(t.id));}
export function validateDependencies(tasks,task){
 const ids=new Set(tasks.map(t=>t.id));ids.add(task.id);
 if((task.dependsOn||[]).some(id=>id===task.id||!ids.has(id)))throw new Error('Choose prerequisite commitments you own; a task cannot depend on itself.');
 const merged=[...tasks.filter(t=>t.id!==task.id),task],edges=new Map(merged.map(t=>[t.id,new Set(t.dependsOn||[])]));
 // A parent's completion already requires its children. Include that constraint to prevent deadlocks.
 for(const child of merged)if(child.parentId)edges.get(child.parentId)?.add(child.id);
 const visiting=new Set(),done=new Set();function visit(id){if(visiting.has(id))throw new Error('This dependency creates a cycle, including parent completion requirements.');if(done.has(id))return;visiting.add(id);for(const prerequisite of edges.get(id)||[])visit(prerequisite);visiting.delete(id);done.add(id);}for(const id of edges.keys())visit(id);
}
