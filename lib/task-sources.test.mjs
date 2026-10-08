import test from "node:test";
import assert from "node:assert/strict";
import {sourceTaskKey,findCommittedTask} from "./task-sources.mjs";

test("source association survives task edits and completion",()=>{
  const key=sourceTaskKey("notion-action",JSON.stringify(["page","Action A"]));
  const task={id:"saved",sourceKey:key,title:"Renamed",output:"Edited",status:"done"};
  assert.equal(findCommittedTask([task],key,{title:"Action A"}),task);
  assert.equal(findCommittedTask([task],sourceTaskKey("notion-action",JSON.stringify(["page","Action B"])),{title:"Action B"}),undefined);
});
test("older tasks match their original source and action, not the entire page",()=>{
  const task={id:"old",sourceUrl:"https://example.com/page",title:"Action A",output:""};
  assert.equal(findCommittedTask([task],"new-key",{...task}),task);
  assert.equal(findCommittedTask([task],"new-key",{sourceUrl:task.sourceUrl,title:"Action B"}),undefined);
  assert.equal(findCommittedTask([task],"new-key",{sourceUrl:"https://example.com/other",title:"Action A"}),undefined);
});
