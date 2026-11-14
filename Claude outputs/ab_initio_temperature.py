import numpy as np
import matplotlib.pyplot as plt
from matplotlib.ticker import LogLocator, AutoMinorLocator

# =====================================================================
# Ab initio (first-principles) memristor model
#   Section A: original ab initio model at 300 K (unchanged equations)
#   Section B: temperature-dependent hysteresis
# =====================================================================

# --- 1. Physical constants ---
k_B = 8.617e-5          # Boltzmann constant (eV/K)
q = 1.6*10**-19         # Elementary charge
L = 0.7e-9              # Device thickness (0.7 nm)

# --- 2. Ab initio model parameters ---
beta_fp = 0.56e-9       # Field coupling constant (eV*m/V)
alpha_fp = beta_fp/(L*q)
Eset_fp = 3.0           # SET activation energy (eV)
Ereset_fp = 3.5         # RESET activation energy (eV)
k_attempt = 6e12        # Attempt frequency (Hz)
p_set = 9               # SET window exponent
p_reset = 0.8           # RESET window exponent
v_off = 0               # SET for V > 0
v_on = 0                # RESET for V < 0
w_init = 0              # Starts in OFF state

# Schottky (HRS) parameters, defined at T_ref
Is = 5.0e-9
n_set = 16.280
n_reset = 15
vt = 0.026              # Thermal voltage at T_ref

# Metallic (LRS) parameters, defined at T_ref
G0 = 0.05e-2
G_metallic = G0

# --- 3. Temperature parameters (Section B) ---
T_ref = 300             # Reference temperature (K): all values above are fitted here
phi_b = 0.38            # Schottky barrier height (eV)  -- value from Ag/WS2/W paper, fit for your device
tcr = 3.45e-3           # Temperature coefficient of resistance of the LRS (1/K) -- same source

# --- 4. Voltage sweep ---
freq = 1e3
num_cycles = 40
pts_per_cycle = 1000
total_pts = num_cycles * pts_per_cycle
t = np.linspace(0, num_cycles/freq, total_pts)
V_max = 4
V_signal = V_max * np.sin(2 * np.pi * freq * t)
dt = t[1] - t[0]


# =====================================================================
# Model equations (temperature enters in four places)
# =====================================================================
def dw_dt(v, w, T):
    """Arrhenius SET/RESET kinetics; T enters through k_B*T."""
    if v > v_off:
        window = (1 - w)**p_set
        return k_attempt * np.exp((-(Eset_fp - alpha_fp * (q*v)) / (k_B * T))) * window
    elif v < v_on:
        window = -(w)**p_reset
        return k_attempt * np.exp((-(Ereset_fp - alpha_fp * (abs(q*v))) / (k_B * T))) * window
    else:
        return 0


def device_current(v, w, T):
    """Total current (signed). At T == T_ref this equals the original model."""
    # Schottky (HRS): thermionic emission, I_s ~ T^2 exp(-phi_b / k_B T), V_T ~ T
    vt_T = vt * (T / T_ref)
    Is_T = Is * (T / T_ref)**2 * np.exp(-phi_b / k_B * (1/T - 1/T_ref))
    n_current = n_set if v >= 0 else n_reset
    I_sch = Is_T * (np.exp(np.abs(v) / (n_current * vt_T)) - 1) * np.sign(v)

    # Metallic (LRS): R(T) = R0[1 + tcr (T - T_ref)]
    G_T = G_metallic / (1 + tcr * (T - T_ref))
    I_met = G_T * v

    return (1 - w) * I_sch + w * I_met


def simulate(T):
    """Explicit-Euler sweep at temperature T. Returns |I| (floored at 1e-11 for plotting) and w."""
    w = w_init
    current, state = [], []
    for v in V_signal:
        w = np.clip(w + dw_dt(v, w, T) * dt, 0, 1)
        I_total = device_current(v, w, T)
        current.append(np.maximum(np.abs(I_total), 1e-11))
        state.append(w)
    return np.array(current), np.array(state)


def switching_voltages(state):
    """SET / RESET voltages in the last cycle: where w crosses 0.5 (None if it never does)."""
    w = state[-pts_per_cycle:]
    V = V_signal[-pts_per_cycle:]
    up = np.where((w[:-1] < 0.5) & (w[1:] >= 0.5))[0]
    down = np.where((w[:-1] >= 0.5) & (w[1:] < 0.5))[0]
    v_set = V[up[0] + 1] if len(up) else None
    v_reset = V[down[0] + 1] if len(down) else None
    return v_set, v_reset


def style_axes(ax):
    ax.minorticks_on()
    ax.tick_params(axis='both', which='major', length=12, width=2, labelsize=28)
    ax.tick_params(axis='both', which='minor', length=6, width=1)
    ax.xaxis.set_minor_locator(AutoMinorLocator())
    ax.yaxis.set_minor_locator(LogLocator(base=10.0, subs=(0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9), numticks=100))
    ax.yaxis.set_minor_formatter(plt.NullFormatter())
    ax.set_xlabel("Voltage (V)", fontsize=28)
    ax.set_ylabel("Current (A)", fontsize=28)


# =====================================================================
# Section A: ab initio model at 300 K (identical to the original code)
# =====================================================================
current_fp, state_fp = simulate(T_ref)

fig, ax = plt.subplots(figsize=(10, 6.8))
ax.semilogy(V_signal, current_fp, color="#02F8EC", linestyle='dotted', label="Ab initio model", linewidth=3)
style_axes(ax)
ax.legend(fontsize=20, frameon=False)
fig.tight_layout()
fig.savefig("ab_initio_300K.png", dpi=900)


# =====================================================================
# Section B: temperature-dependent hysteresis
# =====================================================================
temperatures = [250, 300, 350, 400]      # K
colors = plt.cm.coolwarm(np.linspace(0, 1, len(temperatures)))

fig, ax = plt.subplots(figsize=(10, 6.8))
print(f"{'T (K)':>6} {'V_SET (V)':>10} {'V_RESET (V)':>12} {'max w':>7} {'min w':>7}")
for T_k, c in zip(temperatures, colors):
    I_T, w_T = simulate(T_k)
    # the response is periodic after the first cycle, so the last cycle is plotted
    ax.semilogy(V_signal[-pts_per_cycle:], I_T[-pts_per_cycle:], color=c, linewidth=3, label=f"{T_k} K")
    v_set, v_reset = switching_voltages(w_T)
    fmt = lambda x: f"{x:.3f}" if x is not None else "none"
    print(f"{T_k:>6} {fmt(v_set):>10} {fmt(v_reset):>12} {w_T.max():>7.3f} {w_T.min():>7.3f}")

style_axes(ax)
ax.legend(fontsize=20, frameon=False)
fig.tight_layout()
fig.savefig("ab_initio_temperature.png", dpi=900)   # save before show
plt.show()
