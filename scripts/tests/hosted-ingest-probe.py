"""Read-only hosted access-boundary probe. Never creates keys or writes records."""
import getpass,json,urllib.request,urllib.error
endpoint='https://partheanon-forge.athena-works-8404.chatgpt.site/api/ingest'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
opener=urllib.request.build_opener(NoRedirect())
def probe(service=None):
 headers={'Content-Type':'application/json','Authorization':'Bearer ptn_'+'0'*64}
 if service:headers['OAI-Sites-Authorization']='Bearer '+service
 req=urllib.request.Request(endpoint,data=b'{}',headers=headers)
 try:
  with opener.open(req,timeout=30) as r:return r.status,r.headers.get('Content-Type',''),r.read()
 except urllib.error.HTTPError as e:return e.code,e.headers.get('Content-Type',''),e.read()
status,ctype,body=probe();print('Anonymous hosting response:',status)
assert status in [301,302,303,307,308,401,403], 'Private hosting boundary unexpectedly allowed an anonymous request.'
service=getpass.getpass('Site service credential (hidden): ')
status,ctype,body=probe(service);service=None
assert status==401 and 'application/json' in ctype,'Service access did not reach the authenticated intake route.'
data=json.loads(body);assert data.get('error',{}).get('code')=='unauthorized'
print('PASS: Site remains private; valid Site service access reaches intake; invalid account key is rejected with JSON 401. No records were written.')
