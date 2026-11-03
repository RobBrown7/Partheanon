"""Local synthetic pilot HTTP test. No provider requests or credential values printed."""
import concurrent.futures,copy,datetime,http.cookiejar,json,sqlite3,urllib.request,urllib.error,uuid
from pathlib import Path
base='http://127.0.0.1:5173';client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));client.open(base+'/signin-with-chatgpt?return_to=%2F').read()
def call(path,body=None,headers=None,visitor=True):
 request=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'Origin':base} if visitor else {}),**(headers or {})})
 try:
  with (client.open if visitor else urllib.request.urlopen)(request) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def admin(action,**kw):return call('/api/focus-calendar',dict(action=action,**kw))
def worker(action,value=None,key=None):return call('/api/focus-worker',{'action':action,**({'value':value} if value else {})},{'Authorization':'Bearer '+(key or token)},False)
def state():return call('/api/state')[1]
def stamp(d):return d.isoformat(timespec='milliseconds').replace('+00:00','Z')
instant=datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(days=20);start=stamp(instant.replace(hour=3,minute=0,second=0,microsecond=0));end=stamp(instant.replace(hour=4,minute=0,second=0,microsecond=0))
cid=str(uuid.uuid4());tid=str(uuid.uuid4());bid=str(uuid.uuid4());account='focus-'+uuid.uuid4().hex+'@example.test';db=None;token='';owner=None
try:
 assert admin('configure',value={'account':'rob.k.brown.7@gmail.com','calendarId':'primary'})[0]==400
 assert call('/api/state',{'action':'connection','value':{'id':cid,'provider':'google','account':account,'lane':'Personal','calendar':True,'mail':False}})[0]==200
 assert admin('configure',value={'account':account,'calendarId':'synthetic@group.calendar.google.com'})[0]==200
 assert worker('claim',key='bad')[0]==401
 code,key=admin('key');assert code==200;token=key['token']
 assert worker('claim')[0]==400 # paused
 assert admin('enable')[0]==200
 task={'id':tid,'title':'Synthetic private task never sent to Google','project':'Synthetic focus pilot','lane':'Personal','stakeholder':'','deadline':start[:10],'minutes':60,'status':'open','output':'','sourceUrl':''}
 assert call('/api/state',{'action':'task','value':task})[0]==200
 assert call('/api/state',{'action':'block','value':{'id':bid,'taskId':tid,'title':task['title'],'start':start,'end':end}})[0]==200
 value={'blockId':bid,'start':start,'end':end,'acknowledgeProvisional':True}
 assert admin('approve',value={**value,'acknowledgeProvisional':False})[0]==400
 code,q=admin('approve',value=value);assert code==200 and q['state']=='queued',(code,q)
 assert admin('approve',value=value)[0]==400
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:claims=list(pool.map(lambda _:worker('claim'),range(2)))
 jobs=[r[1]['job'] for r in claims if r[0]==200 and r[1].get('job')];assert len(jobs)==1,claims
 j=jobs[0];assert j['title']=='Focus time' and j['attendees']==[] and j['sendUpdates']=='none';assert task['title'] not in json.dumps(j)
 v={'id':j['id'],'claimToken':j['claimToken']};assert worker('status',v)[1]['mayWrite']
 assert worker('verified',{**v,'event':{'id':'wrong'}})[0]==400
 def event(job,etag='"1"'):return {'id':job['eventId'],'etag':etag,'status':'confirmed','summary':job['title'],'start':{'dateTime':job['start']},'end':{'dateTime':job['end']},'visibility':'private','transparency':'opaque','attendees':[],'extendedProperties':{'private':{'partheanonBlockId':job['blockId'],'partheanonCommandId':job['id']}}}
 e=event(j);assert worker('verified',{**v,'event':{**e,'attendees':[{'email':'guest@example.test'}]}})[0]==400
 assert worker('verified',{**v,'event':e})[1]['state']=='confirmed'
 # Discarded response recovery resolves through durable status and identical replay.
 assert worker('status',v)[1]['receipt']['etag']=='"1"'
 assert worker('verified',{**v,'event':e})[1]['duplicate']
 assert worker('verified',{**v,'event':{**e,'etag':'"different"'}})[0]==400
 newer={**value,'start':stamp(instant.replace(hour=5,minute=0,second=0,microsecond=0)),'end':stamp(instant.replace(hour=6,minute=0,second=0,microsecond=0))}
 assert admin('approve',value=newer)[0]==200
 j2=worker('claim')[1]['job'];assert j2['operation']=='reschedule' and j2['eventId']==j['eventId'] and j2['expectedEtag']=='"1"'
 v2={'id':j2['id'],'claimToken':j2['claimToken']}
 assert admin('pause')[0]==200 and not worker('status',v2)[1]['mayWrite']
 assert admin('enable')[0]==200
 assert worker('attention',v2)[0]==200
 assert admin('retry',id=j2['id'])[0]==200
 j3=worker('claim')[1]['job'];assert j3['id']==j2['id'] and j3['claimToken']!=j2['claimToken']
 assert worker('verified',{**v2,'event':event(j2,'"2"')})[0]==400 # stale lease
 v3={'id':j3['id'],'claimToken':j3['claimToken']};assert worker('verified',{**v3,'event':event(j3,'"2"')})[0]==200
 b=next(b for b in state()['blocks'] if b['id']==bid);assert b['start']==newer['start'] and b['end']==newer['end']
 assert admin('revoke')[0]==200 and worker('claim')[0]==401
 print('PASS: owner scope, primary-calendar rejection, pause/key gates, explicit approval, privacy, concurrent claims, readback validation, durable receipt/replay, reschedule same event ID, stale lease, uncertain recovery and key revocation. No Google requests.')
finally:
 for f in Path('.wrangler/state').rglob('*.sqlite'):
  if f.name.startswith('._'):continue
  candidate=sqlite3.connect(f)
  try:row=candidate.execute('SELECT owner FROM account_connections WHERE id=?',(cid,)).fetchone()
  except sqlite3.OperationalError:row=None
  if row:db=candidate;owner=row[0];break
  candidate.close()
 if db:
  db.execute('DELETE FROM focus_commands WHERE calendar_config_id IN (SELECT id FROM focus_calendars WHERE owner=? AND account=?)',(owner,account))
  db.execute('DELETE FROM focus_calendars WHERE owner=? AND account=?',(owner,account))
  for table,key,vals in [('focus_blocks','id',[bid]),('commitments','id',[tid]),('account_connections','id',[cid])]:
   db.execute(f'DELETE FROM {table} WHERE {key}=?',vals)
  db.commit();db.close()
