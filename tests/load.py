"""Bounded authenticated read load against an isolated seeded test API.
Run after a quiet rate-limit window. This is not a cloud capacity certification.
"""
import concurrent.futures, http.cookiejar, json, os, time, urllib.request, urllib.error
base = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:5081') + '/api'
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
token = json.load(opener.open(base + '/auth/csrf'))['token']
request = urllib.request.Request(base + '/auth/login', json.dumps(dict(email='thandi@example.test', password=os.environ['TEST_PASSWORD'])).encode(), {'Content-Type': 'application/json', 'X-CSRF-TOKEN': token})
opener.open(request).close()
cookie = '; '.join(c.name + '=' + c.value for c in jar)
def read(_):
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(urllib.request.Request(base + '/projects', headers={'Cookie': cookie}), timeout=10) as r:
            assert isinstance(json.load(r)['items'], list)
            status = r.status
    except urllib.error.HTTPError as e:
        status = e.code
    return status, (time.perf_counter() - start) * 1000
start = time.perf_counter()
with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
    results = list(pool.map(read, range(150)))
times = sorted(t for _, t in results)
report = dict(requests=len(results), concurrency=20, successful=sum(s == 200 for s, _ in results), p95Ms=round(times[int(len(times)*.95)-1],2), maxMs=round(max(times),2), durationSeconds=round(time.perf_counter()-start,2), scope='Local SQL Server authenticated project reads; no cloud capacity claim')
os.makedirs('artifacts', exist_ok=True)
with open('artifacts/load.json','w') as f: json.dump(report,f,indent=2)
print(json.dumps(report))
assert report['successful'] == 150 and report['p95Ms'] < 2000, report
