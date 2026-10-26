"""Read-only checks for the combined published app; no fixture/customer writes."""
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

base = sys.argv[1].rstrip("/")
assert urllib.parse.urlparse(base).scheme in ("http", "https"), "Supply the app URL"

def get(path):
    try:
        response = urllib.request.urlopen(base + path, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.headers, response.read()

for attempt in range(12):
    try:
        status, headers, body = get("/api/health")
        if status == 200 and body.strip() == b"Healthy":
            break
    except (urllib.error.URLError, TimeoutError):
        pass
    time.sleep(10)
else:
    raise SystemExit("API/database did not become healthy")

for path in ("/", "/signin", "/profile"):
    status, headers, body = get(path)
    assert status == 200 and "text/html" in headers.get("Content-Type", ""), path
    assert b'id="root"' in body, (path, "React entry document missing")
    assert "connect-src 'self'" in headers.get("Content-Security-Policy", ""), path
    assert headers.get("Cache-Control") == "no-cache", path

assets = set(re.findall(r'(?:src|href)="(/assets/[^"\s]+)"', body.decode()))
assert any(path.endswith(".js") for path in assets), "Built JavaScript missing"
for path in sorted(assets):
    status, headers, content = get(path)
    assert status == 200 and content and "text/html" not in headers.get("Content-Type", ""), path
    assert "immutable" in headers.get("Cache-Control", ""), path

status, headers, body = get("/api/does-not-exist")
assert status == 404 and "application/json" in headers.get("Content-Type", ""), "API fallback"
status, headers, body = get("/assets/does-not-exist.js")
assert status == 404, "Missing assets must not return the SPA document"
status, headers, body = get("/api/auth/csrf")
assert status == 200 and json.loads(body).get("token"), "CSRF endpoint"
assert "no-store" in headers.get("Cache-Control", ""), "API caching"
status, headers, body = get("/api/projects")
assert status == 401, "Anonymous private API access must be denied"
print("Combined app smoke passed: HTML, deep links, assets, CSP, API, CSRF and anonymous denial")
