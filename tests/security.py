"""Isolated Identity/TOTP regression; TEST_PASSWORD and TEST_BASE_URL as integration.py.
Never runs against real user accounts. Secrets and TOTP seeds are not printed.
"""
import base64, hashlib, hmac, http.cookiejar, json, os, struct, time, urllib.request, urllib.error, uuid
base=os.environ.get('TEST_BASE_URL','http://127.0.0.1:5081')+'/api'
password=os.environ['TEST_PASSWORD']; email='security-'+uuid.uuid4().hex[:10]+'@example.test'
jar=http.cookiejar.CookieJar(); client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)); token=None
def call(path,data=None,expected=200,method=None):
    global token
    headers={}
    if data is not None:
        if token is None: token=call('/auth/csrf')['token']
        headers={'Content-Type':'application/json','X-CSRF-TOKEN':token}
    request=urllib.request.Request(base+path,None if data is None else json.dumps(data).encode(),headers,method=method)
    try:
        with client.open(request,timeout=20) as r: status=r.status; body=r.read()
    except urllib.error.HTTPError as e: status=e.code; body=e.read()
    assert status==expected, (path,status,expected)
    return json.loads(body) if body and body[:1] in (b'{',b'[') else None
call('/auth/register',dict(fullName='Identity Regression',email=email,password=password))
call('/auth/login',dict(email=email,password=password)); token=None
key=call('/auth/mfa/setup',{})['key']
def otp():
    seed=base64.b32decode(key.upper()+'='*((8-len(key)%8)%8))
    digest=hmac.new(seed,struct.pack('>Q',int(time.time())//30),hashlib.sha1).digest(); offset=digest[-1]&15
    return str((struct.unpack('>I',digest[offset:offset+4])[0]&0x7fffffff)%1000000).zfill(6)
codes=call('/auth/mfa/enable',dict(code=otp()))['recoveryCodes']
assert len(codes)==10 and len(set(codes))==10
call('/auth/mfa/enable',dict(code=otp()),400)
recovered_id=call('/auth/me')['id']
assert call('/auth/me')['twoFactorEnabled']
call('/auth/logout',{},204); token=None
prompt=call('/auth/login',dict(email=email,password=password))
assert prompt['requiresMfaCode'] and not prompt['requiresMfaSetup']
call('/auth/login',dict(email=email,password=password,code='invalid'),401)
call('/auth/login',dict(email=email,password=password,code=otp(),rememberDevice=True)); token=None
assert call('/auth/me')['email']==email
trust_cookie=next(c for c in jar if c.name.startswith('dc.trust.'))
original_expiry=trust_cookie.expires
call('/auth/logout',{},204); token=None
assert next(c for c in jar if c.name.startswith('dc.trust.')).expires==original_expiry
assert not call('/auth/login',dict(email=email,password=password))['requiresMfaCode']
token=None
call('/auth/mfa/forget-device',{},204)
call('/auth/logout',{},204); token=None
assert call('/auth/login',dict(email=email,password=password))['requiresMfaCode']
# Replacement requires password and MFA; no code may reset the account twice.
call('/auth/login',dict(email=email,password=password,code=otp(),rememberDevice=True)); token=None
call('/auth/recovery/codes',dict(password='incorrect',code=otp()),401)
call('/auth/recovery/codes',dict(password=password,code='invalid'),401)
replacement=call('/auth/recovery/codes',dict(password=password,code=otp()))['recoveryCodes']
call('/auth/recovery',dict(email=email,recoveryCode=codes[0],newPassword=password),400)
call('/auth/recovery',dict(email=email,recoveryCode=replacement[0],newPassword='weak'),400)
# The failed password validation must not consume the recovery code.
old_client=client
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())); token=None
new_password=password+'-recovered'
call('/auth/recovery',dict(email=email,recoveryCode=replacement[0],newPassword=new_password),204); token=None
recovered_client=client
client=old_client
call('/auth/me',expected=401)
client=recovered_client
call('/auth/recovery',dict(email=email,recoveryCode=replacement[0],newPassword=new_password),400)
call('/auth/recovery',dict(email=email,recoveryCode=replacement[1],newPassword=new_password),400)
call('/auth/login',dict(email=email,password=password),401)
call('/auth/login',dict(email=email,password=new_password)); token=None
assert not call('/auth/me')['twoFactorEnabled']
key=call('/auth/mfa/setup',{})['key']
call('/auth/mfa/enable',dict(code=otp()))
# Recovery must reject the old trust even after MFA is enabled again.
client=old_client; token=None
assert call('/auth/login',dict(email=email,password=new_password))['requiresMfaCode']
client=recovered_client; token=None
call('/auth/logout',{},204); token=None
password=new_password
# Allow the production credential rate window to refill for lockout checks.
time.sleep(61)
for _ in range(5): call('/auth/login',dict(email=email,password=password,code='invalid'),401)
call('/auth/login',dict(email=email,password=password,code=otp()),401)
# Recovery also works for clients without MFA and respects account lockout.
email='recovery-'+uuid.uuid4().hex[:10]+'@example.test'
call('/auth/register',dict(fullName='Recovery Regression',email=email,password=password))
call('/auth/login',dict(email=email,password=password)); token=None
codes=call('/auth/recovery/codes',dict(password=password))['recoveryCodes']
call('/auth/logout',{},204); token=None
for _ in range(5):
    call('/auth/recovery',dict(email=email,recoveryCode='invalid',newPassword=password),400)
call('/auth/recovery',dict(email=email,recoveryCode=codes[0],newPassword=password),400)
call('/auth/login',dict(email=email,password=password),401)
call('/auth/recovery',dict(email='missing@example.test',recoveryCode=codes[0],newPassword=password),400)
# Suspension cannot be bypassed with a saved recovery code; recovery is audited.
email='suspended-recovery-'+uuid.uuid4().hex[:10]+'@example.test'
call('/auth/register',dict(fullName='Suspended Recovery',email=email,password=password))
call('/auth/login',dict(email=email,password=password)); token=None
codes=call('/auth/recovery/codes',dict(password=password))['recoveryCodes']
call('/auth/logout',{},204); token=None
call('/auth/login',dict(email='admin@example.test',password=os.environ['TEST_PASSWORD'])); token=None
account=call('/users?search='+email)['items'][0]
call('/users/'+account['id'],dict(fullName=account['fullName'],concurrencyStamp=account['concurrencyStamp'],suspended=True),204,method='PUT')
audit=call('/audit?search=Account.Recovered')['items']
assert any(entry['actorId']==recovered_id and entry['entityId']==recovered_id for entry in audit)
call('/auth/logout',{},204); token=None
call('/auth/recovery',dict(email=email,recoveryCode=codes[0],newPassword=password),400)
report={'checks':['TOTP enrollment','TOTP enabled persisted','MFA prompt returned after valid password','Invalid code denied','Valid code signs in','Five failed codes lock account','Valid code cannot bypass lockout', 'Ten distinct recovery codes issued', 'MFA cannot be enabled twice', 'Code replacement requires password and MFA', 'Replacement invalidates previous codes', 'Weak password does not consume recovery code', 'Recovery revokes existing sessions', 'Recovery revokes all old codes', 'Old password denied after recovery', 'New password signs in', 'Authenticator can be enrolled again', 'Clients without MFA can save recovery codes', 'Failed recovery attempts lock account', 'Valid recovery code cannot bypass lockout', 'Unknown account rejected', 'Suspension blocks recovery', 'Recovery records the account in the audit trail'],'passed':23}
report['checks'].extend(['Remembered device skips MFA after logout', 'Logout preserves original trust expiry', 'Forgetting device requires MFA again', 'Recovery revokes remembered device trust'])
report['passed']=len(report['checks'])
os.makedirs('artifacts',exist_ok=True)
with open('artifacts/security.json','w') as f: json.dump(report,f,indent=2)
print(json.dumps(report))
