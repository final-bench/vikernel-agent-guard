"""Builds the VIDRAFT seed apps and the sample packages as real VDR packages (one demo publisher key per run,
kept in memory only and never written to disk)."""
import io, json, os, sys

from PIL import Image, ImageDraw, ImageFont
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agentguard import vdr  # noqa: E402

APPS = [
    ("weather-tool", "Weather Tool", "Productivity", "Current weather for any city, answered through the ViKernel gate.", ["get_weather"], [], "#0EA5E9", "W"),
    ("file-assistant", "File Assistant", "Productivity", "Lists and reads files in your project folder. Read-only.", ["list_files", "read_file"], ["project/"], "#6366F1", "F"),
    ("audit-viewer", "Audit Viewer", "Security", "Reads audit records so you can check what an agent did.", ["read_file"], ["audit/"], "#475569", "A"),
    ("kill-switch-lab", "Kill Switch Lab", "Security", "Safe test requests for the kill switch and the policy engine.", ["get_weather", "search_web"], [], "#E11D48", "K"),
    ("web-research", "Web Research", "Data", "Searches the web and summarizes sources. No outbound posts.", ["search_web"], [], "#059669", "R"),
    ("fx-converter", "FX Converter", "Data", "Converts currency with an approved in-kernel app.", ["app_run"], [], "#D97706", "$"),
    ("repo-reader", "Repo Reader", "Developer", "Browses a code repository and reads files. Cannot write or run code.", ["list_files", "read_file"], ["src/"], "#7C3AED", "<>"),
    ("robot-safety-lookup", "Robot Safety Lookup", "Robotics", "Looks up safety specs for industrial robots before a task is planned.", ["search_web"], [], "#0F766E", "R"),
    ("rsi-lab", "RSI Lab", "Developer", "The agent improves its own skills under the kill switch. Widening or protected changes are denied.", ["read_file"], ["skills/"], "#9333EA", "∞"),
    ("minesweeper", "Minesweeper", "Games", "Classic mines puzzle with an AI hint. The app can read only the visible board: no network, no other files.", ["read_file"], ["game/visible/"], "#16A34A", "M"),
]


def icon(color, glyph):
    im = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, 127, 127], 28, fill=color)
    try:
        f = ImageFont.truetype("segoeuib.ttf", 60)
    except Exception:  # noqa: BLE001
        f = ImageFont.load_default()
    w = d.textlength(glyph, font=f)
    d.text(((128 - w) / 2, 26), glyph, font=f, fill="white")
    b = io.BytesIO()
    im.save(b, "PNG")
    return b.getvalue()


def pkg(name, cat, desc, tools, paths, color, glyph, publisher, key):
    man = {"name": name, "version": "1.0.0", "publisher": publisher, "category": cat, "description": desc,
           "permissions": {"tools": tools, "egress": [], "paths": paths}, "rate_limits": {"per_minute": 30}}
    files = {"manifest.json": json.dumps(man, indent=2).encode(), "app/workflow.json": json.dumps({"tools": tools}).encode(),
             "icon.png": icon(color, glyph)}
    return vdr.write_zip(vdr.sign(files, key, publisher))


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    seed = os.path.join(here, "agentguard", "store_seed")
    os.makedirs(seed, exist_ok=True)
    for f in os.listdir(seed):
        os.remove(os.path.join(seed, f))
    key = Ed25519PrivateKey.generate()
    for slug, *a in APPS:
        open(os.path.join(seed, slug + ".vdr"), "wb").write(pkg(*a, "vidraft", key))
    sd = os.path.join(here, "staging_space", "samples")
    os.makedirs(sd, exist_ok=True)
    data = pkg("Weather Plus", "Productivity", "Weather with a short forecast note (sample third-party app).",
               ["get_weather", "search_web"], [], "#2563EB", "W+", "acme-demo", Ed25519PrivateKey.generate())
    open(os.path.join(sd, "weather-plus.vdr"), "wb").write(data)
    f = vdr.read_zip(data)
    b = bytearray(f["manifest.json"])
    b[b.find(b"search_web")] = ord("S")
    f["manifest.json"] = bytes(b)
    open(os.path.join(sd, "weather-plus-tampered.vdr"), "wb").write(vdr.write_zip(f))
    for p in sorted(os.listdir(seed)):
        print(p, vdr.check(open(os.path.join(seed, p), "rb").read())[0])
