"""
Template: simulate your own memristor with the energy-landscape model
=====================================================================

How to use
  1. Change the values in PARAMETERS to those of your device (and, if you
     wish, the equations inside simulate()).
  2. Upload this file on the "Simulate Your Device" page of the website,
     or paste it into the code box there, and press "Run code".
  3. Optionally upload your measured I-V data (CSV with two columns:
     voltage in V, current in A) to compare with the simulation.

Rules the website relies on
  * Keep the names PARAMETERS and simulate.
  * PARAMETERS maps each parameter name to a dictionary with
        "default"  (required) value used when the page opens
        "min", "max"  (optional) slider range; without them only a number box is shown
        "scale"    (optional) "linear" (default) or "log"
        "units", "label"  (optional) text shown next to the control
    An integer default (e.g. 2, not 2.0) gives an integer parameter.
  * simulate(p) receives a dictionary {name: value} and must return a
    dictionary with
        "V": applied voltage for each time step (V)
        "I": device current for each time step (A, signed)
        "w": state variable for each time step (optional, enables the w-V plot)
        "t": time for each time step (s, optional)
    All returned lists must have the same length.
  * Do not plot, read or write files here: the website does the plotting.
    The Python standard library is available; numpy and scipy can be
    imported (they are downloaded automatically the first time).

The code below is the deterministic energy-landscape model with the
free-model (fitted) parameter values used on the website.
"""

import math

MODEL_NAME = "Energy-landscape model (template)"
CURRENT_FLOOR = 1e-11          # |I| below this is drawn at this value on the log axis

PARAMETERS = {
    # --- switching kinetics -------------------------------------------------
    "k_attempt": {"default": 6e12, "min": 6e11, "max": 6e13, "scale": "log", "units": "Hz", "label": "Attempt frequency"},
    "alpha":     {"default": 5.357142857142857e18, "min": 4.2857142857142856e18, "max": 6.428571428571428e18, "label": "Barrier-lowering coefficient"},
    "Eset":      {"default": 3.1, "min": 2.6, "max": 3.6, "units": "eV", "label": "SET activation energy"},
    "Ereset":    {"default": 3.7, "min": 3.2, "max": 4.2, "units": "eV", "label": "RESET activation energy"},
    "p_set":     {"default": 9.0, "min": 1.0, "max": 17.0, "label": "SET window exponent"},
    "p_reset":   {"default": 0.8, "min": 0.1, "max": 1.5, "label": "RESET window exponent"},
    # --- conduction --------------------------------------------------------
    "n_set":     {"default": 16.28, "min": 8.14, "max": 24.42, "label": "Ideality factor (V >= 0)"},
    "n_reset":   {"default": 15.0, "min": 7.5, "max": 22.5, "label": "Ideality factor (V < 0)"},
    "Is":        {"default": 5e-9, "min": 5e-10, "max": 5e-8, "scale": "log", "units": "A", "label": "Schottky saturation current"},
    "Go":        {"default": 5e-4, "min": 5e-5, "max": 5e-3, "scale": "log", "units": "S", "label": "Compliance conductance"},
    # --- voltage sweep -----------------------------------------------------
    "V_max":     {"default": 4.0, "min": 0.5, "max": 8.0, "units": "V", "label": "Sweep amplitude"},
    "freq":      {"default": 1e3, "min": 1e1, "max": 1e5, "scale": "log", "units": "Hz", "label": "Sweep frequency"},
    "num_cycles": {"default": 2, "min": 1, "max": 20, "label": "Number of cycles"},
    "T":         {"default": 300.0, "units": "K", "label": "Temperature"},
}

# constants used by the model (not adjustable on the page)
K_B = 8.617e-5                 # Boltzmann constant (eV/K)
Q = 1.6e-19                    # elementary charge (C)
VT = 0.026                     # thermal voltage (V)
PTS_PER_CYCLE = 1000


def simulate(p):
    n = p["num_cycles"] * PTS_PER_CYCLE
    t_stop = p["num_cycles"] / p["freq"]
    dt = t_stop / (n - 1)
    kT = K_B * p["T"]

    w = 0.0                    # start in the OFF state (HRS)
    t_out, V_out, I_out, w_out = [], [], [], []
    for i in range(n):
        t = i * dt
        v = p["V_max"] * math.sin(2 * math.pi * p["freq"] * t)

        # SET (V > 0) and RESET (V < 0): field-assisted Arrhenius kinetics
        if v > 0:
            rate = p["k_attempt"] * math.exp(-(p["Eset"] - p["alpha"] * Q * v) / kT) * (1 - w) ** p["p_set"]
        elif v < 0:
            rate = -p["k_attempt"] * math.exp(-(p["Ereset"] - p["alpha"] * Q * abs(v)) / kT) * w ** p["p_reset"]
        else:
            rate = 0.0
        w = min(1.0, max(0.0, w + rate * dt))          # explicit Euler + clipping to [0, 1]

        # current: Schottky (HRS) and metallic (LRS) paths blended by w
        n_id = p["n_set"] if v >= 0 else p["n_reset"]
        I_sch = math.copysign(p["Is"] * (math.exp(abs(v) / (n_id * VT)) - 1), v) if v != 0 else 0.0
        I_met = p["Go"] * v
        I = (1 - w) * I_sch + w * I_met

        t_out.append(t); V_out.append(v); I_out.append(I); w_out.append(w)

    return {"t": t_out, "V": V_out, "I": I_out, "w": w_out}
