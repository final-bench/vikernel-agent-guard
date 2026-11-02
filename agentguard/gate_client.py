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


def decide(fn, args):
    """Ask the kernel for a verdict on one structured action. Fails closed."""
    t0 = time.time()
    try:
        v = _call("/v1/decide", {"fn": fn, "args": args})
    except GateError as e:
        v = {"verdict": "DENY", "rule": "unreachable", "reason": "gate unreachable, failing closed: " + str(e)[:80]}
    v.setdefault("client_latency_ms", round((time.time() - t0) * 1000, 1))
    return v


def kill():
    return _call("/v1/kill", {})


def resume(key=""):
    return _call("/v1/resume", {"key": key})


def status():
    return _call("/v1/status")


def audit():
    return _call("/v1/audit")


def vmask(text):
    return _call("/v1/vmask", {"text": text})
