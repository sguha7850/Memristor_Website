"""
Thin entry point used by the website (frontend/js/sim-worker.js via Pyodide).

It only (1) coerces the numbers that arrive from JavaScript to the Python types
the original script used, and (2) calls memristor_model.simulate for each
requested variant.  No physics lives here.  Contract: architecture/API.md.
"""

from __future__ import annotations

import math

import memristor_model as mm

INT_KEYS = ("num_cycles", "pts_per_cycle")


def _coerce(params: dict | None) -> dict:
    out = {}
    for k, v in (params or {}).items():
        if k in INT_KEYS:
            if float(v) != int(v):
                raise ValueError(f"{k} must be an integer, got {v}")
            out[k] = int(v)
        else:
            x = float(v)
            if not math.isfinite(x):
                raise ValueError(f"{k} must be a finite number, got {v}")
            out[k] = x
    return out


def run(request: dict) -> dict:
    """
    request = {"shared": {...}, "empirical": {...}, "ab_initio": {...},
               "variants": ["empirical", "ab_initio"]}
    returns {variant: {t, V, w, I, I_abs, status, warnings, params, dt}}
    """
    shared = _coerce(request.get("shared"))
    variants = list(request.get("variants") or ["empirical", "ab_initio"])
    results = {}
    for v in variants:
        specific = _coerce(request.get(v))
        r = mm.simulate({**shared, **specific}, v)
        results[v] = {k: r[k] for k in
                      ("t", "V", "w", "I", "I_abs", "status", "warnings", "params", "dt")}
    return {"model_version": mm.MODEL_VERSION, "results": results}
