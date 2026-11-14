"""
Equivalence and consistency tests for the website model.

Run from the project root:
    python -m pytest validation -v

What is tested
  1. The adapted model (backend/memristor_model.py) reproduces the ORIGINAL
     script (Luisier_IOP_deterministic.py, alpha copy) point-by-point for both
     the empirical and ab initio variants.  The original file is executed
     read-only, with matplotlib output suppressed; it is never modified.
  2. Every default in config/model_config.json equals the original value.
  3. Every slider range is valid and contains its default.
  4. Selected slider extremes give finite results (no overflow / NaN).
  5. Out-of-range parameters are reported as 'invalid', not silently plotted.
"""

import json
import math
import os
import runpy
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
import memristor_model as mm  # noqa: E402

ORIGINAL = ROOT / "Luisier_IOP_deterministic.py"
CONFIG = ROOT / "config" / "model_config.json"
RTOL = 1e-12


@pytest.fixture(scope="module")
def original():
    """Execute the original script with plotting disabled; return its globals."""
    if not ORIGINAL.exists():
        pytest.skip(f"original not found at {ORIGINAL}")
    os.environ["MPLBACKEND"] = "Agg"
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    saved = plt.show, plt.savefig
    plt.show = lambda *a, **k: None
    plt.savefig = lambda *a, **k: None
    try:
        g = runpy.run_path(str(ORIGINAL), run_name="original_model")
    finally:
        plt.show, plt.savefig = saved
        plt.close("all")
    return g


@pytest.fixture(scope="module")
def adapted():
    return mm.simulate_both()


@pytest.fixture(scope="module")
def config():
    return json.loads(CONFIG.read_text(encoding="utf-8"))


# ---------------------------------------------------------------- 1. physics
def test_voltage_grid_identical(original, adapted):
    np.testing.assert_allclose(adapted["empirical"]["V"], original["V_signal"],
                               rtol=0, atol=1e-13)


@pytest.mark.parametrize("variant,key_I,key_w", [
    ("empirical", "current", "state"),
    ("ab_initio", "current_fp", "state_fp"),
])
def test_current_and_state_match_original(original, adapted, variant, key_I, key_w):
    r = adapted[variant]
    assert r["status"] == "ok"
    np.testing.assert_allclose(r["I_abs"], original[key_I], rtol=RTOL, atol=0)
    np.testing.assert_allclose(r["w"], original[key_w], rtol=RTOL, atol=1e-15)


def test_scalar_defaults_match_original(original):
    g = original
    d = mm.ORIGINAL_DEFAULTS
    for name in ["k_B", "T", "q", "k_attempt", "Is", "n_set", "n_reset", "vt",
                 "V_max", "freq", "num_cycles", "pts_per_cycle"]:
        assert d[name] == g[name], name
    assert d["Go"] == g["G0"]
    m = g["MoTe2"]()
    for name in ["p_set", "p_reset", "v_off", "v_on", "w_init"]:
        assert d[name] == getattr(m, name), name
    assert mm.VARIANT_DEFAULTS["empirical"]["alpha"] == g["alpha"]
    assert mm.VARIANT_DEFAULTS["ab_initio"]["alpha"] == g["alpha_fp"]
    assert mm.VARIANT_DEFAULTS["empirical"]["Eset"] == m.Eset
    assert mm.VARIANT_DEFAULTS["empirical"]["Ereset"] == m.Ereset
    assert mm.VARIANT_DEFAULTS["ab_initio"]["Eset"] == m.Eset_fp
    assert mm.VARIANT_DEFAULTS["ab_initio"]["Ereset"] == m.Ereset_fp


# ----------------------------------------------------------------- 2. config
def _all_params(config):
    for group in ("sliders", "fixed"):
        for p in config["parameters"][group]:
            yield group, p


def test_config_defaults_equal_original(config):
    for _, p in _all_params(config):
        name = p["name"]
        if p.get("variant_specific"):
            for v, spec in p["variants"].items():
                assert spec["default"] == mm.VARIANT_DEFAULTS[v][name], (name, v)
        else:
            assert p["default"] == mm.ORIGINAL_DEFAULTS[name], name


def test_config_covers_every_model_parameter(config):
    names = {p["name"] for _, p in _all_params(config)}
    assert names == set(mm.REQUIRED_KEYS)


def test_slider_ranges_valid(config):
    for p in config["parameters"]["sliders"]:
        specs = p["variants"].values() if p.get("variant_specific") else [p]
        for s in specs:
            assert s["min"] < s["default"] < s["max"], p["name"]
            if p["scale"] == "log":
                assert s["min"] > 0, p["name"]


# --------------------------------------------------------- 3. robustness
def _slider_specs(config):
    for p in config["parameters"]["sliders"]:
        if p.get("variant_specific"):
            for v, s in p["variants"].items():
                yield p["name"], v, s
        else:
            for v in ("empirical", "ab_initio"):
                yield p["name"], v, p


@pytest.mark.parametrize("which", ["min", "max"])
def test_each_slider_extreme_is_finite(config, which):
    """One parameter at a time at its slider limit, others at default."""
    bad = []
    for name, variant, spec in _slider_specs(config):
        r = mm.simulate({name: spec[which]}, variant)
        if r["status"] != "ok":
            bad.append((name, variant, spec[which]))
    assert not bad, f"non-finite results at slider extremes: {bad}"


def test_overflow_is_reported_not_hidden():
    r = mm.simulate({"alpha": 10 * mm.VARIANT_DEFAULTS["empirical"]["alpha"]})
    assert r["status"] == "invalid" and r["warnings"]


def test_web_api_with_config_defaults_matches_original(original, config):
    """Exactly what the browser sends (JSON numbers from the config) -> original."""
    import web_api
    shared, emp, ab = {}, {}, {}
    for _, p in _all_params(config):
        if p.get("variant_specific"):
            emp[p["name"]] = p["variants"]["empirical"]["default"]
            ab[p["name"]] = p["variants"]["ab_initio"]["default"]
        else:
            shared[p["name"]] = p["default"]
    out = web_api.run({"shared": shared, "empirical": emp, "ab_initio": ab})
    np.testing.assert_allclose(out["results"]["empirical"]["I_abs"], original["current"], rtol=RTOL)
    np.testing.assert_allclose(out["results"]["ab_initio"]["I_abs"], original["current_fp"], rtol=RTOL)


def test_web_api_rejects_non_integer_cycles():
    import web_api
    with pytest.raises(ValueError):
        web_api.run({"shared": {"num_cycles": 2.5}})


def test_unknown_parameter_rejected():
    with pytest.raises(KeyError):
        mm.simulate({"not_a_parameter": 1.0})


# ------------------------------------------- 4. "Simulate Your Device" page
TEMPLATE = ROOT / "backend" / "templates" / "user_model_template.py"


def test_template_loads_and_matches_website_model():
    """The downloadable template reproduces the website model (free data set)."""
    import user_model_runner as r
    info = r.load(TEMPLATE.read_text(encoding="utf-8"))
    assert info["parameters"]["num_cycles"]["integer"] is True
    out = r.run({})                               # template defaults
    ref = mm.simulate({"num_cycles": 2}, "empirical")
    I_t = np.maximum(np.abs(out["I"]), 1e-11)
    np.testing.assert_allclose(out["V"], ref["V"], rtol=0, atol=1e-12)
    np.testing.assert_allclose(out["w"], ref["w"], rtol=1e-9, atol=1e-12)
    np.testing.assert_allclose(I_t, ref["I_abs"], rtol=1e-9)
    assert out["n_nonfinite"] == 0


def test_runner_rejects_bad_files():
    import user_model_runner as r
    with pytest.raises(ValueError):
        r.load("PARAMETERS = {}\n")                         # no simulate()
    with pytest.raises(ValueError):
        r.load("PARAMETERS = {'a': {'min': 0}}\ndef simulate(p): pass\n")   # no default
    r.load("PARAMETERS = {'a': 1.0}\ndef simulate(p): return {'V': [0, 1], 'I': [0]}\n")
    with pytest.raises(ValueError):
        r.run({})                                           # unequal lengths
