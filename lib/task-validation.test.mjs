import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTaskChange, TaskValidationError, failedTaskProposalMessage} from './task-validation.mjs';

const prep={id:'prep',title:'Prepare delivery',status:'open',parentId:null,dependsOn:[]};
const bags={id:'bags',title:'Load tool bags',status:'open',parentId:null,dependsOn:['prep']};
const bedding={id:'bedding',title:'Sort bedding',status:'open',parentId:'prep',dependsOn:[]};
const tasks=[prep,bags,bedding];

test('completion rejection names the prerequisite and preserves the recorded relationship',()=>{
  const before=JSON.stringify(tasks);
  assert.throws(()=>validateTaskChange(tasks,{...bags,status:'done'}),error=>
    error instanceof TaskValidationError && /Prepare delivery/.test(error.message) && /prerequisite/.test(error.message) && /subtask/.test(error.message));
  assert.equal(JSON.stringify(tasks),before);
});

test('a child can complete before its parent; a parent must wait for open children',()=>{
  assert.doesNotThrow(()=>validateTaskChange(tasks,{...bedding,status:'done'}));
  assert.throws(()=>validateTaskChange(tasks,{...prep,status:'done'}),/Sort bedding/);
  assert.doesNotThrow(()=>validateTaskChange(tasks.map(t=>t.id==='bedding'?{...t,status:'done'}:t),{...prep,status:'done'}));
});

test('ordinary edits work while prerequisites are open; completed prerequisites unblock completion',()=>{
  assert.doesNotThrow(()=>validateTaskChange(tasks,{...bags,title:'Updated bags',status:'doing'}));
  assert.doesNotThrow(()=>validateTaskChange(tasks.map(t=>t.id==='prep'?{...t,status:'done'}:t),{...bags,status:'done'}));
});

test('failed proposal retry explains its current blocker instead of claiming expiry',()=>{
  assert.match(failedTaskProposalMessage(tasks,{...bags,status:'done'}),/Prepare delivery/);
  assert.doesNotMatch(failedTaskProposalMessage(tasks,{...bags,status:'done'}),/expired/);
  assert.match(failedTaskProposalMessage(tasks.map(t=>({...t,status:'done'})),{...bags,status:'done'}),/fresh proposal/);
});

test('preflight preserves parent and dependency cycle protections',()=>{
  assert.throws(()=>validateTaskChange(tasks,{...prep,parentId:'bedding'}),TaskValidationError);
  assert.throws(()=>validateTaskChange(tasks,{...bags,parentId:'prep'}),/cycle/);
  assert.throws(()=>validateTaskChange(tasks,{...bags,dependsOn:['unowned']}),/own/);
});
