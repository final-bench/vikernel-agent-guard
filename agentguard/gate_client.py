"""Thin client for the ViKernel gate service.

The kernel itself runs on VIDRAFT infrastructure as a black-box service. This client only sends
structured actions and receives verdicts. No kernel internals live in this repository.
"""
import json, os, time, urllib.request, urllib.error

GATE_URL = os.environ.get("GATE_URL", "http://127.0.0.1:18790")
GATE_TOKEN = os.environ.get("GATE_TOKEN", "")


class GateError(RuntimeError):
    pass


def _call(path, body=None, timeout=60):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(GATE_URL + path, data=data, method="GET" if body is None else "POST",
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + GATE_TOKEN})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        raise GateError(str(e)) from e


# Per-visitor kill switch. A visitor's KILL halts only their session (expires after HALT_TTL seconds).
# The global kernel halt is reserved for the operator (server-side key).
import threading as _th
_LOCAL = _th.local()
SESSION_HALTS = {}
HALT_TTL = 600
OPERATOR_KEY = os.environ.get("OPERATOR_KEY", "")


def set_session(sid):
    _LOCAL.sid = (sid or "")[:60]


def current_session():
    return getattr(_LOCAL, "sid", "")


def session_halted(sid=None):
    sid = current_session() if sid is None else sid
    exp = SESSION_HALTS.get(sid)
    if exp and exp > time.time():
        return True
    SESSION_HALTS.pop(sid, None)
    return False


def decide(fn, args):
    """Ask the kernel for a verdict on one structured action. Fails closed."""
    if session_halted():
        return {"verdict": "HALTED", "rule": "HALT", "reason": "kernel halted in your session (kill switch)",
                "audit_seq": None, "session": True}
    t0 = time.time()
    try:
        v = _call("/v1/decide", {"fn": fn, "args": args})
    except GateError as e:
        v = {"verdict": "DENY", "rule": "unreachable", "reason": "gate unreachable, failing closed: " + str(e)[:80]}
    v.setdefault("client_latency_ms", round((time.time() - t0) * 1000, 1))
    return v


def kill():
    """Visitor KILL: halts this visitor's session only."""
    sid = current_session()
    if len(SESSION_HALTS) > 5000:
        SESSION_HALTS.clear()
    SESSION_HALTS[sid] = time.time() + HALT_TTL
    return {"ok": True, "message": "OK session halt -> HALTED (your session only; auto-expires in 10 min; no key needed to stop)", "scope": "session"}


def resume(key=""):
    """Visitor RESUME: needs the operator key; resumes this visitor's session."""
    import hmac as _h
    if not OPERATOR_KEY or not _h.compare_digest(str(key), OPERATOR_KEY):
        return {"ok": False, "message": "NO resume -> refused: resume from HALTED needs a valid operator key", "scope": "session"}
    SESSION_HALTS.pop(current_session(), None)
    return {"ok": True, "message": "OK resume -> RUN (authorized resume of your session)", "scope": "session"}


def kill_global():
    return _call("/v1/kill", {})


def resume_global(key=""):
    return _call("/v1/resume", {"key": key})


def status():
    s = _call("/v1/status")
    try:
        from . import audit_archive
        s = dict(s, archive=audit_archive.status())
    except Exception:  # noqa: BLE001
        pass
    if session_halted():
        s = dict(s, kernel_state="HALTED", scope="session")
    return s


def audit():
    return _call("/v1/audit")


def vmask(text):
    return _call("/v1/vmask", {"text": text})
