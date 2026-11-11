"""
Website-compatible implementation of the deterministic memristor model.

Source of truth (read-only original):
    D:\\Memristor_Website\\Luisier_IOP_deterministic.py   (the "alpha" copy,
    designated authoritative by the author, decision A1)

This module reproduces the numerical behaviour of that script exactly
(explicit-Euler update, clipping, polarity-selected ideality factor,
linear HRS/LRS current blend, current floor). Differences from the original
are purely structural and are listed in documentation/CHANGES_FROM_ORIGINAL.md:

  * parameters are passed in as a dict instead of module globals;
  * the empirical and ab initio ("_fp") variants are run as two calls of the
    same function with different (alpha, Eset, Ereset) instead of one loop;
  * pure-Python `math` replaces numpy scalar calls (no numpy needed in the
    browser; equivalence is verified in validation/test_model_equivalence.py);
  * the unused stochastic draw `np.random.normal` (whose result was discarded)
    and all plotting code are omitted;
  * non-finite results are detected and reported (the arithmetic itself is
    unchanged, an exp overflow still yields inf exactly as numpy does).

The module has NO third-party dependencies, so it runs unchanged in CPython
(Windows/Linux/macOS) and in the browser via Pyodide.
"""

from __future__ import annotations

import math

MODEL_VERSION = "1.0.0"

# ---------------------------------------------------------------------------
# Original values, transcribed from Luisier_IOP_deterministic.py (alpha copy).
# Line numbers refer to that file.  Units are given ONLY where the original
# source states them; "" means "not stated in source" (to be added by author).
# ---------------------------------------------------------------------------
L_ORIG = 0.7e-9                      # line 16, "Device thickness (0.7nm)"
Q_ORIG = 1.6 * 10 ** -19             # line 17
BETA_ORIG = 0.6e-9                   # line 21
BETA_FP_ORIG = 0.56e-9               # line 22

ORIGINAL_DEFAULTS = {
    # shared parameters
    "k_B": 8.617e-5,                 # line 13 (eV/K)
    "T": 300.0,                      # line 14 (K)
    "q": Q_ORIG,                     # line 17
    "k_attempt": 6e12,               # line 25 (Hz)
    "Is": 5.0e-9,                    # line 28
    "n_set": 16.280,                 # line 29
    "n_reset": 15.0,                 # line 30
    "vt": 0.026,                     # line 31
    "Go": 0.05e-2,                   # line 15 (G0); N_channels = 1 ignored (decision B1)
    "p_set": 9.0,                    # line 64
    "p_reset": 0.8,                  # line 65
    "v_off": 0.0,                    # line 53
    "v_on": 0.0,                     # line 54
    "w_init": 0.0,                   # line 61
    "current_floor": 1e-11,          # line 133 (visualisation only, decision B9)
    # stimulus / numerical settings
    "V_max": 4.0,                    # line 45
    "freq": 1e3,                     # line 37
    "num_cycles": 40,                # line 38
    "pts_per_cycle": 1000,           # line 41
}

VARIANT_DEFAULTS = {
    # empirical model (lines 23, 55, 56)
    "empirical": {
        "alpha": BETA_ORIG / (L_ORIG * Q_ORIG),
        "Eset": 3.1,
        "Ereset": 3.7,
    },
    # ab initio / first-principles model (lines 24, 57, 58)
    "ab_initio": {
        "alpha": BETA_FP_ORIG / (L_ORIG * Q_ORIG),
        "Eset": 3.0,
        "Ereset": 3.5,
    },
}

REQUIRED_KEYS = tuple(ORIGINAL_DEFAULTS) + ("alpha", "Eset", "Ereset")


def default_params(variant: str = "empirical") -> dict:
    """Full parameter dict reproducing the original script for one variant."""
    if variant not in VARIANT_DEFAULTS:
        raise ValueError(f"unknown variant {variant!r}")
    p = dict(ORIGINAL_DEFAULTS)
    p.update(VARIANT_DEFAULTS[variant])
    return p


def _exp(x: float) -> float:
    """exp() with numpy's overflow semantics (returns inf instead of raising)."""
    try:
        return math.exp(x)
    except OverflowError:
        return math.inf


def _sign(x: float) -> float:
    """np.sign for real scalars."""
    if x > 0:
        return 1.0
    if x < 0:
        return -1.0
    return 0.0 if x == 0 else math.nan


def _clip01(x: float) -> float:
    """np.clip(x, 0, 1) for scalars (NaN propagates, as in numpy)."""
    if x != x:  # NaN
        return x
    return 0.0 if x < 0.0 else (1.0 if x > 1.0 else x)


def time_grid(freq: float, num_cycles: int, pts_per_cycle: int):
    """Replicates  t = np.linspace(0, num_cycles/freq, num_cycles*pts_per_cycle)."""
    n = int(num_cycles) * int(pts_per_cycle)
    stop = num_cycles / freq
    if n < 2:
        raise ValueError("need at least 2 time points")
    step = stop / (n - 1)
    t = [i * step for i in range(n)]
    t[-1] = stop                     # numpy forces the endpoint exactly
    return t, step


def dw_dt(v: float, w: float, p: dict) -> float:
    """State rate, original lines 71-79 (identical form for both variants)."""
    kT = p["k_B"] * p["T"]
    if v > p["v_off"]:
        window = (1 - w) ** p["p_set"]
        return p["k_attempt"] * _exp((-(p["Eset"] - p["alpha"] * (p["q"] * v))) / kT) * window
    elif v < p["v_on"]:
        window = -(w) ** p["p_reset"]
        return p["k_attempt"] * _exp((-(p["Ereset"] - p["alpha"] * (abs(p["q"] * v)))) / kT) * window
    else:
        return 0


def current(v: float, w: float, p: dict):
    """Current, original lines 121-133. Returns (I_total_signed, I_plotted)."""
    n_current = p["n_set"] if v >= 0 else p["n_reset"]
    I_sch = p["Is"] * (_exp(abs(v) / (n_current * p["vt"])) - 1) * _sign(v)
    I_met = p["Go"] * v
    I_total = (1 - w) * I_sch + w * I_met
    I_plot = max(abs(I_total), p["current_floor"]) if I_total == I_total else math.nan
    return I_total, I_plot


def simulate(params: dict | None = None, variant: str = "empirical") -> dict:
    """
    Run the deterministic model over the sinusoidal voltage sweep.

    params  : dict overriding any key of default_params(variant).
    returns : dict with lists t [s], V, w, I (signed I_total), I_abs (plotted,
              |I| floored at current_floor), plus 'params' (resolved) and
              'status' / 'warnings'.
    """
    p = default_params(variant)
    if params:
        unknown = set(params) - set(p)
        if unknown:
            raise KeyError(f"unknown parameter(s): {sorted(unknown)}")
        p.update(params)

    t, dt = time_grid(p["freq"], p["num_cycles"], p["pts_per_cycle"])
    two_pi_f = 2 * math.pi * p["freq"]
    V_max = p["V_max"]

    V_out, w_out, I_out, Iabs_out = [], [], [], []
    w = p["w_init"]
    for ti in t:
        v = V_max * math.sin(two_pi_f * ti)
        rate = dw_dt(v, w, p)
        w = _clip01(w + rate * dt)
        I_tot, I_abs = current(v, w, p)
        V_out.append(v)
        w_out.append(w)
        I_out.append(I_tot)
        Iabs_out.append(I_abs)

    warnings = []
    n_bad = sum(1 for x in Iabs_out if not math.isfinite(x))
    if n_bad:
        warnings.append(
            f"{n_bad} of {len(t)} points are non-finite (exp overflow -> inf*0 = NaN "
            "in the original arithmetic). Parameters are outside the numerically "
            "valid range of the model."
        )
    return {
        "model_version": MODEL_VERSION,
        "variant": variant,
        "params": p,
        "dt": dt,
        "t": t,
        "V": V_out,
        "w": w_out,
        "I": I_out,
        "I_abs": Iabs_out,
        "status": "ok" if not warnings else "invalid",
        "warnings": warnings,
    }


def simulate_both(shared: dict | None = None,
                  empirical: dict | None = None,
                  ab_initio: dict | None = None) -> dict:
    """Run both variants as in the original script (same V(t), same shared params)."""
    shared = shared or {}
    return {
        "empirical": simulate({**shared, **(empirical or {})}, "empirical"),
        "ab_initio": simulate({**shared, **(ab_initio or {})}, "ab_initio"),
    }


if __name__ == "__main__":
    import time
    t0 = time.perf_counter()
    r = simulate_both()
    print(f"both variants, {len(r['empirical']['t'])} steps each: "
          f"{time.perf_counter() - t0:.3f} s")
