export function descendants(tasks, id) {
  const found = new Set(), pending = [id];
  while (pending.length) {
    const parent = pending.pop();
    for (const task of tasks) if (task.parentId === parent && task.id !== id && !found.has(task.id)) {
      found.add(task.id); pending.push(task.id);
    }
  }
  return found;
}

export function validateParent(tasks, task) {
  if (!task.parentId) return;
  if (task.parentId === task.id || descendants(tasks, task.id).has(task.parentId)) throw new Error("A commitment cannot be its own ancestor.");
  const parent = tasks.find(t => t.id === task.parentId);
  if (!parent) throw new Error("Parent commitment not available.");
  if (parent.status === "done" && task.status !== "done") throw new Error("Reopen the parent before adding an active subtask.");
}

export function workTotals(tasks, logs, id) {
  const family = descendants(tasks, id); family.add(id);
  const sum = entries => entries.reduce((s, e) => ({minutes:s.minutes+e.minutes,aiMinutes:s.aiMinutes+e.aiMinutes}), {minutes:0,aiMinutes:0});
  return {own:sum(logs.filter(e=>e.taskId===id)),family:sum(logs.filter(e=>family.has(e.taskId)))};
}

export function orderedTasks(tasks) {
  const ids = new Set(tasks.map(t=>t.id)), result = [], seen = new Set();
  function visit(task, depth) { if(seen.has(task.id))return;seen.add(task.id);result.push({task,depth});tasks.filter(t=>t.parentId===task.id).forEach(t=>visit(t,depth+1)); }
  tasks.filter(t=>!t.parentId||!ids.has(t.parentId)).forEach(t=>visit(t,0));
  tasks.forEach(t=>visit(t,0));return result;
}
