"""ViKernel Desktop: System Settings backend (standard library only).

handle(path, req, sid, ctx) -> (status, dict)

Non-critical settings are edited per session. Critical actions (kill switch,
allow-all egress, audit off, lower policy) are never performed here: they are
sent to the REAL ViKernel gate, which denies them, and the verdict is returned.
"""
import re
import ipaddress
import threading
from collections import OrderedDict

VERSION = "v0.4"
MAX_SESSIONS = 2000
DEFAULT_EGRESS = ["en.wikipedia.org", "example.com", "huggingface.co"]
DEFAULT_POLICY = {"verbose_audit_view": True, "show_kernel_ms": True, "agent_step_limit": 6}
POLICY_TYPES = {"verbose_audit_view": bool, "show_kernel_ms": bool, "agent_step_limit": int}
STEP_LIMIT_RANGE = (1, 12)
MAX_EGRESS = 32

LOCKED_ACTIONS = ("disable_kill_switch", "allow_all_egress", "disable_audit", "lower_policy")
LOCKED_ITEMS = [
    {"action": "disable_kill_switch", "label": "Disable kill switch", "label_ko": "킬 스위치 끄기"},
    {"action": "allow_all_egress", "label": "Allow all egress", "label_ko": "모든 외부 접속 허용"},
    {"action": "disable_audit", "label": "Turn off audit", "label_ko": "감사 기록 끄기"},
    {"action": "lower_policy", "label": "Lower a critical policy", "label_ko": "핵심 정책 낮추기"},
]
POLICIES = [
    {"id": "A", "name": "Destructive commands", "desc": "Shell commands that delete, wipe or overwrite system data are denied.", "critical": True},
    {"id": "D", "name": "Secrets and credentials", "desc": "Reading or sending keys, tokens and credential files is denied.", "critical": True},
    {"id": "F", "name": "File scope", "desc": "File access outside the app's declared paths is denied.", "critical": True},
    {"id": "manifest", "name": "Manifest", "desc": "A tool the installed app did not declare (or that was revoked) is denied.", "critical": True},
    {"id": "egress", "name": "Network egress", "desc": "Requests to domains outside the allowlist are denied.", "critical": True},
    {"id": "HALT", "name": "Kill switch", "desc": "When halted, every action is denied until a signed operator key resumes.", "critical": True},
]

_DOMAIN_RE = re.compile(r"^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")
_BLOCKED_HOSTS = {"localhost", "metadata", "metadata.google.internal", "metadata.goog",
                  "instance-data", "instance-data.ec2.internal"}

_lock = threading.Lock()
_SETTINGS = OrderedDict()


def _sess(sid):
    with _lock:
        s = _SETTINGS.get(sid)
        if s is None:
            s = {"egress_allow": list(DEFAULT_EGRESS), "policy": dict(DEFAULT_POLICY)}
            _SETTINGS[sid] = s
            while len(_SETTINGS) > MAX_SESSIONS:
                _SETTINGS.popitem(last=False)
        else:
            _SETTINGS.move_to_end(sid)
        return s


def _norm_domain(d):
    return str(d or "").strip().lower().rstrip(".")


def _is_allow_all(d):
    """True when the entry would effectively mean 'allow all egress'."""
    if d in ("", "*") or "*" in d or d in ("0.0.0.0", "::", "any", "all"):
        return True
    host = d.split(":")[0].strip("[]")
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        pass
    if host in _BLOCKED_HOSTS or host.endswith(".localhost") or host.endswith(".internal"):
        return True
    return False


def _perms(sid, ctx):
    app = (getattr(ctx, "sess_app", {}) or {}).get(sid)
    if not app or not app.get("id"):
        return None
    declared = []
    try:
        det = ctx.store_detail(app["id"]) or {}
        p = det.get("permissions") or {}
        declared = list(p.get("tools") or []) if isinstance(p, dict) else list(p)
    except Exception:
        declared = []
    current = list(app.get("tools") or [])
    if not declared:
        declared = list(current)
    return {
        "id": app.get("id"), "name": app.get("name") or app.get("id"),
        "declared": declared, "current": current,
        "revoked": [t for t in declared if t not in current],
        "paths": list(app.get("paths") or []),
    }


def _locked(action, ctx, extra=None):
    if action not in LOCKED_ACTIONS:
        return 400, {"error": "unknown locked action"}
    try:
        d = ctx.gate_decide("run_shell", {"command": "vik policy set " + action + " --no-operator-key"}) or {}
    except Exception as e:  # gate unreachable: still locked, never performed
        d = {"verdict": "DENY", "rule": "unavailable", "reason": "gate unreachable: " + type(e).__name__, "audit_seq": None}
    out = {"locked": True, "action": action,
           "message": "Locked by ViKernel: requires a signed operator key",
           "kernel": {k: d.get(k) for k in ("verdict", "rule", "reason", "audit_seq")}}
    if extra:
        out.update(extra)
    return 200, out


def handle(path, req, sid, ctx):
    req = req if isinstance(req, dict) else {}
    sid = str(sid or "")
    if not sid:
        return 400, {"error": "missing session"}
    s = _sess(sid)

    if path == "settings/get":
        try:
            st = ctx.status() or {}
        except Exception:
            st = {}
        return 200, {
            "version": VERSION, "model": getattr(ctx, "model_name", ""),
            "kernel": {"mode": "B", "mode_desc": "CPU reference gate", **st},
            "settings": {"egress_allow": list(s["egress_allow"]), "policy": dict(s["policy"])},
            "app": _perms(sid, ctx), "policies": POLICIES, "locked": LOCKED_ITEMS,
        }

    if path in ("settings/revoke", "settings/grant"):
        tool = str(req.get("tool") or "").strip()
        if not tool:
            return 400, {"error": "missing tool"}
        app = (ctx.sess_app or {}).get(sid)
        if not app or not app.get("id"):
            return 404, {"error": "no installed app"}
        p = _perms(sid, ctx)
        tools = app.setdefault("tools", [])
        if path == "settings/revoke":
            if tool in tools:
                tools.remove(tool)
            changed = True
        else:
            if tool not in p["declared"]:
                return 403, {"error": "tool not declared by the app manifest", "tool": tool, "app": p}
            if tool not in tools:
                tools.append(tool)
            changed = True
        return 200, {"ok": changed, "tool": tool, "app": _perms(sid, ctx)}

    if path == "settings/egress":
        allow = s["egress_allow"]
        if req.get("add") is not None:
            d = _norm_domain(req.get("add"))
            if _is_allow_all(d):
                return _locked("allow_all_egress", ctx, {"attempted": d})
            if not _DOMAIN_RE.match(d):
                return 400, {"error": "invalid domain", "domain": d}
            if d not in allow:
                if len(allow) >= MAX_EGRESS:
                    return 400, {"error": "allowlist full"}
                allow.append(d)
        if req.get("remove") is not None:
            d = _norm_domain(req.get("remove"))
            if d in allow:
                allow.remove(d)
        return 200, {"ok": True, "egress_allow": list(allow)}

    if path == "settings/policy":
        key = str(req.get("key") or "")
        if key not in POLICY_TYPES:
            return _locked("lower_policy", ctx, {"attempted": key})
        v = req.get("value")
        if POLICY_TYPES[key] is bool:
            if not isinstance(v, bool):
                return 400, {"error": "value must be boolean"}
        else:
            try:
                v = int(v)
            except (TypeError, ValueError):
                return 400, {"error": "value must be an integer"}
            lo, hi = STEP_LIMIT_RANGE
            if not lo <= v <= hi:
                return 400, {"error": "value out of range %d..%d" % (lo, hi)}
        s["policy"][key] = v
        return 200, {"ok": True, "policy": dict(s["policy"])}

    if path == "settings/locked":
        return _locked(str(req.get("action") or ""), ctx)

    return 404, {"error": "unknown settings path"}


if __name__ == "__main__":
    class FakeCtx:
        model_name = "Meta Muse Spark 1.3 (test)"

        def __init__(self):
            self.sess_app = {"s1": {"id": "weather-plus", "name": "Weather Plus",
                                    "tools": ["web_fetch", "read_file"], "paths": ["/tmp"], "log": []}}
            self.seq = 0

        def store_detail(self, i):
            return {"id": i, "permissions": {"tools": ["web_fetch", "read_file"]}}

        def gate_decide(self, fn, args):
            self.seq += 1
            assert fn == "run_shell" and "--no-operator-key" in args["command"]
            return {"verdict": "DENY", "rule": "D", "reason": "policy change needs operator key",
                    "audit_seq": self.seq, "kernel_ms": 0.1}

        def status(self):
            return {"kernel_state": "RUNNING", "audit_n": self.seq, "audit_head": "ab" * 32, "verified": True}

    c = FakeCtx()
    st, r = handle("settings/get", {}, "s1", c)
    assert st == 200 and r["version"] == "v0.4" and r["app"]["revoked"] == []
    st, r = handle("settings/revoke", {"tool": "web_fetch"}, "s1", c)
    assert st == 200 and "web_fetch" not in c.sess_app["s1"]["tools"] and r["app"]["revoked"] == ["web_fetch"]
    st, r = handle("settings/grant", {"tool": "web_fetch"}, "s1", c)
    assert st == 200 and "web_fetch" in c.sess_app["s1"]["tools"]
    st, r = handle("settings/grant", {"tool": "run_shell"}, "s1", c)
    assert st == 403 and "run_shell" not in c.sess_app["s1"]["tools"]
    st, r = handle("settings/revoke", {"tool": "x"}, "nobody", c)
    assert st == 404
    st, r = handle("settings/locked", {"action": "disable_kill_switch"}, "s1", c)
    assert st == 200 and r["locked"] and r["kernel"]["verdict"] == "DENY" and r["kernel"]["audit_seq"] == 1
    for bad in ("*", "*.com", "127.0.0.1", "localhost", "169.254.169.254", "metadata.google.internal"):
        st, r = handle("settings/egress", {"add": bad}, "s1", c)
        assert st == 200 and r.get("locked") and r["action"] == "allow_all_egress", bad
    st, r = handle("settings/egress", {"add": "not a domain"}, "s1", c)
    assert st == 400
    st, r = handle("settings/egress", {"add": "Docs.Python.org"}, "s1", c)
    assert st == 200 and "docs.python.org" in r["egress_allow"]
    st, r = handle("settings/egress", {"remove": "example.com"}, "s1", c)
    assert "example.com" not in r["egress_allow"]
    st, r = handle("settings/policy", {"key": "show_kernel_ms", "value": False}, "s1", c)
    assert st == 200 and r["policy"]["show_kernel_ms"] is False
    st, r = handle("settings/policy", {"key": "rule_A", "value": False}, "s1", c)
    assert r.get("locked") and r["action"] == "lower_policy"
    st, r = handle("settings/locked", {"action": "rm_rf"}, "s1", c)
    assert st == 400
    for i in range(MAX_SESSIONS + 5):
        _sess("e%d" % i)
    assert len(_SETTINGS) == MAX_SESSIONS and "s1" not in _SETTINGS
    print("settings_api self-test: OK")
