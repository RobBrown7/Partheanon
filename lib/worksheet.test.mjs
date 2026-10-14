import test from "node:test";
import assert from "node:assert/strict";
import {inLane,emailUpdate} from "./worksheet.mjs";
test("across-lane commitments remain visible under individual lane filters",()=>{
 for(const lane of ["Unity Homes","AthenaWorx","SHP Beds","Personal","Across lanes","All lanes"])assert.equal(inLane("Across lanes",lane),true);
 assert.equal(inLane("Personal","SHP Beds"),false);assert.equal(inLane("Personal","Across lanes"),false);
});
test("email updates separate expected output from recorded work and exclude other tasks",()=>{
 const t={id:"one",title:"Migration",lane:"Across lanes",status:"doing",deadline:"2026-10-20",minutes:60,output:"New profile"};
 const d=emailUpdate(t,[{taskId:"one",workedOn:"2026-10-14",minutes:30,aiMinutes:10,skills:["Investigation"],notes:"Checked registration."},{taskId:"other",notes:"Private other task"}],[{taskId:"one",workedOn:"2026-10-14",notes:"Still to verify: sign-in."}]);
 assert.match(d.body,/Expected output:\nNew profile/);assert.match(d.body,/including any pending verification notes/);assert.match(d.body,/Still to verify: sign-in/);assert.match(d.body,/30 minutes \(10 AI-assisted minutes included\)/);assert.ok(!d.body.includes("Private other task"));assert.equal(d.to,"");
});
