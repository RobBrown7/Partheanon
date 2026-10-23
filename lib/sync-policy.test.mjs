import test from "node:test";
import assert from "node:assert/strict";
import {sourceSyncEnabled} from "./sync-policy.mjs";
test("email and calendar reads are off by default while Notion remains enabled",()=>{
 for(const enabled of [undefined,false]){
  for(const kind of ["mail","calendar"])assert.equal(sourceSyncEnabled({kind},enabled),false);
  assert.equal(sourceSyncEnabled({kind:"notes"},enabled),true);
 }
});
test("explicitly enabling restores mail and calendar sync without enabling unknown routes",()=>{
 for(const kind of ["mail","calendar","notes"])assert.equal(sourceSyncEnabled({kind},true),true);
 assert.equal(sourceSyncEnabled(undefined,false),false);assert.equal(sourceSyncEnabled(undefined,true),false);
});
