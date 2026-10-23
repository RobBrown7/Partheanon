"""Run only against local development. Keeps credentials in memory; never prints them."""
import urllib.request,urllib.error,http.cookiejar,json,uuid,datetime,concurrent.futures,hashlib
base='http://127.0.0.1:5173'
c=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
c.open(base+'/signin-with-chatgpt?return_to=%2F').read()
def owner(path,body=None):
 req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','Origin':base})
 return json.load(c.open(req))
def send(payload,token='',raw=None):
 req=urllib.request.Request(base+'/api/ingest',data=raw if raw is not None else json.dumps(payload).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+token})
 try:
  with urllib.request.urlopen(req,timeout=30) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def stamp(offset=0):return (datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=offset)).isoformat().replace('+00:00','Z')
before=owner('/api/state')
issued=owner('/api/ingest-admin',{'action':'create','value':{'provider':'google','account':'rob.k.brown.7@gmail.com','calendarIds':['integration-test'],'mailboxIds':[]}})
key=issued['token'];event_id='synthetic-'+str(uuid.uuid4())
b={'schemaVersion':1,'batchId':str(uuid.uuid4()),'provider':'google','account':'rob.k.brown.7@gmail.com','resourceType':'calendar','syncMode':'reconciliation','generatedAt':stamp(),'testMode':True,'scope':{'containerId':'integration-test','complete':True,'windowStart':stamp(-86400),'windowEnd':stamp(86400)},'records':[{'id':event_id,'updatedAt':stamp(-60),'title':'Synthetic integration check','start':stamp(3600),'end':stamp(7200)}],'deleted':[]}
try:
 assert send(b)[0]==401
 assert send({**b,'account':'other@example.com'},key)[0]==403
 assert send({**b,'scope':{**b['scope'],'containerId':'not-permitted'}},key)[0]==403
 assert send(b,key,raw=b'x'*1048577)[0]==413
 assert send({**b,'unexpected':'field'},key)[0]==422
 code,result=send(b,key);assert code==200,(code,result);assert result['status']=='accepted'
 assert send(b,key)[1]['status']=='duplicate'
 assert send({**b,'syncMode':'incremental'},key)[0]==409
 streams=owner('/api/ingest-admin')['streams'];stream=next(s for s in streams if s['containerId']=='integration-test' and s['testMode']);assert stream['records']==1
 assert owner('/api/state')['sources']==before['sources']
 assert send({**b,'batchId':str(uuid.uuid4()),'generatedAt':stamp(-20)},key)[0]==409
 concurrent_batch={**b,'batchId':str(uuid.uuid4()),'generatedAt':stamp(),'scope':{**b['scope'],'complete':False}}
 with concurrent.futures.ThreadPoolExecutor(2) as pool:responses=list(pool.map(lambda _:send(concurrent_batch,key),range(2)))
 assert all(code==200 for code,data in responses),responses
 assert sorted(data['status'] for code,data in responses)==['accepted','duplicate'],responses
 deleted={**b,'batchId':str(uuid.uuid4()),'generatedAt':stamp(),'records':[],'deleted':[{'id':event_id,'updatedAt':stamp()}]}
 code,data=send(deleted,key);assert code==200,(code,data)
 assert next(s for s in owner('/api/ingest-admin')['streams'] if s['id']==stream['id'])['records']==0
 assert owner('/api/state')['sources']==before['sources']
 print('PASS: authentication, account/container isolation, payload limits, validation, persistence/readback, duplicate replay, batch-ID collision, stale batches, concurrent retries, explicit deletion, and test/live isolation.')
finally:owner('/api/ingest-admin',{'action':'revoke','id':issued['id']})
assert send(b,key)[0]==401
print('PASS: revoked keys rejected; synthetic data stayed outside live sources.')
