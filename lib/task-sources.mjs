export function sourceTaskKey(kind, identity) {
  return JSON.stringify([kind, identity]);
}

export function findCommittedTask(tasks, key, draft) {
  return tasks.find(t => t.sourceKey === key) || tasks.find(t =>
    !t.sourceKey && draft.sourceUrl && t.sourceUrl === draft.sourceUrl &&
    (t.title === draft.title || (draft.output && t.output === draft.output))
  );
}
