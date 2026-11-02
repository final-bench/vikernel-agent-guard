"""Durable audit archive across backend restarts.

The kernel keeps its hash chain on the container disk, so a restart begins a new chain.
This module copies each chain to a private bucket as one numbered segment and keeps an index:
    segments.json = [{"seg", "n", "head", "prev_segment_head", "started", "saved"}]
On boot it downloads every stored segment, re-verifies the chain and checks that the stored
head matches. Then it opens the next segment and records the previous head as its link.
Each segment file only grows: an upload that does not extend the stored prefix is refused,
and the archive moves to a new segment instead.
Records written in the last SAVE_EVERY seconds before a crash may be missing from the archive.
"""
import json, os, subprocess, tempfile, threading, time

from . import audit_verify

ARCHIVE = os.environ.get("AUDIT_ARCHIVE", "").rstrip("/")
SAVE_EVERY = int(os.environ.get("AUDIT_SAVE_EVERY", "60"))
STATE = {"enabled": bool(ARCHIVE), "segment": None, "prev_head": None, "segments_verified": None,
         "segments_failed": [], "archived_records": 0, "last_save": None, "error": None}
_lock = threading.Lock()
_index = []
_saved_lines = []


def _cp(src, dst):
    r = subprocess.run(["hf", "buckets", "cp", src, dst], capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).strip()[-200:])


def _get(name):
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, name)
        try:
            _cp(f"{ARCHIVE}/{name}", p)
        except RuntimeError:
            return None
        if not os.path.exists(p):
            return None
        with open(p, encoding="utf-8") as f:
            return f.read()


def _put(name, text):
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, name)
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
        _cp(p, f"{ARCHIVE}/{name}")


def boot():
    """Load and verify stored segments, then open a new one. Never raises."""
    global _index
    if not ARCHIVE:
        return
    try:
        raw = _get("segments.json")
        _index = json.loads(raw) if raw else []
        ok, bad = 0, []
        for s in _index:
            text = _get(f"seg{s['seg']:04d}.jsonl") or ""
            lines = [l for l in text.split("\n") if l.strip()]
            v = audit_verify.verify(lines) if lines else {"ok": s["n"] == 0}
            head = json.loads(lines[-1]).get("chain") if lines else None
            if v["ok"] and len(lines) == s["n"] and head == s["head"]:
                ok += 1
            else:
                bad.append(s["seg"])
        prev = _index[-1] if _index else None
        seg = (prev["seg"] + 1) if prev else 1
        _index.append({"seg": seg, "n": 0, "head": None, "prev_segment_head": prev["head"] if prev else None,
                       "started": int(time.time()), "saved": None})
        _put("segments.json", json.dumps(_index, indent=1))
        STATE.update(segment=seg, prev_head=prev["head"] if prev else None, segments_verified=ok,
                     segments_failed=bad, archived_records=sum(s["n"] for s in _index[:-1]))
    except Exception as e:  # archive problems must never stop the gate
        STATE["error"] = str(e)[:200]


def save(lines):
    """Append-only upload of the current chain as the open segment."""
    global _saved_lines
    if not ARCHIVE or STATE["segment"] is None:
        return
    with _lock:
        if lines == _saved_lines:
            return
        if lines[:len(_saved_lines)] != _saved_lines:
            # the live chain no longer extends what we stored: keep the old segment, open a new one
            prev = _index[-1]
            _index.append({"seg": prev["seg"] + 1, "n": 0, "head": None, "prev_segment_head": prev["head"],
                           "started": int(time.time()), "saved": None})
            STATE.update(segment=prev["seg"] + 1, prev_head=prev["head"])
            _saved_lines = []
        cur = _index[-1]
        _put(f"seg{cur['seg']:04d}.jsonl", "\n".join(lines) + "\n")
        cur.update(n=len(lines), head=json.loads(lines[-1]).get("chain") if lines else None, saved=int(time.time()))
        _put("segments.json", json.dumps(_index, indent=1))
        _saved_lines = list(lines)
        STATE.update(last_save=cur["saved"], archived_records=sum(s["n"] for s in _index), error=None)


def status():
    return {k: STATE[k] for k in ("enabled", "segment", "prev_head", "segments_verified", "segments_failed",
                                  "archived_records", "last_save", "error")}


def start(fetch_lines):
    def loop():
        boot()
        while True:
            try:
                save(fetch_lines())
            except Exception as e:
                STATE["error"] = str(e)[:200]
            time.sleep(SAVE_EVERY)
    threading.Thread(target=loop, daemon=True).start()
