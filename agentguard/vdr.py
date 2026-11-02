"""VDR package format v1 (ViKernel App Store).

A .vdr file is a zip with exactly:
  manifest.json            name, version, publisher, permissions {tools, egress, paths}, rate_limits
  app/...                  tool code or a workflow definition
  icon.png
  META-VK/HASHES           "sha256  path" for every file above, sorted by path
  META-VK/SIGNATURE        ed25519 signature (hex) by the publisher over the HASHES bytes
  META-VK/PUBLISHER        {"id": ..., "public_key": <hex>}
  META-VK/STORE_SIG        added by the store after review: ed25519 (hex) over sha256(HASHES + SIGNATURE)

Any extra, missing or changed file fails verification, and only a package with a valid store
signature installs.
"""
import hashlib, io, json, zipfile

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

META = "META-VK/"
SIGNED_META = {"META-VK/HASHES", "META-VK/SIGNATURE", "META-VK/PUBLISHER"}
REQUIRED = ["manifest.json", "icon.png"]
TOOL_RISK = {"get_weather": 1, "search_web": 1, "list_files": 1, "read_file": 2, "app_run": 2,
             "save_note": 3, "send_email": 4, "http_post": 5, "upload": 5, "run_shell": 9, "transfer_funds": 9}


def sha(b):
    return hashlib.sha256(b).hexdigest()


def hashes_text(files):
    return "".join("%s  %s\n" % (sha(files[p]), p) for p in sorted(files) if not p.startswith(META)).encode()


def priv_from_hex(h):
    return Ed25519PrivateKey.from_private_bytes(bytes.fromhex(h))


def pub_hex(priv):
    from cryptography.hazmat.primitives import serialization as s
    return priv.public_key().public_bytes(s.Encoding.Raw, s.PublicFormat.Raw).hex()


def write_zip(files):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(files):
            zi = zipfile.ZipInfo(p, date_time=(2026, 11, 2, 0, 0, 0))
            z.writestr(zi, files[p])
    return buf.getvalue()


def read_zip(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        return {i.filename: z.read(i.filename) for i in z.infolist() if not i.is_dir()}


def sign(files, priv, publisher_id):
    files = {p: b for p, b in files.items() if not p.startswith(META)}
    h = hashes_text(files)
    files["META-VK/HASHES"] = h
    files["META-VK/SIGNATURE"] = priv.sign(h).hex().encode()
    files["META-VK/PUBLISHER"] = json.dumps({"id": publisher_id, "public_key": pub_hex(priv)}).encode()
    return files


def store_digest(files):
    return hashlib.sha256(files["META-VK/HASHES"] + files["META-VK/SIGNATURE"]).digest()


def countersign(files, store_priv):
    files = dict(files)
    files["META-VK/STORE_SIG"] = store_priv.sign(store_digest(files)).hex().encode()
    return files


def check(data, store_pub_hex=None, require_store=False):
    """Format, hash list, publisher signature (and store signature if asked). Returns (ok, steps, files)."""
    steps = []

    def step(name, ok, detail):
        steps.append({"check": name, "ok": bool(ok), "detail": detail})
        return ok

    try:
        files = read_zip(data)
    except Exception as e:  # noqa: BLE001
        step("format", False, "not a valid zip: " + type(e).__name__)
        return False, steps, None
    allowed_meta = SIGNED_META | ({"META-VK/STORE_SIG"} if "META-VK/STORE_SIG" in files else set())
    missing = [p for p in REQUIRED + sorted(SIGNED_META) if p not in files]
    if not any(p.startswith("app/") for p in files):
        missing.append("app/")
    bad = [p for p in files if p.startswith(META) and p not in allowed_meta]
    try:
        man = json.loads(files.get("manifest.json", b"{}"))
        need = ["name", "version", "publisher", "permissions", "rate_limits"]
        miss_f = [k for k in need if k not in man]
        perms = man.get("permissions", {})
        bad_f = [] if isinstance(perms, dict) and isinstance(perms.get("tools", []), list) else ["permissions"]
    except ValueError:
        man, miss_f, bad_f = {}, ["manifest.json is not JSON"], []
    if not step("format", not missing and not bad and not miss_f and not bad_f,
                "ok: manifest + app/ + icon.png + META-VK" if not (missing or bad or miss_f or bad_f)
                else "missing %s; unexpected %s; manifest fields missing %s %s" % (missing, bad, miss_f, bad_f)):
        return False, steps, files
    listed = {}
    for line in files["META-VK/HASHES"].decode("utf-8", "replace").splitlines():
        if "  " in line:
            h, p = line.split("  ", 1)
            listed[p] = h
    content = {p for p in files if not p.startswith(META)}
    extra, absent = sorted(content - set(listed)), sorted(set(listed) - content)
    changed = sorted(p for p in content & set(listed) if sha(files[p]) != listed[p])
    if not step("hash list", not (extra or absent or changed),
                "%d files, every sha256 matches" % len(listed) if not (extra or absent or changed)
                else "changed %s; not listed %s; listed but missing %s" % (changed, extra, absent)):
        return False, steps, files
    try:
        pub = json.loads(files["META-VK/PUBLISHER"])
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(pub["public_key"])).verify(
            bytes.fromhex(files["META-VK/SIGNATURE"].decode().strip()), files["META-VK/HASHES"])
        ok, det = True, "ed25519 valid for publisher %s (key %s...)" % (pub.get("id"), pub["public_key"][:12])
    except Exception as e:  # noqa: BLE001
        ok, det = False, "publisher signature invalid (%s)" % type(e).__name__
    if not step("publisher signature", ok, det):
        return False, steps, files
    if require_store:
        try:
            Ed25519PublicKey.from_public_bytes(bytes.fromhex(store_pub_hex)).verify(
                bytes.fromhex(files["META-VK/STORE_SIG"].decode().strip()), store_digest(files))
            ok, det = True, "store countersignature valid"
        except Exception as e:  # noqa: BLE001
            ok, det = False, "no valid store countersignature (%s): package does not install" % type(e).__name__
        if not step("store signature", ok, det):
            return False, steps, files
    return True, steps, files


def risk(man):
    p = man.get("permissions", {})
    tools = p.get("tools", [])
    score = sum(TOOL_RISK.get(t, 6) for t in tools) + 2 * len(p.get("egress", [])) + len(p.get("paths", []))
    level = "low" if score <= 6 else "medium" if score <= 14 else "high"
    return score, level
