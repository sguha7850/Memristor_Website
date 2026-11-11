import numpy as np
import sys
import matplotlib.pyplot as plt
from matplotlib.ticker import LogLocator, AutoMinorLocator

np.set_printoptions(threshold=sys.maxsize)

# --- 1. Physical Constants ---
k_B = 8.617e-5
T = 300
G0 = 0.05e-2
L = 0.7e-9

# --- 2. Model Parameters ---
Ea = 2.0
beta = 0.6e-9
beta_fp = 0.56e-9
k_attempt = 6e12

# Schottky Parameters
Is = 5.0e-9
n_set = 16.280
n_reset = 15
vt = 0.026

# Metallic Parameters
N_channels = 1
G_metallic = N_channels * G0

# --- 3. Simulation Setup ---
freq = 1e3
num_cycles = 50
pts_per_cycle = 1000
total_pts = num_cycles * pts_per_cycle
t = np.linspace(0, num_cycles/freq, total_pts)

V_max = 4
V_signal = V_max * np.sin(2 * np.pi * freq * t)
dt = t[1] - t[0]

class MoTe2:
    def __init__(self):
        self.v_off = 0
        self.v_on = 0
        self.Eset = 3.1
        self.Ereset = 3.7
        self.Eset_fp = 3.0
        self.Ereset_fp = 3.5

        self.w_init = 0
        self.w = self.w_init
        self.w_fp = self.w_init
        self.w_det = 0.0
        self.w_stoch = 0.0
        self.p_set = 9
        self.p_reset = 0.8
        self.U0 = 10.0
        self.delta_E = 0.0
        self.eta = 1.0
        self.sigma = 1

    def dw_dt_deterministic(self, v):
        if v > self.v_off:
            window = (1 - self.w)**self.p_set
            return k_attempt * np.exp((-(self.Eset - beta * (v/L)) / (k_B * T))) * window
        elif v < self.v_on:
            window = -(self.w)**self.p_reset
            return k_attempt * np.exp((-(self.Ereset - beta * (abs(v/L))) / (k_B * T))) * window
        else:
            return 0

    def dw_dt_deterministic_fp(self, v):
        if v > self.v_off:
            window = (1 - self.w_fp)**self.p_set
            return k_attempt * np.exp((-(self.Eset_fp - beta_fp * (v/L)) / (k_B * T))) * window
        elif v < self.v_on:
            window = -(self.w_fp)**self.p_reset
            return k_attempt * np.exp((-(self.Ereset_fp - beta_fp * (abs(v)/L)) / (k_B * T))) * window
        else:
            return 0

    def dU_dw(self):
        return self.U0 * (4 * self.w**3 - 6 * self.w**2 + 2 * self.w) + self.delta_E

memristor = MoTe2()
current = []
current_fp = []

for v in V_signal:
    rate = memristor.dw_dt_deterministic(v)
    dw_det = rate * dt

    diffusion_stoch = (memristor.sigma / memristor.eta) * np.random.normal(0, 1) * np.sqrt(dt)
    dw_stoch = diffusion_stoch

    memristor.w_det = np.clip(memristor.w_det + dw_det, 0, 0.90)
    memristor.w_stoch += dw_stoch

    w_total = memristor.w_det + memristor.w_stoch

    if w_total > 1.0:
        w_total = 1.0
        memristor.w_stoch = 1.0 - memristor.w_det
    elif w_total < 0.0:
        w_total = 0.0
        memristor.w_stoch = 0.0 - memristor.w_det

    memristor.w = w_total

    if v >= 0:
        n_current = n_set
    else:
        n_current = n_reset

    I_sch = Is * (np.exp(np.abs(v) / (n_current * vt)) - 1) * np.sign(v)
    I_met = G_metallic * v

    I_total = (1 - memristor.w) * I_sch + memristor.w * I_met
    # I_clipped = np.maximum(np.abs(I_total), 1e-11)
    current.append(I_total)

    I_total_fp = (1 - memristor.w_fp) * I_sch + memristor.w_fp * I_met
    # I_clipped_fp = np.maximum(np.abs(I_total_fp), 1e-8)
    current_fp.append(I_total_fp)

current = np.array(current)
current_fp = np.array(current_fp)

# --- 4. Extract V_SET, V_RESET, HRS, and LRS ---
V_set_list = []
V_reset_list = []
HRS_list = []
LRS_list = []

V_read = 0.3

for i in range(num_cycles):
    start_idx = i * pts_per_cycle
    end_idx = (i + 1) * pts_per_cycle

    v_cycle = V_signal[start_idx:end_idx]
    i_cycle = current[start_idx:end_idx]

    idx_q1 = slice(0, pts_per_cycle // 4)
    idx_q2 = slice(pts_per_cycle // 4, pts_per_cycle // 2)
    idx_q3 = slice(pts_per_cycle // 2, 3 * pts_per_cycle // 4)

    v_q1 = v_cycle[idx_q1]
    i_q1 = i_cycle[idx_q1]

    v_q2 = v_cycle[idx_q2]
    i_q2 = i_cycle[idx_q2]

    v_q3 = v_cycle[idx_q3]
    i_q3 = i_cycle[idx_q3]

    # --- V_SET Extraction ---
    valid_q1 = np.where(v_q1 > 0.1)[0]
    v_q1_valid = v_q1[valid_q1]
    i_q1_valid = i_q1[valid_q1]

    if len(v_q1_valid) > 1:
        log_i = np.log10(i_q1_valid)
        deriv = np.gradient(log_i, v_q1_valid)
        search_window = np.where((v_q1_valid >= 2.5) & (v_q1_valid <= 3.7))[0]

        if len(search_window) > 0:
            local_max_idx = np.argmax(deriv[search_window])
            vset_idx = search_window[local_max_idx]
            V_set_list.append(v_q1_valid[vset_idx])
        else:
            V_set_list.append(np.nan)
    else:
        V_set_list.append(np.nan)

    # --- V_RESET Extraction ---
    if len(v_q3) > 0:
        vreset_idx = np.argmax(i_q3)
        V_reset_list.append(v_q3[vreset_idx])
    else:
        V_reset_list.append(np.nan)

    # --- HRS & LRS Extraction ---
    idx_hrs_read = np.argmin(np.abs(v_q1 - V_read))
    HRS_list.append(v_q1[idx_hrs_read] / i_q1[idx_hrs_read])

    idx_lrs_read = np.argmin(np.abs(v_q2 - V_read))
    LRS_list.append(v_q2[idx_lrs_read] / i_q2[idx_lrs_read])

# --- 5. Statistics Calculation ---
vset_array = np.array(V_set_list)
vset_clean = vset_array[~np.isnan(vset_array)]
vset_mean = np.mean(vset_clean)
vset_std = np.std(vset_clean)

vreset_array = np.array(V_reset_list)
vreset_clean = vreset_array[~np.isnan(vreset_array)]
vreset_mean = np.mean(vreset_clean)
vreset_std = np.std(vreset_clean)

hrs_array = np.array(HRS_list)
lrs_array = np.array(LRS_list)

print(f"Mean V_SET: {vset_mean:.2f} V | Std: {vset_std:.4f} V")
print(f"Mean V_RESET: {vreset_mean:.2f} V | Std: {vreset_std:.4f} V")

# --- 6. Matplotlib 2x2 Plotting ---
fig, axs = plt.subplots(2, 2, figsize=(16, 10))

# Plot 1: I-V Curve (Top Left)
ax1 = axs[0, 0]
ax1.plot(V_signal, current, color="#0A0A0A", linestyle='-', label="Empirical Model", linewidth=3)
ax1.minorticks_on()
ax1.tick_params(axis='both', which='major', length=12, width=2, labelsize=16)
ax1.tick_params(axis='both', which='minor', length=6, width=1)
ax1.xaxis.set_minor_locator(AutoMinorLocator())
ax1.yaxis.set_minor_locator(LogLocator(base=10.0, subs=(0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9), numticks=100))
ax1.yaxis.set_minor_formatter(plt.NullFormatter())
ax1.set_xlabel("Voltage (V)")
ax1.set_ylabel("Current (A)")
ax1.set_title("I-V Characteristic")
# ax1.legend()

# Plot 2: V_SET Histogram (Top Right)
ax2 = axs[0, 1]
ax2.hist(vset_clean, bins=15, color='#004C99', alpha=0.7, edgecolor='black')
ax2.axvline(vset_mean, color='red', linestyle='dashed', linewidth=2)
ax2.text(0.05, 0.95, f"Mean: {vset_mean:.2f} V\nStd: {vset_std:.2f} V",
         transform=ax2.transAxes, verticalalignment='top',
         bbox=dict(boxstyle='round', facecolor='white', alpha=0.9))
ax2.set_xlabel("$V_{SET}$ (V)")
ax2.set_ylabel("Frequency")
ax2.set_title("$V_{SET}$ Distribution")

# Plot 3: V_RESET Histogram (Bottom Left)
ax3 = axs[1, 0]
ax3.hist(vreset_clean, bins=15, color='#D90016', alpha=0.7, edgecolor='black')
ax3.axvline(vreset_mean, color='blue', linestyle='dashed', linewidth=2)
ax3.text(0.05, 0.95, f"Mean: {vreset_mean:.2f} V\nStd: {vreset_std:.2f} V",
         transform=ax3.transAxes, verticalalignment='top',
         bbox=dict(boxstyle='round', facecolor='white', alpha=0.9))
ax3.set_xlabel("$V_{RESET}$ (V)")
ax3.set_ylabel("Frequency")
ax3.set_title("$V_{RESET}$ Distribution")

# Plot 4: Resistance States over Cycles (Bottom Right)
ax4 = axs[1, 1]
ax4.semilogy(range(1, num_cycles+1), hrs_array, 'o', color='#004C99', label='HRS (Path 1)', markersize=6)
ax4.semilogy(range(1, num_cycles+1), lrs_array, 's', color='#D90016', label='LRS (Path 2)', markersize=6)
ax4.set_xlabel("Cycle Number")
ax4.set_ylabel("Resistance ($\Omega$)")
ax4.set_title("Endurance at 0.3V")
ax4.legend()

plt.tight_layout()
plt.show()