"""
Runs a visitor's model file on the "Simulate Your Device" page.

The file must follow the structure of backend/templates/user_model_template.py:
visitors change only parameter values and the experimental arrays x_exp, y_exp.
The script is executed exactly as written, inside the visitor's own browser
(Pyodide in a Web Worker); nothing is sent to a server.

matplotlib calls in the file (figure, semilogy, show, savefig, ...) are replaced
by do-nothing stand-ins, because the website draws the plots itself.

After the script finishes, these variables are read from it:
    V_signal  applied voltage at every time step           (required)
    current   |current| at every time step, as plotted     (required)
    state     state variable w at every time step          (required)
    x_exp, y_exp  experimental voltage and current         (optional)
"""

import contextlib
import io
import math
import sys
import types

REQUIRED = ("V_signal", "current", "state")


class _Ignore:
    """Stand-in for any matplotlib object: every attribute and call is ignored."""

    def __init__(self, *args, **kwargs):
        pass

    def __call__(self, *args, **kwargs):
        return _Ignore()

    def __getattr__(self, name):
        return _Ignore()

    def __iter__(self):                 # allows  fig, ax = plt.subplots()
        return iter((_Ignore(), _Ignore()))

    def __getitem__(self, key):
        return _Ignore()

    def __setitem__(self, key, value):
        pass


def _install_matplotlib_stand_in():
    def make(name):
        mod = types.ModuleType(name)
        mod.__path__ = []
        mod.__getattr__ = lambda attr: _Ignore()      # PEP 562: any name -> stand-in
        return mod
    root = make("matplotlib")
    for sub in ("pyplot", "ticker", "colors", "cm", "gridspec", "patches", "lines", "axes", "figure"):
        m = make(f"matplotlib.{sub}")
        setattr(root, sub, m)
        sys.modules[f"matplotlib.{sub}"] = m
    root.use = lambda *a, **k: None
    sys.modules["matplotlib"] = root


def _floats(ns, name):
    try:
        vals = [float(x) for x in ns[name]]
    except TypeError:
        raise ValueError(f"'{name}' must be a list or array of numbers.")
    return vals


def run_script(code):
    """Execute the visitor's file and return the arrays the page plots."""
    _install_matplotlib_stand_in()
    ns = {"__name__": "__main__", "__file__": "user_model.py"}
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        exec(compile(code, "user_model.py", "exec"), ns)

    missing = [n for n in REQUIRED if n not in ns]
    if missing:
        raise ValueError("Your file must keep the variable names of the template. Missing: "
                         + ", ".join(missing) + ".")
    V, I, w = (_floats(ns, n) for n in REQUIRED)
    n = len(V)
    if n < 2:
        raise ValueError("V_signal has fewer than 2 points.")
    if len(I) != n or len(w) != n:
        raise ValueError(f"V_signal has {n} points, current has {len(I)} and state has {len(w)}; "
                         "they must all have the same length.")

    res = {"V": V, "I": I, "w": w,
           "n_nonfinite": sum(1 for x in I if not math.isfinite(x)),
           "stdout": out.getvalue()[-2000:]}
    if "x_exp" in ns and "y_exp" in ns:
        xe, ye = _floats(ns, "x_exp"), _floats(ns, "y_exp")
        if len(xe) != len(ye):
            raise ValueError(f"x_exp has {len(xe)} values but y_exp has {len(ye)}; they must have the same length.")
        res["x_exp"], res["y_exp"] = xe, ye
    return res
