import test from "node:test";
import assert from "node:assert/strict";
import {descendants,validateParent,workTotals,orderedTasks} from "./task-work.mjs";
const tasks=[{id:"parent",parentId:null,status:"open"},{id:"child",parentId:"parent",status:"open"},{id:"grandchild",parentId:"child",status:"done"}];
test("hierarchy rejects self parenting, cycles, unavailable parents and active children of completed parents",()=>{
 assert.deepEqual([...descendants(tasks,"parent")],["child","grandchild"]);
 assert.throws(()=>validateParent(tasks,{id:"parent",parentId:"grandchild"}));
 assert.throws(()=>validateParent(tasks,{id:"child",parentId:"child"}));
 assert.throws(()=>validateParent(tasks,{id:"new",parentId:"other-user-task"}));
 assert.throws(()=>validateParent([{id:"done",status:"done"}],{id:"new",parentId:"done",status:"open"}));
 assert.doesNotThrow(()=>validateParent(tasks,{id:"new",parentId:"child",status:"open"}));
});
test("actual time rollup counts each work entry once and treats AI time as a subset",()=>{
 const logs=[{taskId:"parent",minutes:20,aiMinutes:10},{taskId:"child",minutes:60,aiMinutes:40},{taskId:"grandchild",minutes:15,aiMinutes:0},{taskId:"other",minutes:500,aiMinutes:500}];
 assert.deepEqual(workTotals(tasks,logs,"parent"),{own:{minutes:20,aiMinutes:10},family:{minutes:95,aiMinutes:50}});
 assert.deepEqual(workTotals(tasks,logs,"child").family,{minutes:75,aiMinutes:40});
});
test("filtered hierarchy keeps orphaned child visible and orders siblings below parents",()=>{
 assert.deepEqual(orderedTasks([...tasks].reverse()).map(({task,depth})=>[task.id,depth]),[["parent",0],["child",1],["grandchild",2]]);
 assert.deepEqual(orderedTasks(tasks.slice(1)).map(({task,depth})=>[task.id,depth]),[["child",0],["grandchild",1]]);
});
