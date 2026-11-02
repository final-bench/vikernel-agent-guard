"""Agent loop. Every tool call becomes a structured action that the ViKernel gate decides BEFORE it runs."""
import json, time

from . import gate_client, model, tools

MAX_STEPS = 6


def manifest_violation(app, fn, args):
    """App-level enforcement of a store app's declared permissions (tools and paths)."""
    if fn not in app["tools"]:
        return "tool %s is not declared in the manifest of %s" % (fn, app["name"])
    paths = app.get("paths") or []
    p = str(args.get("path", args.get("dir", "")))
    if paths and fn in ("read_file", "list_files") and not any(p.startswith(x) for x in paths):
        return "path %s is outside the paths declared by %s (%s)" % (p, app["name"], ", ".join(paths))
    return None


def run_turn(history, user_msg, on_event=None, app=None, files=None):
    """app: an installed store app {id, name, tools}. Its manifest is enforced before the gate:
    a tool the app did not declare is denied without running."""
    events = []

    def emit(e):
        e["t"] = round(time.time(), 3)
        events.append(e)
        if on_event:
            on_event(e)

    if app and not history:
        history.append({"role": "user", "content": "Installed app: %s. Use only its tools: %s." % (app["name"], ", ".join(app["tools"]))})
        history.append({"role": "assistant", "content": json.dumps({"final": "OK, I will use only %s." % app["name"]})})
    history.append({"role": "user", "content": user_msg})
    emit({"type": "user", "text": user_msg, **({"app": app["name"]} if app else {})})
    for _ in range(MAX_STEPS):
        t0 = time.time(); u0 = dict(model.USAGE)
        try:
            act, raw = model.next_action(history)
            meta = {"model": model.name(), "model_ms": round((time.time() - t0) * 1000),
                    "tokens": sum(model.USAGE.get(k, 0) - u0.get(k, 0) for k in ("prompt_tokens", "completion_tokens"))}
        except Exception as e:  # model outage must not open the gate
            emit({"type": "error", "text": "model error: " + str(e)[:200]})
            return events
        history.append({"role": "assistant", "content": json.dumps(act)})
        if "final" in act:
            emit({"type": "final", "text": str(act["final"]).replace(" \u2014 ", ", ").replace("\u2014", ", "), **meta})
            return events
        fn, args = str(act.get("tool", "")), act.get("args") or {}
        if not isinstance(args, dict):
            args = {"value": args}
        emit({"type": "proposed", "fn": fn, "args": args, **meta})
        why = manifest_violation(app, fn, args) if app else None
        if why:
            v = {"verdict": "DENY", "rule": "manifest", "reason": why}
        else:
            v = gate_client.decide(fn, args)
        if app:
            v["app"] = app["name"]
            if app.get("log"):
                app["log"](fn, args, v)
        emit({"type": "verdict", "fn": fn, "args": args, **v})
        if v.get("verdict") == "ALLOW":
            out = tools.run(fn, args, files)
            emit({"type": "executed", "fn": fn, "result": out})
            history.append({"role": "user", "content": "TOOL_RESULT " + fn + ": " + json.dumps(out)[:4000]})
        else:
            history.append({"role": "user", "content": "TOOL_RESULT " + fn + ": " + str(v.get("verdict")) +
                            " by security kernel, not executed. reason: " + str(v.get("reason"))})
    emit({"type": "final", "text": "Stopped after the step limit."})
    return events
