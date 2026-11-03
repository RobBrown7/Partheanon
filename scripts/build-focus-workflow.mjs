import {writeFileSync} from 'node:fs';
import {focusEventBody,cleanFocusReadback,planGoogleMutation} from '../lib/focus-worker-logic.mjs';
const nodes=[],connections={};
function node(name,type,parameters,x,y,extra={}){nodes.push({id:name.toLowerCase().replaceAll(' ','-'),name,type,typeVersion:type.endsWith('httpRequest')?4.2:type.endsWith('if')?2.2:type.endsWith('code')?2:1,position:[x,y],parameters,...extra});}
function edge(from,to,index=0){connections[from]??={main:[]};connections[from].main[index]??=[];connections[from].main[index].push({node:to,type:'main',index:0});}
const origin='https://partheanon-forge.athena-works-8404.chatgpt.site';
function app(name,body,x,y){node(name,'n8n-nodes-base.httpRequest',{method:'POST',url:origin+'/api/focus-worker',authentication:'genericCredentialType',genericAuthType:'httpCustomAuth',sendBody:true,specifyBody:'json',jsonBody:body,options:{timeout:20000,redirect:{redirect:{followRedirects:false}}}},x,y,{notes:'Select the dedicated Custom Auth credential with both Authorization (focus worker key) and OAI-Sites-Authorization headers. Never inline credentials.'});}
function google(name,method,url,x,y,body=null,patch=false){node(name,'n8n-nodes-base.httpRequest',{method,url,authentication:'predefinedCredentialType',nodeCredentialType:'googleCalendarOAuth2Api',...(body?{sendBody:true,specifyBody:'json',jsonBody:body}:{}),...(patch?{sendHeaders:true,headerParameters:{parameters:[{name:'If-Match',value:"={{ $('Plan owned change').first().json.etag }}"}]}}:{}),options:{timeout:20000,redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}}}},x,y,{notes:'Select the approved account Google Calendar OAuth credential. Fixed Google API host, one pinned secondary calendar, no attendees, sendUpdates=none.'});}
function decision(name,expr,x,y){node(name,'n8n-nodes-base.if',{conditions:{options:{caseSensitive:true,typeValidation:'strict',version:2},conditions:[{id:name,leftValue:expr,rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},x,y);}
const job="$('Claim approved block').first().json.job";
const eventUrl=`={{ 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(${job}.calendarId) + '/events/' + encodeURIComponent(${job}.eventId) }}`;
const readUrl=eventUrl.slice(0,-3)+" + '?fields=id,etag,summary,start,end,status,visibility,transparency,attendees,extendedProperties,recurrence,recurringEventId,eventType' }}";
node('Manual pilot','n8n-nodes-base.manualTrigger',{},0,0);
app('Claim approved block',JSON.stringify({action:'claim'}),220,0);
node('Only claimed work','n8n-nodes-base.code',{jsCode:'const job=$input.first().json.job; return job?[{json:{job}}]:[];'},440,0);
google('Read existing event','GET',readUrl,660,0);
const funcs=[focusEventBody,cleanFocusReadback,planGoogleMutation].map(f=>f.toString()).join('\n');
node('Plan owned change','n8n-nodes-base.code',{jsCode:funcs+`\nconst job=${job},response=$input.first().json;try {const plan=planGoogleMutation(job,response.statusCode,response.body);return [{json:{job,...plan,decision:plan.method?'write':'verified'}}];}catch{return [{json:{job,decision:'attention'}}];}`},880,0);
decision('Already verified',"={{ $json.decision === 'verified' }}",1100,0);
decision('Write permitted plan',"={{ $json.decision === 'write' }}",1320,120);
app('Recheck write lease',`={{ {action:'status',value:{id:${job}.id,claimToken:${job}.claimToken}} }}`,1540,120);
decision('Lease still valid',"={{ $json.mayWrite === true }}",1760,120);
decision('Create or reschedule',"={{ $('Plan owned change').first().json.method === 'POST' }}",1980,120);
google('Create focus event','POST',`={{ 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(${job}.calendarId) + '/events?sendUpdates=none' }}`,2200,0,"={{ $('Plan owned change').first().json.body }}");
google('Reschedule owned event','PATCH',eventUrl.slice(0,-3)+" + '?sendUpdates=none' }}",2200,240,"={{ $('Plan owned change').first().json.body }}",true);
google('Read back provider event','GET',readUrl,2420,120);
node('Verify provider readback','n8n-nodes-base.code',{jsCode:cleanFocusReadback.toString()+`\nconst job=${job},r=$input.first().json;try {if(r.statusCode!==200)throw new Error();return [{json:{job,event:cleanFocusReadback(job,r.body),decision:'verified'}}];}catch{return [{json:{job,decision:'attention'}}];}`},2640,120);
decision('Provider verified',"={{ $json.decision === 'verified' }}",2860,120);
// $json has the cleaned event from either the replay or post-write readback path.
app('Save verified receipt',`={{ {action:'verified',value:{id:${job}.id,claimToken:${job}.claimToken,event:$json.event}} }}`,3080,0);
app('Hold for review',`={{ {action:'attention',value:{id:${job}.id,claimToken:${job}.claimToken}} }}`,3080,360);
node('Check saved receipt','n8n-nodes-base.code',{jsCode:`const r=$input.first().json,job=${job};if(r.id!==job.id||r.state!=='confirmed')throw new Error('Receipt did not match. Do not issue a new request.');return [{json:{requestId:r.id,state:r.state,duplicate:r.duplicate}}];`},3300,0);
edge('Manual pilot','Claim approved block');edge('Claim approved block','Only claimed work');edge('Only claimed work','Read existing event');edge('Read existing event','Plan owned change');edge('Plan owned change','Already verified');edge('Already verified','Save verified receipt',0);edge('Already verified','Write permitted plan',1);edge('Write permitted plan','Recheck write lease',0);edge('Write permitted plan','Hold for review',1);edge('Recheck write lease','Lease still valid');edge('Lease still valid','Create or reschedule',0);edge('Lease still valid','Hold for review',1);edge('Create or reschedule','Create focus event',0);edge('Create or reschedule','Reschedule owned event',1);edge('Create focus event','Read back provider event');edge('Reschedule owned event','Read back provider event');edge('Read back provider event','Verify provider readback');edge('Verify provider readback','Provider verified');edge('Provider verified','Save verified receipt',0);edge('Provider verified','Hold for review',1);edge('Save verified receipt','Check saved receipt');
const workflow={name:'Partheanon Focus — supervised manual pilot',active:false,nodes,connections,settings:{executionOrder:'v1',executionTimeout:180,saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false,timezone:'America/Phoenix'},pinData:{},tags:[]};
writeFileSync('docs/integrations/focus-pilot/n8n-focus-manual.json',JSON.stringify(workflow,null,2)+'\n');console.log(`Prepared ${nodes.length} nodes, manual only, no credential values or IDs.`);
