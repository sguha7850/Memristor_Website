import numpy as np
import sys
np.set_printoptions(threshold=sys.maxsize)
import matplotlib.pyplot as plt
# plt.rcParams.update({
#     'axes.labelsize': 24,
#     'xtick.labelsize': 28,
#     'ytick.labelsize': 28
# }) 
# fig, ax = plt.subplots()

# --- 1. Physical Constants ---
k_B = 8.617e-5          # Boltzmann constant (eV/K)
T = 300                 # Temperature (K)
G0 = 0.05e-2             # DP1 conductance
L = 0.7e-9              # Device thickness (0.7nm)

# --- 2. Model Parameters ---
Ea = 2.0                # Activation Energy (eV)
beta = 0.6e-9           # Field coupling constant (eV*m/V)
beta_fp = 0.56e-9 
k_attempt = 6e12        # Attempt frequency (Hz)

# Schottky Parameters
Is = 5.0e-9
n_set = 16.280
n_reset = 15
vt = 0.026

# Metallic Parameters
N_channels = 1
G_metallic = N_channels * G0
# --- 3. Simulation Setup (UPDATED FOR MULTIPLE CYCLES) ---
freq = 1e3                          
num_cycles = 40                  

# Adjusted total points to ensure clean array slicing per cycle (exactly 1000 pts per cycle)
pts_per_cycle = 1000
total_pts = num_cycles * pts_per_cycle
t = np.linspace(0, num_cycles/freq, total_pts)   

V_max = 4                        
V_signal = V_max * np.sin(2 * np.pi * freq * t)
#V_signal[V_signal < 0] *= 0.8
dt = t[1] - t[0]

class MoTe2:
    def __init__(self): 
        # Thresholds
        self.v_off = 0
        self.v_on = 0
        self.Eset = 3.1
        self.Ereset =3.7
        self.Eset_fp = 3.0
        self.Ereset_fp =3.5

        # State limits
        self.w_init = 0    # Starts in OFF State
        self.w = self.w_init
        self.w_fp = self.w_init
        self.p_set = 9
        self.p_reset = 0.8
        self.U0 = 10.0       
        self.delta_E = 0.0   
        self.eta = 1.0       
        self.sigma = 5  

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
state = []

current_fp = []
state_fp = []
    
for v in V_signal:
    rate = memristor.dw_dt_deterministic(v)
    dw_det = rate * dt
    
    #drift_stoch = - (1.0 / memristor.eta) * memristor.dU_dw() * dt
    diffusion_stoch = (memristor.sigma / memristor.eta) * np.random.normal(0, 1) * np.sqrt(dt)
    
    dw_stoch = diffusion_stoch
    total_dw = dw_det 
    #total_dw = dw_det + dw_stoch
    
    memristor.w = np.clip(memristor.w + total_dw, 0, 1)
    state.append(memristor.w)
    
    # FP model updates
    rate_fp = memristor.dw_dt_deterministic_fp(v)
    dw_det_fp = rate_fp * dt
    total_dw_fp = dw_det_fp

    memristor.w_fp = np.clip(memristor.w_fp + total_dw_fp, 0, 1)
    state_fp.append(memristor.w_fp)
    
    # Select ideality factor based on polarity
    if v >= 0:
        n_current = n_set
    else:
        n_current = n_reset
        
    # Calculate Schottky and Metallic components
    I_sch = Is * (np.exp(np.abs(v) / (n_current * vt)) - 1) * np.sign(v)
    I_met = G_metallic * v
    
    # Total current blending (HRS vs LRS)
    I_total = (1 - memristor.w) * I_sch + memristor.w * I_met
    I_clipped = np.maximum(np.abs(I_total), 1e-11)
    current.append(I_clipped)
    
    # Total current blending (HRS vs LRS) for FP model
    I_total_fp = (1 - memristor.w_fp) * I_sch + memristor.w_fp * I_met
    I_clipped_fp = np.maximum(np.abs(I_total_fp), 1e-11)
    current_fp.append(I_clipped_fp)

current = np.array(current)
current_fp = np.array(current_fp)

#Experimental Data Reference
x_exp = [0.02918,
0.02918,
0.0627,
0.09621,
0.12973,
0.32664,
0.82311,
1.56467,
2.22453,
2.81946,
3.28241,
3.47932,
3.36411,
3.19862,
2.95143,
2.81946,
2.60579,
2.25805,
1.92917,
1.58143,
1.20227,
0.90481,
0.52565,
0.19467,
0.11297,
0.07945,
0.07945,
0.07945,
0.04594,
0.01452,
-0.019,
-0.019,
-0.06928,
-0.10279,
-0.13422,
-0.21801,
-0.3835,
-0.76266,
-1.27379,
-1.85196,
-2.39661,
-3.02295,
-3.40421,
-3.73309,
-3.94886,
-3.99704,
-3.99704,
-3.99704,
-3.99704,
-3.99704,
-3.66815,
-3.37069,
-2.94125,
-2.4783,
-2.01745,
-1.35758,
-0.76266,
-0.41492,
-0.25153,
-0.11955]
y_exp = [0.0000000000130036,
0.0000000000422471,
0.000000000201371,
0.000000000862892,
0.00000000491162,
0.000000026227,
0.0000000852082,
0.000000344968,
0.00000105889,
0.00000344019,
0.00000794958,
0.0000117461,
0.0000475545,
0.000154499,
0.000423323,
0.000824989,
0.000824989,
0.000741664,
0.000625492,
0.000474237,
0.000301093,
0.000203775,
0.000104562,
0.0000381616,
0.0000124324,
0.00000480254,
0.00000156459,
0.000000485009,
0.000000113185,
0.0000000277594,
0.0000000120129,
0.0000000033241,
0.000000233469,
0.00000147822,
0.00000709612,
0.0000230544,
0.0000631685,
0.00014597,
0.000301093,
0.000558339,
0.00104,
0.00181,
0.00268,
0.00318,
0.00268,
0.00181,
0.000662039,
0.000270682,
0.0000881838,
0.0000449293,
0.0000287288,
0.0000110977,
0.00000428694,
0.0000020783,
0.00000105889,
0.000000509716,
0.00000016724,
0.000000061037,
0.0000000222764,
0.00000000612053]
plt.figure(figsize=(10, 6.8))
plt.semilogy(V_signal, current, color="#0A0A0A", linestyle='-', label="Emperical Model",linewidth=3)
plt.semilogy(V_signal, current_fp, color="#02F8EC", linestyle='dotted', label="Ab inito Model", linewidth=3)
plt.semilogy(x_exp, y_exp, marker='o', markerfacecolor='none', markeredgecolor="#070707", linestyle='none', label="Experimental Data", markersize=9, markeredgewidth=1.5)
# ... (Your plotting code above this remains unchanged)

plt.minorticks_on()

# Major ticks: length, thickness, and label (number) size
plt.tick_params(axis='both', which='major', length=12, width=2, labelsize=28)
# Minor ticks: shorter and thinner
plt.tick_params(axis='both', which='minor', length=6, width=1)

ax = plt.gca()

# X-axis is linear, so AutoMinorLocator works perfectly
from matplotlib.ticker import LogLocator, AutoMinorLocator
ax.xaxis.set_minor_locator(AutoMinorLocator())

# Y-axis is logarithmic, so it requires LogLocator. 
# CRITICAL FIX: Add 'numticks=100' so it doesn't suppress the 56 minor ticks you need.
ax.yaxis.set_minor_locator(LogLocator(base=10.0, subs=(0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9), numticks=100))
ax.yaxis.set_minor_formatter(plt.NullFormatter())

plt.tight_layout()

plt.show()
plt.savefig("Luisier_IOP_deterministic.png", dpi=900)

#print(V_signal)