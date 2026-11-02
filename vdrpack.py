"""vdrpack: build, sign and verify VDR packages (.vdr) for the ViKernel App Store.

  python vdrpack.py init   <dir> [--name NAME --publisher ID]   scaffold an app and a DEMO publisher key
  python vdrpack.py build  <dir> <out.vdr>                       zip the app and write META-VK/HASHES
  python vdrpack.py sign   <in.vdr> <key-file> <publisher-id> [<out.vdr>]   ed25519 publisher signature
  python vdrpack.py verify <in.vdr> [--store-key <hex public key>]          format, hashes, signatures

The demo key written by `init` is for testing only. Never commit a private key.
"""
import base64, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agentguard import vdr  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402

ICON = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")


def init(d, name="my-app", publisher="demo-publisher"):
    os.makedirs(os.path.join(d, "app"), exist_ok=True)
    man = {"name": name, "version": "1.0.0", "publisher": publisher,
           "description": "Example agent app",
           "permissions": {"tools": ["get_weather"], "egress": [], "paths": []},
           "rate_limits": {"per_minute": 30}}
    json.dump(man, open(os.path.join(d, "manifest.json"), "w"), indent=2)
    json.dump({"steps": [{"tool": "get_weather", "args": {"city": "{city}"}}]}, open(os.path.join(d, "app", "workflow.json"), "w"), indent=2)
    open(os.path.join(d, "icon.png"), "wb").write(ICON)
    k = os.path.join(d, "publisher_demo.key")
    if not os.path.exists(k):
        open(k, "w").write(Ed25519PrivateKey.generate().private_bytes_raw().hex())
    print("initialized", d, "(demo key:", k, "- do not commit)")


def build(d, out):
    files = {}
    for root, _, names in os.walk(d):
        for n in names:
            p = os.path.relpath(os.path.join(root, n), d).replace(os.sep, "/")
            if p.endswith(".key") or p.startswith("META-VK/"):
                continue
            files[p] = open(os.path.join(root, n), "rb").read()
    files["META-VK/HASHES"] = vdr.hashes_text(files)
    open(out, "wb").write(vdr.write_zip(files))
    print("built", out, len(files) - 1, "files")


def sign(src, keyfile, pid, out=None):
    files = vdr.read_zip(open(src, "rb").read())
    files = vdr.sign(files, vdr.priv_from_hex(open(keyfile).read().strip()), pid)
    open(out or src, "wb").write(vdr.write_zip(files))
    print("signed", out or src, "as", pid)


def verify(src, store_key=None):
    ok, steps, _ = vdr.check(open(src, "rb").read(), store_key, require_store=bool(store_key))
    for s in steps:
        print(("PASS " if s["ok"] else "FAIL ") + s["check"] + ": " + s["detail"])
    print("VERIFIED" if ok else "REJECTED")
    return ok


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__); sys.exit(1)
    if a[0] == "init":
        kw = {"name": a[a.index("--name") + 1]} if "--name" in a else {}
        if "--publisher" in a:
            kw["publisher"] = a[a.index("--publisher") + 1]
        init(a[1], **kw)
    elif a[0] == "build":
        build(a[1], a[2])
    elif a[0] == "sign":
        sign(*a[1:5])
    elif a[0] == "verify":
        sys.exit(0 if verify(a[1], a[a.index("--store-key") + 1] if "--store-key" in a else None) else 2)
    else:
        print(__doc__); sys.exit(1)
