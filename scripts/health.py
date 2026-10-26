import json,sys,urllib.request,time
url=sys.argv[1].rstrip('/')+'/api/health'
for attempt in range(30):
 try:
  with urllib.request.urlopen(url,timeout=5) as r:
   if r.status==200: print('API and database healthy');break
 except Exception: time.sleep(2)
else: raise SystemExit('API health check failed')
