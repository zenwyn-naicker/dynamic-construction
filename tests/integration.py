"""Live API regression. Run only against an isolated reference/test database.
Requires isolated FixtureLoader data and TEST_PASSWORD matching Fixture__Password.
Uses only Python's standard library. Exits nonzero on any failed check.
"""
import json, os, sys, uuid, time, urllib.request, urllib.error, http.cookiejar, datetime, concurrent.futures
BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:5080')+'/api'
PASSWORD=os.environ['TEST_PASSWORD']; checks=[]
def check(name,condition):
 assert condition,name
 checks.append(name);print('PASS',name,flush=True)
class Client:
 def __init__(self,email=None):
  self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));self.token=None
  if email:self.call('/auth/login','POST',{'email':email,'password':PASSWORD,'code':None});self.token=None
 def call(self,path,method='GET',data=None,expected=200,csrf=True,raw=False,headers=None):
  hs=headers or {}
  if method!='GET' and csrf:
   if not self.token:self.token=self.call('/auth/csrf')['token']
   hs['X-CSRF-TOKEN']=self.token
  body=data if isinstance(data,bytes) else json.dumps(data).encode() if data is not None else None
  if body is not None and not isinstance(data,bytes):hs['Content-Type']='application/json'
  req=urllib.request.Request(BASE+path,data=body,headers=hs,method=method)
  try:
   with self.opener.open(req,timeout=30) as r:status=r.status;out=r.read()
  except urllib.error.HTTPError as e:status=e.code;out=e.read()
  assert status==expected, f'{method} {path}: expected {expected}, got {status}: {out[:500]!r}'
  if raw:return out
  result = json.loads(out) if out and out[:1] in (b'{',b'[') else None
  return result['items'] if isinstance(result,dict) and 'pageSize' in result else result
visitor=Client();admin=Client('admin@example.test');staff=Client('staff@example.test');client=Client('thandi@example.test');other=Client('lindi@example.test')
visitor.call('/projects',expected=401);staff.call('/users',expected=403);staff.call('/audit',expected=403);check('Anonymous and Staff/Admin boundaries',True)
visitor.call('/quotes/estimate','POST',{'type':'Deck','length':6,'width':4,'finish':'Standard'},expected=400,csrf=False);check('Antiforgery required',True)
est=visitor.call('/quotes/estimate','POST',{'type':'Deck','length':6,'width':4,'finish':'Standard','total':1});check('Authoritative estimate ignores tampered total',est['total']==54000)
for t,l,w,f in [('Boat',6,4,'Standard'),('Deck',-1,4,'Standard'),('Boundary wall',6,8,'Standard'),('Deck',100,100,'Standard'),('Pool',6,4,'Premium'),('Concrete slab',6,4,'Standard'),('Other',6,4,'Standard')]:visitor.call('/quotes/estimate','POST',dict(type=t,length=l,width=w,finish=f),expected=400)
check('Type, dimensions, area and options validate',True)
payload=dict(submissionKey=str(uuid.uuid4()),type='Deck',length=6,width=4,finish='Standard',name='Thandi Mokoena',email='thandi@example.test',phone='0825550142',site='Reference test site, Durban North',notes='API regression fixture',consent=True)
visitor.call('/quotes','POST',{**payload,'consent':False},expected=400);visitor.call('/quotes','POST',{**payload,'email':'invalid'},expected=400)
q=visitor.call('/quotes','POST',payload);retry=visitor.call('/quotes','POST',payload);check('Persisted idempotent quote submission',q['id']==retry['id'])
visitor.call('/quotes','POST',{**payload,'notes':'different'},expected=409);check('Idempotency key payload conflict',True)
quote=next(x for x in staff.call('/operations/quotes') if x['id']==q['id']);check('Staff sees stored priced items',quote['items'][0]['amount']==54000)
custom={**payload,'submissionKey':str(uuid.uuid4()),'type':'Other','length':5,'width':5,'description':'Concrete driveway with a drainage channel, roughly 30 m².'}
visitor.call('/quotes','POST',{**custom,'description':'Too short'},expected=400);c=visitor.call('/quotes','POST',custom)
stored=next(x for x in staff.call('/operations/quotes') if x['id']==c['id'])
check('Custom requests keep their description without a fabricated estimate',c['estimate'] is None and stored['description']==custom['description'] and stored['items']==[] and stored['length']==0)
uid=client.call('/auth/me')['id']
def decision(state,**kw):
 global quote
 old=quote['version'];quote=staff.call('/operations/quotes/'+q['id']+'/decision','POST',dict(version=old,status=state,reason='Verified client and recorded acceptance evidence.',formalAmount=None,validUntil=None,clientId=uid,**kw));return old
staff.call('/operations/quotes/'+q['id']+'/project','POST',dict(version=quote['version'],name='Invalid project'),expected=400)
old=decision('Under Review')
staff.call('/operations/quotes/'+q['id']+'/decision','POST',dict(version=old,status='Rejected',reason='Stale decision'),expected=409)
# Formal amount/expiry are separate from immutable indicative estimate.
quote=staff.call('/operations/quotes/'+q['id']+'/decision','POST',dict(version=quote['version'],status='Quoted',reason='Site assessment complete.',formalAmount=49000,validUntil=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(days=14)).isoformat(),clientId=uid))
# Acceptance must remain recoverable until a verified active client is linked.
unlinked = visitor.call('/quotes', 'POST', {**payload, 'submissionKey': str(uuid.uuid4())})
unlinked = next(x for x in staff.call('/operations/quotes') if x['id'] == unlinked['id'])
for state in ['Under Review', 'Quoted']:
 unlinked = staff.call('/operations/quotes/' + unlinked['id'] + '/decision', 'POST', dict(version=unlinked['version'], status=state, reason='Regression: anonymous quote review.', formalAmount=49000, validUntil=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(days=14)).isoformat(), clientId=None))
accept = dict(version=unlinked['version'], status='Accepted', reason='Verified acceptance recorded.', clientId=None)
path = '/operations/quotes/' + unlinked['id']
staff.call(path + '/decision', 'POST', accept, expected=400)
staff.call(path + '/decision', 'POST', {**accept, 'clientId': admin.call('/auth/me')['id']}, expected=400)
unchanged = next(x for x in staff.call('/operations/quotes') if x['id'] == unlinked['id'])
check('Unlinked acceptance fails without changing quote state or version', unchanged['status'] == 'Quoted' and unchanged['version'] == unlinked['version'])
linked = staff.call(path + '/decision', 'POST', {**accept, 'clientId': uid})
converted = staff.call(path + '/project', 'POST', dict(version=linked['version'], name='Verified client regression'))
check('Linking a verified client allows acceptance and conversion after rejection', client.call('/projects/' + converted['id'])['id'] == converted['id'])

decision('Accepted');p=staff.call('/operations/quotes/'+q['id']+'/project','POST',dict(version=quote['version'],name='Mokoena Residence Deck'))
again=staff.call('/operations/quotes/'+q['id']+'/project','POST',dict(version=quote['version'],name='Mokoena Residence Deck'));check('Accepted quote converts once',p['id']==again['id']);pid=p['id'];prefix='/projects/'+pid
project=client.call(prefix);check('Client sees linked project',project['contractValue']==49000)
for suffix in ['','/files','/finance','/changes']:other.call(prefix+suffix,expected=404)
check('Cross-client project, file list, finance and change access denied',True)
project=staff.call(prefix);staff.call(prefix+'/state','POST',dict(version=project['version'],status='Completed',reason='Not allowed'),expected=400)
staff.call(prefix+'/state','POST',dict(version=project['version'],status='Active',reason='Site mobilisation started.'))
project=staff.call(prefix);m=staff.call(prefix+'/milestones','POST',dict(version=project['version'],title='Site preparation',dueAt='2026-10-01T00:00:00Z',complete=False,published=True))
project=staff.call(prefix);staff.call(prefix+'/state','POST',dict(version=project['version'],status='Completed',reason='Not all milestones done.'),expected=400)
check('Project lifecycle and incomplete completion enforced',True)
staff.call(prefix+'/updates','POST',dict(message='Site preparation update.',published=True));check('Client sees published progress',len(client.call(prefix)['updates'])==1)
budget=staff.call(prefix+'/finance/budgets','POST',dict(version=str(uuid.UUID(int=0)),description='Materials',amount=30000,published=False));check('Unpublished budget hidden',len(client.call(prefix+'/finance')['budgets'])==0)
staff.call(prefix+'/finance/budgets','POST',{**budget,'published':True});inv=staff.call(prefix+'/finance/invoices','POST',dict(version=str(uuid.UUID(int=0)),number='INV-'+uuid.uuid4().hex[:10],description='Deposit',amount=10000,paid=2500,dueAt='2026-10-01T00:00:00Z',published=False))
check('Unpublished invoice hidden',len(client.call(prefix+'/finance')['invoices'])==0)
staff.call(prefix+'/finance/invoices','POST',{**inv,'paid':10001},expected=400);published=staff.call(prefix+'/finance/invoices','POST',{**inv,'published':True});staff.call(prefix+'/finance/invoices','POST',{**inv,'published':True},expected=409)
staff.call(prefix+'/finance/invoices','POST',{**inv,'id':None},expected=409);fin=client.call(prefix+'/finance');check('Finance totals reconcile and stale/duplicate invoices fail',fin['outstanding']==7500 and fin['budgetTotal']==30000)
change=client.call(prefix+'/changes','POST',{'description':'Please extend the deck steps by one metre.'});client.call(prefix+'/changes/'+change['id']+'/decision','POST',dict(version=change['version'],status='Approved',reason='Own approval',costImpact=0,daysImpact=0),expected=403)
for state in ['Under Review','Approved','Implemented','Closed']:
 change=staff.call(prefix+'/changes/'+change['id']+'/decision','POST',dict(version=change['version'],status=state,reason='Recorded scope review and decision.',costImpact=1500,daysImpact=2))
check('Change history and final decision preserved',change['decision']=='Approved' and len(change['history'])==5)
notes=client.call('/notifications');note=notes[0];other.call('/notifications/'+note['id']+'/read','POST',expected=404);client.call('/notifications/'+note['id']+'/read','POST',expected=204);client.call('/notifications/'+note['id']+'/read','POST',expected=204);check('Recipient ownership and repeat acknowledgement',True)
boundary='dc-'+uuid.uuid4().hex
filebytes=b'%PDF-1.4\nReference document bytes\n%%EOF'
def upload(name,data,expected=200):
 content=b''
 for k,v in [('category','Document'),('published','false')]:content+=f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
 content+=f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/pdf\r\n\r\n'.encode()+data+f'\r\n--{boundary}--\r\n'.encode()
 return staff.call(prefix+'/files','POST',content,expected=expected,headers={'Content-Type':'multipart/form-data; boundary='+boundary})
upload('oversized.pdf',b'%PDF-'+b'x'*10000000,400);upload('empty.pdf',b'',400);upload('malicious.pdf',b'not a PDF',400);upload('script.exe',filebytes,400);file=upload('reference.pdf',filebytes);check('Uploaded unpublished file hidden',client.call(prefix+'/files')==[])
file=staff.call(prefix+'/files')[0];staff.call(prefix+'/files/'+file['id'],'PUT',dict(version=file['version'],published=True),expected=204)
other.call(prefix+'/files/'+file['id']+'/download',expected=404);check('Authorised download returns original bytes',client.call(prefix+'/files/'+file['id']+'/download',raw=True)==filebytes)
content=staff.call('/content/manage');hero=next((x for x in content if x['key']=='hero'),None)
staff.call('/content/hero','PUT',dict(version=hero['version'] if hero else str(uuid.UUID(int=0)),title='Plan your project with confidence.',body='Get an indicative quote and track your construction work from one secure client portal.',published=True));check('Content publication persists',any(x['key']=='hero' for x in visitor.call('/content')))
entries=admin.call('/audit')['items'];check('Audit records contain real business actions',any(x['action']=='File.Upload' for x in entries));admin.call('/audit/'+entries[0]['id'],'DELETE',expected=404)
otheruser=next(x for x in admin.call('/users') if x['email']=='lindi@example.test');admin.call('/users/'+otheruser['id'],'PUT',dict(fullName=otheruser['fullName'],suspended=True,concurrencyStamp=otheruser['concurrencyStamp']),expected=204);other.call('/projects',expected=401);otheruser=next(x for x in admin.call('/users') if x['id']==otheruser['id']);admin.call('/users/'+otheruser['id'],'PUT',dict(fullName=otheruser['fullName'],suspended=False,concurrencyStamp=otheruser['concurrencyStamp']),expected=204);check('Suspension revokes active access',True)
# Avoid lockout tests against shared fixture accounts; create a dedicated test account.
email='test-'+uuid.uuid4().hex[:8]+'@example.test';visitor.call('/auth/register','POST',dict(fullName='Regression Client',email=email,password=PASSWORD,role='Admin'));fresh=Client(email);check('Registration ignores privilege overposting',fresh.call('/auth/me')['roles']==['Client']);check('New client has empty projects',fresh.call('/projects')==[])
fresh.call('/auth/logout','POST',expected=204);fresh.token=None;fresh.call('/projects',expected=401);check('Logout blocks further access',True)

# Managed pricing is authoritative, versioned and independent of submitted quotes.
rates=staff.call('/pricing');rate=next(x for x in rates if x['type']=='Deck' and x['finish']=='Standard')
staff.call('/pricing','PUT',{**rate,'unitRate':1.001},expected=400)
changed=staff.call('/pricing','PUT',{**rate,'unitRate':2100})
staff.call('/pricing','PUT',rate,expected=409)
check('Managed pricing rejects fractional cents and stale edits',True)
check('Published rate drives subsequent estimates',visitor.call('/quotes/estimate','POST',dict(type='Deck',length=6,width=4,finish='Standard'))['total']==50400)
hidden=staff.call('/pricing','PUT',{**changed,'published':False})
unpriced=visitor.call('/quotes/estimate','POST',dict(type='Deck',length=6,width=4,finish='Standard'))
check('Unpublished pricing offers no online price without a fabricated fallback',unpriced['total'] is None and unpriced['area']==24)
check('Requests without a published rate are kept for pricing after assessment',visitor.call('/quotes','POST',{**payload,'submissionKey':str(uuid.uuid4())})['estimate'] is None)
check('Quote retry retains its original price after rate withdrawal',visitor.call('/quotes','POST',payload)['estimate']==54000)
staff.call('/pricing','PUT',{**hidden,'unitRate':2250,'published':True})
client.call('/pricing',expected=403)
entry=dict(id=None,version=str(uuid.UUID(int=0)),title='Completed regression project',location='Test site',projectType='Deck',summary='Completed project summary for automated verification.',details='Approved test project details for publication verification.',completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),durationDays=20,published=False)
item=staff.call('/portfolio','POST',entry)
check('Unpublished portfolio entries stay private',item['id'] not in [x['id'] for x in visitor.call('/portfolio')])
item=staff.call('/portfolio','POST',{**item,'published':True})
check('Published portfolio content comes from persisted records',item['id'] in [x['id'] for x in visitor.call('/portfolio')])
staff.call('/portfolio','POST',{**entry,'id':item['id']},expected=409)
staff.call('/portfolio','POST',{**entry,'durationDays':0},expected=400)
check('Portfolio validation and stale publication protection',True)
for n in range(26):staff.call('/portfolio','POST',{**entry,'title':'Pagination test '+str(n),'published':True})
first=json.loads(staff.call('/portfolio/manage?page=1',raw=True));second=json.loads(staff.call('/portfolio/manage?page=2',raw=True))
check('Pagination returns bounded distinct pages and a full total',len(first['items'])==25 and first['total']>=27 and len(second['items'])>=2 and not ({x['id'] for x in first['items']} & {x['id'] for x in second['items']}))
for path in ['/portfolio','/projects','/operations/quotes','/users','/notifications']:
 admin.call(path+'?page=0',expected=400)
check('Invalid pagination is rejected consistently',True)
otheruser=next(x for x in admin.call('/users') if x['email']=='lindi@example.test')
admin.call('/users/'+otheruser['id'],'PUT',dict(fullName=otheruser['fullName'],suspended=False,concurrencyStamp='stale'),expected=409)
check('Stale account edits cannot overwrite current account state',True)
staff.call('/notifications','POST',dict(recipients=[admin.call('/auth/me')['id']],message='Invalid client recipient',projectId=None),expected=400)
check('Client notification recipients must be client accounts',True)
report={'baseUrl':BASE,'checks':checks,'passed':len(checks),'projectId':pid,'quoteId':q['id'],'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat()}
os.makedirs('artifacts',exist_ok=True);open('artifacts/integration-'+('sql' if '5081' in BASE else 'local')+'.json','w').write(json.dumps(report,indent=2));print(json.dumps({'passed':len(checks),'project':pid}))
