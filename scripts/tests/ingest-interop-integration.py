"""Local-only sender interoperability proof. Never retarget this to a hosted Site."""
import copy,http.cookiejar,json,urllib.error,urllib.request,uuid
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'docs/integrations/interop-v1.1'
base='http://127.0.0.1:5173'
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
client.open(base+'/signin-with-chatgpt?return_to=%2F').read()
def owner(path,body=None):return json.load(client.open(urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','Origin':base})))
def fixture(name):return json.loads((root/name).read_text())
def post(b,token):
 try:
  with urllib.request.urlopen(urllib.request.Request(base+'/api/ingest',data=json.dumps(b,ensure_ascii=False).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+token,'Idempotency-Key':b['batchId'],'X-Partheanon-Schema':b['schemaVersion']})) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def lookup(bid,token):
 try:
  with urllib.request.urlopen(urllib.request.Request(base+'/api/ingest?batchId='+bid,headers={'Authorization':'Bearer '+token})) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
b=fixture('envelope.json');account=b['account'];cid=str(uuid.uuid4());manifest=fixture('vectors.json')
assert not any(c['account']==account for c in owner('/api/state')['connections']),'Disposable fixture account already exists: do not overwrite it.'
owner('/api/state',{'action':'connection','value':{'id':cid,'provider':'google','account':account,'lane':'Personal','calendar':False,'mail':True}})
issued=owner('/api/ingest-admin',{'action':'create','value':{'provider':'google','account':account,'calendarIds':[],'mailboxIds':['all_mail']}})
try:
 assert post(b,'bad')[0]==401
 assert lookup(b['batchId'],issued['token'])[0]==404
 code,accepted=post(b,issued['token']);assert code==200 and accepted['status']=='accepted'
 assert accepted['receiptDigest']==manifest['baseDigest']
 expected=fixture('accepted.example.json');expected['receivedAt']=accepted['receivedAt'];assert accepted==expected,(accepted,expected)
 code,readback=lookup(b['batchId'],issued['token']);assert code==200 and readback==accepted
 state=owner('/api/state');source=state['sources'][f'account:{cid}:gmail'];assert len(source['emails'])==2 and source['partial'] and source['syncTransport']=='n8n'
 assert source['emails'][0]['url']=='' and all(not e['snippet'] for e in source['emails'])
 duplicates=[]
 for vector in manifest['vectors']:
  code,response=post(fixture(vector['file']),issued['token']);assert code==vector['postAfterBase']['http'],(vector['name'],code,response)
  if code==200:assert response=={**accepted,'status':'duplicate'};duplicates.append(response)
  else:assert response['error']['code']=='batch_id_reused'
 # Simulate a sender losing its acknowledgment, without claiming a real
 # interrupted network response: discard the POST result, recover via lookup.
 deferred=fixture('deferred-removal.json');post(deferred,issued['token'])
 code,recovered=lookup(deferred['batchId'],issued['token']);assert code==200 and recovered['deferred']==1 and recovered['applied']==0
 assert len(owner('/api/state')['sources'][f'account:{cid}:gmail']['emails'])==2
 assert post(deferred,issued['token'])[1]['status']=='duplicate'
 assert lookup(b['batchId'],issued['token'])[1]==accepted,'Original receipt remains unchanged after another batch'
 print('PASS: exact interoperability digest, accepted/lookup/duplicate shape, object-order/time retry, array/stable collision rejection, dashboard readback, deferred removal, and simulated lost-acknowledgment receipt recovery. Local only.')
finally:owner('/api/state',{'action':'removeConnection','id':cid})
assert post(b,issued['token'])[0]==401
print('PASS: disposable local fixture account removed and key revoked; no hosted requests or live workflow changes.')
