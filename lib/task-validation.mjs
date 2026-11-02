import { validateParent, descendants } from './task-work.mjs';
import { validateDependencies, prerequisites } from './task-dependencies.mjs';

export class TaskValidationError extends Error {}

// Shared by proposal preparation and the actual write. A proposal is not a bypass.
export function validateTaskChange(tasks, task) {
  try {
    validateParent(tasks, task);
    validateDependencies(tasks, task);
    if (task.status !== 'done') return;
    const childIds = descendants(tasks, task.id);
    const children = tasks.filter(t => childIds.has(t.id) && t.status !== 'done');
    if (children.length) {
      throw new Error(`Complete these subtasks first: ${children.slice(0,3).map(t => t.title).join('; ')}${children.length > 3 ? '; and others' : ''}.`);
    }
    const blocked = prerequisites(tasks, task);
    if (blocked.length) {
      throw new Error(`Cannot complete “${task.title}” while these prerequisites are open: ${blocked.slice(0,3).map(t => t?.title || 'Unavailable prerequisite').join('; ')}. A prerequisite must finish first; a subtask belongs under a parent. If the relationship is incorrect, review it in the commitment worksheet before retrying.`);
    }
  } catch (error) {
    throw new TaskValidationError(error.message);
  }
}

export function failedTaskProposalMessage(tasks, task) {
  try {
    validateTaskChange(tasks, task);
  } catch (error) {
    if (error instanceof TaskValidationError) return error.message;
    throw error;
  }
  return 'This proposal failed during an earlier save attempt. Review the current commitment and ask Aegis for a fresh proposal.';
}
