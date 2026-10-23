"""Local-only handoff v1.1 receiver/readback test; all data is synthetic."""
import copy,datetime,hashlib,http.cookiejar,json,sqlite3,urllib.error,urllib.request,uuid
from pathlib import Path
base='http://127.0.0.1:5173'
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
client.open(base+'/signin-with-chatgpt?return_to=%2F').read()
def owner(path,body=None):return json.load(client.open(urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','Origin':base})))
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
def fresh(b):
 b=copy.deepcopy(b);b['batchId']='gsync_'+hashlib.sha1(uuid.uuid4().bytes).hexdigest();b['generatedAt']=stamp();return b
def send(b,key):
 try:
  with urllib.request.urlopen(urllib.request.Request(base+'/api/ingest',data=json.dumps(b).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+key,'Idempotency-Key':b['batchId'],'X-Partheanon-Schema':b['schemaVersion']})) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def lookup(bid,key):
 try:
  with urllib.request.urlopen(urllib.request.Request(base+'/api/ingest?batchId='+bid,headers={'Authorization':'Bearer '+key})) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
account='v11-'+uuid.uuid4().hex+'@example.test';cid=str(uuid.uuid4())
owner('/api/state',{'action':'connection','value':{'id':cid,'provider':'google','account':account,'lane':'Personal','calendar':True,'mail':True}})
issued=owner('/api/ingest-admin',{'action':'create','value':{'provider':'google','account':account,'calendarIds':['primary'],'mailboxIds':['all_mail']}})
def fixture(name):
 b=json.loads((Path(__file__).parent/'fixtures/n8n-v11'/(name+'.json')).read_text());b['account']=account;b['generatedAt']=stamp()
 for field in ['records','deletions','scopeExits']:
  for r in b[field]:
   if 'account' in r:r['account']=account
   r['recordKey']='|'.join(['google',account,b['container']['type'],b['container']['id'],r['sourceId']])
 return b
def query(sql,args=()):
 for file in Path('.wrangler/state').rglob('*.sqlite'):
  if file.name.startswith('._'):continue
  with sqlite3.connect(file.resolve().as_uri()+'?mode=ro',uri=True) as db:
   if db.execute("SELECT count(*) FROM sqlite_master WHERE name='ingest_receipts'").fetchone()[0]:return db.execute(sql,args).fetchall()
 raise AssertionError('Local intake database not found')
def stored(sid):return query('SELECT r.state,r.payload FROM ingest_records r JOIN ingest_streams s ON s.id=r.stream_id WHERE s.account=? AND r.record_id=?',(account,sid))
try:
 names=['gmail_initial','gmail_reconcile','calendar_initial','calendar_reconcile','gmail_incremental','calendar_incremental','gmail_removals','calendar_removals','gmail_empty_reconcile','gmail_no_change']
 receipts=[]
 for name in names:
  b=fixture(name);code,result=send(b,issued['token']);assert code==200 and result['status']=='accepted' and result['batchId']==b['batchId'],(name,code,result)
  assert result['absencePruning']=='disabled';receipts.append(result)
  retry=copy.deepcopy(b);retry['generatedAt']=stamp();code,duplicate=send(retry,issued['token']);assert code==200 and duplicate['status']=='duplicate'
  assert duplicate['receivedAt']==result['receivedAt'] and duplicate['deferred']==result['deferred']
  code,receipt=lookup(b['batchId'],issued['token']);assert code==200 and receipt==result
  saved=query('SELECT r.envelope FROM ingest_receipts r JOIN ingest_streams s ON s.id=r.stream_id WHERE s.account=? AND r.batch_id=?',(account,b['batchId']))
  assert json.loads(saved[0][0])==b,'The full validated logical envelope must be durable'
 assert [r['deferred'] for r in receipts]==[0,0,0,1,0,0,3,3,0,0],receipts
 # Neither empty authoritative scans nor older source versions erase the current
 # read state. Null/sparse removals remain review evidence, not guessed tombstones.
 mail=stored('synthetic-mail-001');assert mail[0][0]=='active' and not json.loads(mail[0][1])['unread']
 assert not stored('synthetic-mail-deleted-001')
 assert stored('synthetic-mail-left-001')[0][0]=='scope_exit'
 assert stored('synthetic-calendar-cancelled-001')[0][0]=='cancelled'
 assert not stored('synthetic-series-001_20261024T170000Z')
 state=owner('/api/state');gmail=state['sources'][f'account:{cid}:gmail'];calendar=state['sources'][f'account:{cid}:google']
 assert len(gmail['emails'])==1 and len(calendar['events'])==1 and gmail['partial'] and calendar['partial']
 assert gmail['syncTransport']=='n8n'
 # A same-scope, newer INBOX exit hides its one membership; a later history
 # version restores it. No provider data or legacy cache is modified.
 exit=fresh(fixture('gmail_removals'));exit['deletions']=[];exit['scopeExits']=[{'recordKey':'google|'+account+'|mailbox|all_mail|synthetic-mail-001','sourceId':'synthetic-mail-001','reason':'left_scope','sourceUpdatedAt':'10000000000000000000'}];exit['coverage'].update(deletionCount=0,scopeExitCount=1)
 assert send(exit,issued['token'])[1]['applied']==1
 assert owner('/api/state')['sources'][f'account:{cid}:gmail']['emails']==[]
 entry=fresh(fixture('gmail_incremental'));entry['records'][0].update(sourceVersion='10000000000000000001',sourceUpdatedAt='10000000000000000001')
 assert send(entry,issued['token'])[1]['applied']==1
 assert len(owner('/api/state')['sources'][f'account:{cid}:gmail']['emails'])==1
 # Replayed old full scan, even with a new generation timestamp and ID, cannot
 # overwrite the newer source record or prune it by absence.
 assert send(fresh(fixture('gmail_initial')),issued['token'])[1]['stale']==1
 old_count=len([s for s in owner('/api/ingest-admin')['streams'] if s['account']==account])
 rolling=fresh(entry);rolling['scope']['receivedAfter']='2026-10-17T00:00:00.000Z';assert send(rolling,issued['token'])[0]==200
 assert len([s for s in owner('/api/ingest-admin')['streams'] if s['account']==account])==old_count,'Rolling bounds must not create another stream'
 # A different permitted container on the same account still cannot read this
 # stream's receipt. A broad Site credential is not enough by itself.
 restricted=owner('/api/ingest-admin',{'action':'create','value':{'provider':'google','account':account,'calendarIds':['other-calendar'],'mailboxIds':[]}})
 assert lookup(receipts[0]['batchId'],restricted['token'])[0]==404
 bad=fresh(fixture('gmail_initial'));bad['coverage']['complete']=False;assert send(bad,issued['token'])[0]==422
 bad=fresh(fixture('gmail_incremental'));bad['records'][0]['recordKey']='wrong';assert send(bad,issued['token'])[0]==422
 assert lookup(bad['batchId'],issued['token'])[0]==404
 overview=owner('/api/ingest-admin');assert len([d for d in overview['deferred'] if d['streamId'] in [s['id'] for s in overview['streams'] if s['account']==account]])==7
 print('PASS: all ten v1.1 bodies, atomic durable envelopes/receipts and lookup, replay, additive dashboard baseline, empty full/delta retention, sparse/null evidence, typed removals, precise version ordering, scope re-entry, delayed full scan protection, rolling stream identity, and receipt credential isolation.')
finally:owner('/api/state',{'action':'removeConnection','id':cid})
assert lookup(receipts[0]['batchId'],issued['token'])[0]==401
assert not query('SELECT 1 FROM ingest_deferred WHERE stream_id IN(SELECT id FROM ingest_streams WHERE account=?)',(account,))
print('PASS: synthetic account cleaned up and its credentials revoked; no production workflows or source data were changed.')
