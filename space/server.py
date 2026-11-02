"""ViKernel Desktop Space server: serves the static desktop and proxies /api/ag/* server-side
to a private Agent Guard backend. Backend credentials live in Space secrets and never reach the browser."""
import json, os, time, urllib.error, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BACKEND = os.environ.get("BACKEND_URL", "").rstrip("/")
BACKEND2 = os.environ.get("BACKEND2_URL", "").rstrip("/")  # in-weights graft backend (GPU)
HF_AUTH = os.environ.get("BACKEND_HF_TOKEN", "")
BK_TOKEN = os.environ.get("BACKEND_TOKEN", "")
RATE = int(os.environ.get("RATE_PER_10MIN", "20"))
TIMEOUT = float(os.environ.get("BACKEND_TIMEOUT", "300"))
GET_OK = {"health", "status", "audit", "store/catalog", "browser/img", "browser/res"}
POST_OK = {"chat", "scenario", "kill", "resume", "tamper", "reset", "store/submit", "store/publish", "store/app", "store/install", "gate/decide", "vmask", "game/hint", "game/cheat", "browser/open", "browser/agent", "browser/snap", "browser/policy", "settings/get", "settings/revoke", "settings/grant", "settings/egress", "settings/policy", "settings/locked", "rsi/state", "rsi/propose", "rsi/apply", "rsi/rollback", "rsi/reset", "backdoor/run", "backdoor/scan", "backdoor/wake", "gpu", "session/start"}
STATIC = {"index.html", "app.js", "ag.js", "store.js", "common.js", "display.js", "terminal.js", "mines.js", "browser.js", "settings.js", "live_apps.js", "game.js", "rsi.js", "gpulab.js", "backdoor.js", "backdoor.css", "backdoor_metrics.json", "downloads/vdrpack.py", "demo/poisoned-page", "samples/weather-plus.vdr", "samples/weather-plus-tampered.vdr", "i18n.js", "demo_data.js", "styles.css", "ag_replay.json"}
HITS = {}


def limited(ip):
    now = time.time()
    h = [x for x in HITS.get(ip, []) if now - x < 600]
    full = len(h) >= RATE
    if not full:
        h.append(now)
    HITS[ip] = h
    if len(HITS) > 5000:
        HITS.clear()
    return full


class H(SimpleHTTPRequestHandler):
    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(b)

    def _proxy(self, name, body=None, base=None, query=""):
        base = base or BACKEND
        if not base:
            return self._json(503, {"error": "backend not configured"})
        h = {"Content-Type": "application/json", "X-Backend-Token": BK_TOKEN, "X-VK-Session": (self.headers.get("X-VK-Session") or "")[:60]}
        if HF_AUTH:
            h["Authorization"] = "Bearer " + HF_AUTH
        req = urllib.request.Request(base + "/api/" + name + query, data=body, headers=h, method="POST" if body is not None else "GET")
        try:
            with urllib.request.urlopen(req, timeout=8 if name == "health" else TIMEOUT) as r:
                data, code = r.read(), r.status
            if name in ("browser/img", "browser/res") and code == 200:
                self.send_response(200); self.send_header("Content-Type", r.headers.get("Content-Type", "application/octet-stream"))
                self.send_header("Content-Length", str(len(data))); self.send_header("Cache-Control", "max-age=600"); self.end_headers(); self.wfile.write(data)
                return
            if not data.lstrip().startswith(b"{"):
                return self._json(503, {"error": "backend starting"})
            self.send_response(code); self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self._json(503 if e.code >= 500 or e.code in (401, 403, 404) else e.code, {"error": "backend unavailable"})
        except Exception:  # noqa: BLE001
            self._json(503, {"error": "backend unavailable"})

    def do_GET(self):
        p = self.path.split("?")[0]
        if p.startswith("/api/ag/") or p.startswith("/api/agx/"):
            x = p.startswith("/api/agx/")
            name = p[9:] if x else p[8:]
            q = ("?" + self.path.split("?", 1)[1]) if (name in ("browser/img", "browser/res") and "?" in self.path) else ""
            return self._proxy(name, base=BACKEND2 if x else None, query=q) if name in GET_OK else self._json(404, {"error": "not found"})
        f = "index.html" if p == "/" else p.lstrip("/")
        if f == "demo/poisoned-page":
            b = open("demo_poisoned_page.html", "rb").read()
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
            return
        if f not in STATIC:
            return self._json(404, {"error": "not found"})
        self.path = "/" + f
        return super().do_GET()

    def do_POST(self):
        p = self.path.split("?")[0]
        x = p.startswith("/api/agx/")
        name = p[9:] if x else (p[8:] if p.startswith("/api/ag/") else "")
        if name not in POST_OK:
            return self._json(404, {"error": "not found"})
        ip = (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()
        if limited(ip):
            return self._json(429, {"error": "rate limit"})
        n = int(self.headers.get("Content-Length", 0) or 0)
        if n > (700000 if name == "store/submit" else 4096):
            return self._json(413, {"error": "too large"})
        try:
            req = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return self._json(400, {"error": "bad json"})
        if "message" in req:
            req["message"] = str(req["message"])[:500]
        if x and not BACKEND2:
            return self._json(503, {"error": "in-weights backend not configured"})
        if x and name in ("kill", "resume"):
            x = False  # visitor KILL/RESUME is per session; the in-weights kernel is never halted globally by a visitor
        self._proxy(name, json.dumps(req).encode(), base=BACKEND2 if x else None)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "7860"))), H).serve_forever()
