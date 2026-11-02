"""Local-only synthetic regression. Run with the local dev server on port 5173.
No OpenAI requests; creates and cleans up only its own local test rows.
"""
import copy,datetime,http.cookiejar,json,sqlite3,urllib.request,urllib.error,uuid
from pathlib import Path
base='http://127.0.0.1:5173'
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
client.open(base+'/signin-with-chatgpt?return_to=%2F').read()
def call(path,body=None):
 try:
  with client.open(urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','Origin':base})) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def save(t):return call('/api/state',{'action':'task','value':t})
def task(title,**extra):return dict(id=str(uuid.uuid4()),title=title,project='Synthetic save regression',lane='Personal',stakeholder='',deadline='2026-11-30',minutes=10,status='open',output='',sourceUrl='',dependsOn=[],parentId=None,**extra)
prep=task('Synthetic prepare delivery');bags=task('Synthetic tool bags');bags['dependsOn']=[prep['id']];bedding=task('Synthetic bedding');bedding['parentId']=prep['id']
ids=[t['id'] for t in [prep,bags,bedding]];pids=[];db=None
try:
 for t in [prep,bags,bedding]:assert save(t)[0]==200
 for f in Path('.wrangler/state').rglob('*.sqlite'):
  if f.name.startswith('._'):continue
  candidate=sqlite3.connect(f)
  try:
   row=candidate.execute('SELECT owner FROM commitments WHERE id=?',(prep['id'],)).fetchone()
   if row:db=candidate;owner=row[0];break
  except sqlite3.OperationalError:pass
  candidate.close()
 assert db is not None
 code,data=save(dict(bags,status='done'));assert code==400 and prep['title'] in data['error'],(code,data)
 assert save(dict(bags,status='doing'))[0]==200
 assert save(dict(bedding,status='done'))[0]==200
 assert save(dict(prep,status='done'))[0]==200
 # Restore the prerequisite to reproduce failed proposals without any AI request.
 assert save(prep)[0]==200
 state=call('/api/state')[1];current=next(t for t in state['tasks'] if t['id']==bags['id']);payload=dict(current,status='done')
 def proposal(status,created=None):
  pid=str(uuid.uuid4());pids.append(pid)
  db.execute('INSERT INTO chat_proposals (id,owner,action,payload,baseline,status,created_at) VALUES (?,?,?,?,?,?,?)',(pid,owner,'task',json.dumps(payload),json.dumps(current,separators=(',',':')),status,created or datetime.datetime.now(datetime.timezone.utc).isoformat()));db.commit();return pid
 pid=proposal('pending')
 code,data=call('/api/aegis',{'action':'apply','id':pid});assert code==400 and prep['title'] in data['error'],(code,data)
 assert db.execute('SELECT status FROM chat_proposals WHERE id=?',(pid,)).fetchone()[0]=='failed'
 code,data=call('/api/aegis',{'action':'apply','id':pid});assert code==400 and prep['title'] in data['error'] and 'expired' not in data['error'],(code,data)
 for status,expected in [('processing','already being processed'),('pending','expired')]:
  pid=proposal(status,'2020-01-01T00:00:00Z');code,data=call('/api/aegis',{'action':'apply','id':pid});assert code==400 and expected in data['error'],(status,code,data)
 assert save(dict(prep,status='done'))[0]==200
 pid=proposal('pending');assert call('/api/aegis',{'action':'apply','id':pid})[0]==200
 code,data=call('/api/aegis',{'action':'apply','id':pid});assert code==200 and data['applied']
 print('PASS: local HTTP edits, blocked completion names prerequisite, child completion before parent, failed proposal retry, processing versus expired states, successful proposal and idempotent apply. No model calls or production changes.')
finally:
 if db:
  db.executemany('DELETE FROM chat_proposals WHERE id=?',[(i,) for i in pids]);db.executemany('DELETE FROM commitments WHERE id=?',[(i,) for i in ids]);db.commit();db.close()
