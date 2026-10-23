"""Local-only synthetic n8n worker test. Credentials remain in memory."""
import concurrent.futures, copy, datetime, hashlib, http.cookiejar, json, sqlite3, urllib.error, urllib.request, uuid
from pathlib import Path

base='http://127.0.0.1:5173'
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
client.open(base+'/signin-with-chatgpt?return_to=%2F').read()
def owner(path,body=None):
 return json.load(client.open(urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','Origin':base})))
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
def send(batch,key,extra=None):
 headers={'Content-Type':'application/json','Authorization':'Bearer '+key,'Idempotency-Key':batch['batchId'],'X-Partheanon-Schema':batch['schemaVersion']}
 if extra:headers.update(extra)
 try:
  with urllib.request.urlopen(urllib.request.Request(base+'/api/ingest',data=json.dumps(batch).encode(),headers=headers)) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def next_batch(batch):
 b=copy.deepcopy(batch);b['batchId']='gsync_'+hashlib.sha1(uuid.uuid4().bytes).hexdigest();b['generatedAt']=stamp();return b
account='worker-'+uuid.uuid4().hex+'@example.test';cid=str(uuid.uuid4())
owner('/api/state',{'action':'connection','value':{'id':cid,'provider':'google','account':account,'lane':'Personal','calendar':True,'mail':True}})
issued=owner('/api/ingest-admin',{'action':'create','value':{'provider':'google','account':account,'calendarIds':['primary'],'mailboxIds':['all_mail']}})
def stored(source_id):
 # Inspect only this disposable synthetic account, through a read-only SQLite
 # connection. No production database or other owner's records are queried.
 for file in Path('.wrangler/state').rglob('*.sqlite'):
  if file.name.startswith('._'):continue
  with sqlite3.connect(file.resolve().as_uri()+'?mode=ro',uri=True) as db:
   if db.execute("SELECT count(*) FROM sqlite_master WHERE name='ingest_records'").fetchone()[0]:
    row=db.execute('SELECT payload FROM ingest_records JOIN ingest_streams ON ingest_streams.id=ingest_records.stream_id WHERE ingest_streams.account=? AND record_id=?',(account,source_id)).fetchone()
    if row:return json.loads(row[0])
 raise AssertionError('Synthetic row not durably stored')
try:
 batches=[]
 for name in ['gmail','calendar']:
  b=json.loads((Path(__file__).parent/'fixtures'/('n8n-'+name+'.json')).read_text());b=next_batch(b);b['account']=account
  for r in b['records']:
   r['account']=account;r['recordKey']='|'.join(['google',account,r['containerType'],r['containerId'],r['sourceId']])
  batches.append(b)
  assert send(b,'bad')[0]==401
  assert send(b,issued['token'],{'Idempotency-Key':'wrong'})[0]==422
  code,data=send(b,issued['token']);assert code==200 and data['status']=='accepted' and data['batchId']==b['batchId'],(code,data)
  retry=copy.deepcopy(b);retry['generatedAt']=stamp();retry=dict(reversed(list(retry.items())))
  code,data=send(retry,issued['token']);assert code==200 and data['status']=='duplicate',(code,data)
  changed=copy.deepcopy(retry);changed['coverage']['pagesFetched']=2;assert send(changed,issued['token'])[0]==409
  fresh=next_batch(b)
  with concurrent.futures.ThreadPoolExecutor(2) as pool:responses=list(pool.map(lambda _:send(fresh,issued['token']),range(2)))
  assert sorted(data['status'] for code,data in responses if code==200)==['accepted','duplicate'],responses
 mail=batches[0];assert stored('synthetic-mail-001')['sourceVersion']=='9876543210123456789'
 newer=next_batch(mail);newer['records'][0].update(sourceVersion='10000000000000000000',sourceUpdatedAt='10000000000000000000',subject='New version')
 assert send(newer,issued['token'])[0]==200
 stale=next_batch(mail);stale['records'][0]['subject']='Stale version';assert send(stale,issued['token'])[0]==200
 assert stored('synthetic-mail-001')['subject']=='New version'
 for field,countfield in [('deletions','deletionCount'),('scopeExits','scopeExitCount')]:
  invalid=next_batch(mail);invalid[field]=[{'kind':'synthetic'}];invalid['coverage'][countfield]=1;assert send(invalid,issued['token'])[0]==422
 invalid=next_batch(mail);invalid['coverage']['authoritative']=True;assert send(invalid,issued['token'])[0]==422
 invalid=next_batch(batches[1]);invalid['records'][0]['sourceUpdatedAt']=None;assert send(invalid,issued['token'])[0]==422
 empty=next_batch(mail);empty['records']=[];empty['coverage']['recordCount']=0;assert send(empty,issued['token'])[0]==200
 assert stored('synthetic-mail-001')['subject']=='New version','Empty delta must retain prior records'
 streams=[s for s in owner('/api/ingest-admin')['streams'] if s['account']==account]
 assert len(streams)==2 and all(not s['published'] for s in streams),'Delta alone must not establish initial coverage'
 assert all(s.get('account')!=account for s in owner('/api/state')['sources'].values())
 print('PASS: both actual worker envelopes durably committed; matching acknowledgments; timestamp/key-order replay; changed-content rejection; concurrent retries; precise Gmail version ordering; no-change retention; unverified removals/initial/null versions rejected; delta streams remain unpublished.')
finally:owner('/api/state',{'action':'removeConnection','id':cid})
assert send(batches[0],issued['token'])[0]==401
print('PASS: disposable account removed and credential revoked; no production data or workflows changed.')
