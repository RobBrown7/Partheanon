import test from "node:test";
import assert from "node:assert/strict";
import {overlapDetails} from "./capacity-details.mjs";
const event=(start,end)=>({start:`2026-10-09T${start}:00-07:00`,end:`2026-10-09T${end}:00-07:00`});
test("shows the intersection rather than either full event duration",()=>{
 const d=overlapDetails(event("10:00","11:00"),event("10:30","12:00"));
 assert.equal(d.minutes,30);assert.equal(d.start,Date.parse("2026-10-09T10:30:00-07:00"));assert.equal(d.highlight.width,25);assert.equal(d.bars[0].width,50);
});
test("nested and adjacent intervals show correct overlap",()=>{
 assert.equal(overlapDetails(event("09:00","12:00"),event("10:00","10:45")).minutes,45);
 assert.equal(overlapDetails(event("09:00","10:00"),event("10:00","11:00")),null);
});
