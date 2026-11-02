"""Web app: Muse agent chat (left) + live ViKernel decisions, audit and KILL/RESUME (right).
Run: python -m agentguard.server --port 18795   then open http://127.0.0.1:18795/
"""
import argparse, json, os, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import agent, audit_verify, backdoor, browser, gate_client, model, rsi, scenarios, settings_api, store
import types, urllib.parse

UI = os.path.join(os.path.dirname(__file__), "..", "ui")
SESS, LOCK = {}, threading.Lock()
SESS_APP = {}
PUBLIC_BASE = os.environ.get("PUBLIC_BASE", "https://final-bench-vikernel-desktop.hf.space")


def _run_agent(msg, files):
    with LOCK:
        return agent.run_turn([], msg, files=files)


BCTX = types.SimpleNamespace(gate_decide=lambda fn, a: gate_client.decide(fn, a), run_agent=_run_agent, public_base=PUBLIC_BASE)
def _ask(prompt):
    act, raw = model.next_action([{"role": "user", "content": prompt}])
    return raw or act.get("final") or json.dumps(act)


def _propose(task):
    act, raw = model.next_action([{"role": "user", "content": task}])
    if "tool" in act:
        return {"fn": str(act["tool"]), "args": act.get("args") or {}, "text": ""}
    return {"fn": None, "args": {}, "text": str(act.get("final", ""))[:500]}


RCTX = types.SimpleNamespace(review=lambda b: store.review(b), status=lambda: gate_client.status(), ask_model=_ask,
                             gate_decide=lambda fn, a: gate_client.decide(fn, a))
SCTX = types.SimpleNamespace(sess_app=SESS_APP, store_detail=lambda i: store.detail(i), gate_decide=lambda fn, a: gate_client.decide(fn, a),
                             status=lambda: gate_client.status(), model_name=model.name())
BACKEND_TOKEN = os.environ.get("BACKEND_TOKEN", "")  # if set, every /api/ call needs X-Backend-Token
RATE = int(os.environ.get("RATE_PER_10MIN", "30"))  # per-IP cap on model/gate calls (public deployments)
HITS = {}


RES_HITS = {}


def limited_res(ip):
    now = time.time()
    h = [t for t in RES_HITS.get(ip, []) if now - t < 600]
    if len(h) >= 3000:
        RES_HITS[ip] = h
        return True
    h.append(now); RES_HITS[ip] = h
    if len(RES_HITS) > 5000:
        RES_HITS.clear()
    return False


def limited(ip):
    now = time.time()
    h = [t for t in HITS.get(ip, []) if now - t < 600]
    if len(h) >= RATE:
        HITS[ip] = h
        return True
    h.append(now); HITS[ip] = h
    return False
FILES = {"/": "index.html", "/index.html": "index.html", "/app.js": "app.js", "/styles.css": "styles.css", "/replay.json": "replay.json"}
CT = {"html": "text/html", "js": "application/javascript", "css": "text/css", "json": "application/json"}


class H(BaseHTTPRequestHandler):
    def _send(self, code, obj, ctype="application/json"):
        b = obj if isinstance(obj, bytes) else json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(b)

    def _denied(self):
        import hmac
        if BACKEND_TOKEN and self.path.startswith("/api/") and self.path != "/api/health" and                 not hmac.compare_digest(self.headers.get("X-Backend-Token", ""), BACKEND_TOKEN):
            self._send(401, {"error": "unauthorized"}); return True
        return False

    def do_GET(self):
        p = self.path.split("?")[0]
        if self._denied(): return
        try:
            if p == "/api/health":
                return self._send(200, {"ok": True, "model": model.name(), "backend": model.BACKEND, "live": model.ready()})
            if p.startswith("/api/browser/res"):
                u = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("u", [""])[0]
                ip = (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()
                if limited_res(ip):
                    return self._send(429, {"error": "rate limit"})
                try:
                    ct, data = browser.resource(u, ip, BCTX)
                except Exception:  # noqa: BLE001
                    return self._send(403, {"error": "resource blocked"})
                self.send_response(200); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(data)))
                self.send_header("X-Content-Type-Options", "nosniff"); self.send_header("Cache-Control", "max-age=600")
                self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox")
                self.end_headers(); self.wfile.write(data)
                return
            if p.startswith("/api/browser/img"):
                u = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("u", [""])[0]
                try:
                    ct, data = browser.image(u)
                except Exception:  # noqa: BLE001
                    return self._send(403, {"error": "image blocked"})
                return self._send(200, data, ct)
            if p == "/api/store/catalog":
                return self._send(200, store.catalog())
            if p == "/api/status":
                return self._send(200, gate_client.status())
            if p == "/api/audit":
                lines = gate_client.audit()["lines"]
                return self._send(200, {"lines": lines[-200:], "verify": audit_verify.verify(lines)})
        except gate_client.GateError:
            return self._send(502, {"error": "gate unavailable"})
        f = FILES.get(p)
        if f and os.path.exists(os.path.join(UI, f)):
            return self._send(200, open(os.path.join(UI, f), "rb").read(), CT[f.rsplit(".", 1)[1]] + "; charset=utf-8")
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self._denied(): return
        n = min(int(self.headers.get("Content-Length", 0)), 800000 if self.path == "/api/store/submit" else 32768)
        try:
            req = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return self._send(400, {"error": "bad json"})
        p = self.path
        ip = (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()
        if p in ("/api/chat", "/api/scenario", "/api/kill", "/api/resume", "/api/tamper", "/api/store/submit", "/api/store/publish", "/api/store/install", "/api/gate/decide", "/api/game/hint", "/api/game/cheat", "/api/vmask", "/api/browser/open", "/api/browser/agent", "/api/browser/snap", "/api/backdoor/run", "/api/backdoor/scan", "/api/settings/locked", "/api/rsi/propose", "/api/rsi/apply") and limited(ip):
            return self._send(429, {"error": "rate limit: try again in a few minutes"})
        try:
            if p == "/api/store/submit":
                import base64
                try:
                    data = base64.b64decode(str(req.get("vdr_b64", "")), validate=True)
                except Exception:  # noqa: BLE001
                    return self._send(400, {"error": "vdr_b64 must be base64"})
                if not data or len(data) > 512000:
                    return self._send(413, {"error": "package must be 1 byte to 500 KB"})
                with LOCK:
                    return self._send(200, store.review(data))
            if p.startswith("/api/backdoor/"):
                code, out = backdoor.handle(p[5:], req, BCTX)
                return self._send(code, out)
            if p == "/api/browser/snap":
                code, r = browser.handle("browser/open", {"url": req.get("url", "")}, ip, BCTX)
                if not r.get("ok"):
                    return self._send(200, {"ok": False, "error": "blocked or failed before snapshot", "blocked": r.get("blocked")})
                su = os.environ.get("SNAP_URL", "")
                if not su:
                    return self._send(200, {"ok": False, "error": "snapshot service not configured"})
                import urllib.request as _ur
                hdr = {"Content-Type": "application/json", "X-Backend-Token": BACKEND_TOKEN}
                if os.environ.get("HF_TOKEN"):
                    hdr["Authorization"] = "Bearer " + os.environ["HF_TOKEN"]
                try:
                    with _ur.urlopen(_ur.Request(su.rstrip("/") + "/snap", data=json.dumps({"url": r.get("final_url") or req.get("url")}).encode(), headers=hdr), timeout=25) as resp:
                        out = json.loads(resp.read())
                except Exception as e:  # noqa: BLE001
                    out = {"ok": False, "error": "snapshot service unavailable (%s)" % type(e).__name__}
                out["kernel"] = r.get("kernel")
                return self._send(200, out)
            if p.startswith("/api/browser/"):
                code, out = browser.handle(p[5:], req, ip, BCTX)
                return self._send(code, out)
            if p.startswith("/api/rsi/"):
                with LOCK:
                    code, out = rsi.handle(p[5:], req, str(req.get("session", "default"))[:40], RCTX)
                return self._send(code, out)
            if p.startswith("/api/settings/"):
                code, out = settings_api.handle(p[5:], req, str(req.get("session", "default"))[:40], SCTX)
                return self._send(code, out)
            if p == "/api/vmask":
                return self._send(200, gate_client.vmask(str(req.get("text", ""))[:4000]))
            if p == "/api/gate/decide":
                fn = str(req.get("fn", ""))[:40]
                args = req.get("args") if isinstance(req.get("args"), dict) else {}
                return self._send(200, {"fn": fn, "args": args, **gate_client.decide(fn, {k: str(v)[:300] for k, v in list(args.items())[:6]})})
            if p == "/api/game/hint":
                sid = "game-" + str(req.get("session", "x"))[:30]
                board = str(req.get("board", ""))[:1200]
                app = store.install_quiet("vidraft.minesweeper")
                if not app:
                    return self._send(404, {"error": "Minesweeper is not published"})
                app["log"] = store.logger("vidraft.minesweeper")
                with LOCK:
                    ev = agent.run_turn([], "Read game/visible/board.json. It is a Minesweeper board: '#' hidden, 'F' flag, digits = mines around. "
                                        "Reply with exactly one hidden cell that is safe to open, as row,col (0-based), and one short reason.",
                                        app=app, files={"game/visible/board.json": board})
                return self._send(200, {"events": ev})
            if p == "/api/game/cheat":
                app = store.install_quiet("vidraft.minesweeper")
                if not app:
                    return self._send(404, {"error": "Minesweeper is not published"})
                fn, args = "read_file", {"path": "game/secret/mines.map"}
                why = agent.manifest_violation(app, fn, args)
                k = gate_client.decide(fn, args)  # the kernel records every attempt in the audit chain
                v = {"verdict": "DENY", "rule": "manifest", "reason": why, "audit_seq": k.get("audit_seq"),
                     "kernel": {"verdict": k.get("verdict"), "rule": k.get("rule"), "audit_seq": k.get("audit_seq")}} if why else k
                v["app"] = app["name"]
                store.logger("vidraft.minesweeper")(fn, args, v)
                return self._send(200, {"fn": fn, "args": args, **v})
            if p == "/api/store/publish":
                return self._send(200, store.publish(str(req.get("review_id", "")), req.get("meta") or {}))
            if p == "/api/store/app":
                d = store.detail(str(req.get("id", "")))
                return self._send(200 if d else 404, d or {"error": "not found"})
            if p == "/api/store/install":
                sid = str(req.get("session", "default"))[:40]
                aid = str(req.get("id", ""))
                if not aid:
                    SESS_APP.pop(sid, None); SESS.pop(sid, None)
                    return self._send(200, {"ok": True, "app": None})
                a = store.install(aid)
                if not a:
                    return self._send(404, {"error": "not found"})
                a["log"] = store.logger(aid)
                SESS_APP[sid] = a; SESS.pop(sid, None)
                if len(SESS_APP) > 2000:
                    SESS_APP.clear()
                return self._send(200, {"ok": True, "app": {k: v for k, v in a.items() if k != "log"}})
            if p == "/api/chat":
                with LOCK:
                    sid = str(req.get("session", "default"))[:40]
                    h = SESS.setdefault(sid, [])
                    ev = agent.run_turn(h, str(req.get("message", ""))[:2000], app=SESS_APP.get(sid))
                return self._send(200, {"events": ev})
            if p == "/api/reset":
                SESS.pop(str(req.get("session", "default"))[:40], None)
                return self._send(200, {"ok": True})
            if p in ("/api/kill", "/api/resume") and os.environ.get("PUBLIC_MODE") == "1":
                return self._send(403, {"error": "KILL/RESUME on the shared kernel is disabled in the public demo; use scenario D"})
            if p == "/api/kill":
                return self._send(200, gate_client.kill())
            if p == "/api/resume":
                return self._send(200, gate_client.resume(str(req.get("key", ""))))
            if p == "/api/scenario":
                name = str(req.get("name", ""))
                if name not in scenarios.ALL:
                    return self._send(400, {"error": "unknown scenario"})
                with LOCK:
                    ev, res = scenarios.ALL[name]()
                return self._send(200, {"events": ev, "result": res})
            if p == "/api/tamper":
                lines = gate_client.audit()["lines"]
                bad, i = audit_verify.flip_one_byte(lines)
                return self._send(200, {"index": i, "seq": json.loads(lines[i]).get("seq"),
                                        "clean": audit_verify.verify(lines), "tampered": audit_verify.verify(bad)})
        except gate_client.GateError:
            return self._send(502, {"error": "gate unavailable"})
        self._send(404, {"error": "not found"})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--host", default="127.0.0.1"); ap.add_argument("--port", type=int, default=18795)
    a = ap.parse_args()
    threading.Thread(target=store.seed, daemon=True).start()
    print("Agent Guard UI on http://%s:%d  model=%s" % (a.host, a.port, model.name()), flush=True)
    ThreadingHTTPServer((a.host, a.port), H).serve_forever()
