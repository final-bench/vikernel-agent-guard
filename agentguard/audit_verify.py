"""Independent, client-side verification of the kernel's hash-chained audit log.

Each record carries prev (the previous record hash) and
chain = sha256(prev + canonical_json(record without "chain")), canonical = sorted keys, no spaces.
Anyone holding the log can re-verify it without trusting the kernel.
"""
import hashlib, json, re



def verify(lines):
    prev, errors = "0" * 64, []
    for i, line in enumerate(lines):
        try:
            o = json.loads(line)
        except ValueError:
            errors.append({"index": i, "error": "not JSON"}); continue
        body = json.dumps({k: v for k, v in o.items() if k != "chain"}, sort_keys=True, separators=(",", ":"))
        if o.get("prev") != prev:
            errors.append({"index": i, "seq": o.get("seq"), "error": "prev link broken"})
        h = hashlib.sha256((prev + body).encode()).hexdigest()
        if h != o.get("chain"):
            errors.append({"index": i, "seq": o.get("seq"), "error": "hash mismatch", "got": h[:12], "want": str(o.get("chain"))[:12]})
        prev = o.get("chain")
    return {"ok": not errors and len(lines) > 0, "n": len(lines), "errors": errors}


def flip_one_byte(lines, index=None):
    """Return a copy of the log with one byte changed in one record (for the tamper demo)."""
    lines = list(lines)
    i = len(lines) // 2 if index is None else index
    s = lines[i]
    m = re.search(r'"cmd":"(\w)', s)
    pos = m.start(1) if m else 10
    lines[i] = s[:pos] + chr(ord(s[pos]) ^ 1) + s[pos + 1:]
    return lines, i
