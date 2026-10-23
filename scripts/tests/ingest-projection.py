"""Local-only readback test using a disposable synthetic account."""
import urllib.request,urllib.error,http.cookiejar,json,uuid,datetime
base='http://127.0.0.1:5173';c=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));c.open(base+'/signin-with-chatgpt?return_to=%2F').read()
def owner(path,body=None):return json.load(c.open(urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','Origin':base})))
def stamp(seconds=0):return (datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=seconds)).isoformat().replace('+00:00','Z')
account='ingest-pilot-test@example.test';cid=str(uuid.uuid4());source=f'account:{cid}:google'
owner('/api/state',{'action':'connection','value':{'id':cid,'provider':'google','account':account,'lane':'Personal','calendar':True,'mail':False}})
issued=owner('/api/ingest-admin',{'action':'create','value':{'provider':'google','account':account,'calendarIds':['primary'],'mailboxIds':[]}})
def send(b):
 req=urllib.request.Request(base+'/api/ingest',data=json.dumps(b).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+issued['token']})
 return json.load(urllib.request.urlopen(req))
b={'schemaVersion':1,'batchId':str(uuid.uuid4()),'provider':'google','account':account,'resourceType':'calendar','syncMode':'reconciliation','generatedAt':stamp(),'testMode':False,'scope':{'containerId':'primary','complete':False,'windowStart':stamp(-86400),'windowEnd':stamp(86400)},'records':[{'id':'one','updatedAt':stamp(-30),'title':'Verified synthetic event','start':stamp(3600),'end':stamp(7200)}],'deleted':[]}
try:
 send(b);assert source not in owner('/api/state')['sources']
 send({**b,'batchId':str(uuid.uuid4()),'generatedAt':stamp(),'records':[],'scope':{**b['scope'],'complete':True}})
 snapshot=owner('/api/state')['sources'][source];assert snapshot['syncTransport']=='n8n' and len(snapshot['events'])==1 and not snapshot['partial']
 send({**b,'batchId':str(uuid.uuid4()),'generatedAt':stamp(),'records':[{**b['records'][0],'updatedAt':stamp(-1000),'title':'STALE VALUE'}]})
 snapshot=owner('/api/state')['sources'][source];assert snapshot['partial'] and snapshot['events'][0]['title']=='Verified synthetic event'
 send({**b,'batchId':str(uuid.uuid4()),'generatedAt':stamp(),'records':[],'deleted':[{'id':'one','updatedAt':stamp()}]})
 assert owner('/api/state')['sources'][source]['events']==[]
 print('PASS: partial initial sync stays unpublished; complete delivery projects into dashboard; later partial sync retains records; stale record updates cannot overwrite newer data; explicit deletions remove records.')
finally:owner('/api/state',{'action':'removeConnection','id':cid})
assert source not in owner('/api/state')['sources']
keys=owner('/api/ingest-admin')['keys'];assert next(k for k in keys if k['id']==issued['id'])['revoked']
print('PASS: removing the synthetic connection clears its intake cache and revokes its keys.')
