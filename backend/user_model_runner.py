"""
Runs a user-supplied model file on the "Simulate Your Device" page.

The user's code is executed inside the visitor's own browser (Pyodide, in a
Web Worker). Nothing is sent to a server. This module only:
  1. executes the uploaded code in its own namespace,
  2. reads and normalises its PARAMETERS dictionary,
  3. calls simulate(params) and checks the returned arrays.
The required file format is described in backend/templates/user_model_template.py.
"""

import math
import types

_user = None
_spec = {}


def _num(x, name, field):
    try:
        v = float(x)
    except (TypeError, ValueError):
        raise ValueError(f"PARAMETERS['{name}']['{field}'] must be a number, got {x!r}")
    if not math.isfinite(v):
        raise ValueError(f"PARAMETERS['{name}']['{field}'] must be finite, got {x!r}")
    return v


def load(code):
    """Execute the user's file; return model name, plot floor and parameter specification."""
    global _user, _spec
    mod = types.ModuleType("user_model")
    mod.__file__ = "user_model.py"
    exec(compile(code, "user_model.py", "exec"), mod.__dict__)

    if not callable(getattr(mod, "simulate", None)):
        raise ValueError("The file must define a function simulate(params).")
    raw = getattr(mod, "PARAMETERS", {})
    if not isinstance(raw, dict):
        raise ValueError("PARAMETERS must be a dictionary.")

    spec = {}
    for name, entry in raw.items():
        d = dict(entry) if isinstance(entry, dict) else {"default": entry}
        if "default" not in d:
            raise ValueError(f"PARAMETERS['{name}'] needs a 'default' value.")
        is_int = isinstance(d["default"], int) and not isinstance(d["default"], bool)
        s = {"default": int(d["default"]) if is_int else _num(d["default"], name, "default"),
             "integer": is_int,
             "label": str(d.get("label", name)),
             "units": str(d.get("units", "")),
             "scale": "log" if str(d.get("scale", "linear")).lower() == "log" else "linear"}
        if "min" in d and "max" in d:
            lo, hi = _num(d["min"], name, "min"), _num(d["max"], name, "max")
            if not lo < hi:
                raise ValueError(f"PARAMETERS['{name}']: 'min' must be smaller than 'max'.")
            if s["scale"] == "log" and lo <= 0:
                raise ValueError(f"PARAMETERS['{name}']: a log-scale range needs min > 0.")
            s["min"], s["max"] = lo, hi
        spec[name] = s

    _user, _spec = mod, spec
    floor = getattr(mod, "CURRENT_FLOOR", 1e-12)
    return {"model_name": str(getattr(mod, "MODEL_NAME", "Custom model")),
            "current_floor": _num(floor, "CURRENT_FLOOR", "value") if floor else 1e-12,
            "parameters": spec}


def run(params):
    """Call the user's simulate() with the given values; return checked lists."""
    if _user is None:
        raise ValueError("No model loaded.")
    p = {}
    for name, s in _spec.items():
        v = params.get(name, s["default"]) if params else s["default"]
        p[name] = int(round(float(v))) if s["integer"] else float(v)

    out = _user.simulate(p)
    if not isinstance(out, dict) or "V" not in out or "I" not in out:
        raise ValueError("simulate() must return a dictionary with at least 'V' and 'I'.")

    res = {}
    for key in ("V", "I", "w", "t"):
        if key in out and out[key] is not None:
            try:
                res[key] = [float(x) for x in out[key]]
            except (TypeError, ValueError):
                raise ValueError(f"'{key}' returned by simulate() must be a list of numbers.")
    n = len(res["V"])
    if n < 2:
        raise ValueError("simulate() returned fewer than 2 points.")
    for key, vals in res.items():
        if len(vals) != n:
            raise ValueError(f"'{key}' has {len(vals)} values but 'V' has {n}; all lists must have the same length.")
    bad = sum(1 for x in res["I"] if not math.isfinite(x))
    res["n_nonfinite"] = bad
    return res
