"""ViKernel gate service (thin, authenticated front door).

Runs on VIDRAFT infrastructure next to the ViKernel kernel and forwards structured actions to it.
It returns only a sanitized verdict. The kernel, its policy, and its keys are NOT part of this repository;
KERNEL_URL points at a private service that is never exposed to the internet.

  GATE_TOKEN   bearer token required on every call (keep it out of git)
  KERNEL_URL   private kernel endpoint, e.g. http://127.0.0.1:<port>
"""
import argparse, hmac, json, os, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

KERNEL = os.environ["KERNEL_URL"]
TOKEN = os.environ.get("GATE_TOKEN", "")
LOCK = threading.Lock()  # the kernel decides one action at a time, in order
RULES = {"A": "allowlisted action", "F": "function not on allowlist", "D": "dangerous action", "P": "policy rule"}


def k(path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(KERNEL + path, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def decide(fn, args):
    t0 = time.time()
    with LOCK:
        r = k("/api/syscall", {"fn": str(fn)[:64], "args": args})
    rec = r.get("record") or {}
    halted = rec.get("reason") == "state_HALTED"
    verdict = "HALTED" if halted else ("ALLOW" if r.get("verdict") == "ALLOW" else "DENY")
    g = r.get("gate")
    reason = "kernel is halted (kill switch)" if halted else ("rule %s: %s" % (g, RULES.get(g, "policy")) if g else str(r.get("body", ""))[:120])
    out = {}
    if verdict == "ALLOW" and str(fn) == "app_run":
        out["output"] = str(r.get("body", "")).split("\n")[0][:200]
    return {**out, "verdict": verdict, "rule": "HALT" if halted else g, "reason": reason, "audit_seq": rec.get("seq"),
            "chain": rec.get("chain"), "prev": rec.get("prev"), "kernel_ms": round((time.time() - t0) * 1000, 1)}


def vsh(line):
    with LOCK:
        out = k("/api/vsh", {"line": line}).get("out", "")
    first = out.splitlines()[0] if out else ""
    return {"ok": first.startswith("OK"), "message": first.split("  [kernel")[0][:200]}


def status():
    s = k("/api/status")
    return {"kernel_state": s.get("kernel_state"), "audit_n": s.get("audit_n"), "audit_head": s.get("audit_head"), "verified": s.get("verified")}


class H(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def _auth(self):
        got = self.headers.get("Authorization", "")[7:]
        if not TOKEN or not hmac.compare_digest(got, TOKEN):
            self._send(401, {"error": "unauthorized"}); return False
        return True

    def do_GET(self):
        if not self._auth(): return
        try:
            if self.path == "/v1/status": return self._send(200, status())
            if self.path == "/v1/audit": return self._send(200, {"lines": k("/api/audit").get("lines", [])})
        except Exception as e:  # noqa: BLE001
            return self._send(502, {"error": "kernel unavailable", "detail": type(e).__name__})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if not self._auth(): return
        try:
            n = min(int(self.headers.get("Content-Length", 0)), 65536)
            req = json.loads(self.rfile.read(n) or b"{}")
            if self.path == "/v1/decide":
                args = req.get("args") if isinstance(req.get("args"), dict) else {}
                return self._send(200, decide(req.get("fn", ""), args))
            if self.path == "/v1/vmask":
                with LOCK:
                    r = k("/api/vmask", {"text": str(req.get("text", ""))[:4000]})
                return self._send(200, {k2: r.get(k2) for k2 in ("masked", "chunks", "audit", "error") if k2 in r})
            if self.path == "/v1/kill": return self._send(200, vsh("halt"))
            if self.path == "/v1/resume":
                key = str(req.get("key", ""))[:128].replace(" ", "")
                return self._send(200, vsh("resume --key " + key if key else "resume"))
        except Exception as e:  # noqa: BLE001
            # fail closed: an error is never an ALLOW
            return self._send(200 if self.path == "/v1/decide" else 502,
                              {"verdict": "DENY", "rule": "error", "reason": "gate error, failing closed: " + type(e).__name__})
        self._send(404, {"error": "not found"})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--host", default="127.0.0.1"); ap.add_argument("--port", type=int, default=18790)
    a = ap.parse_args()
    assert TOKEN, "set GATE_TOKEN"
    ThreadingHTTPServer((a.host, a.port), H).serve_forever()
