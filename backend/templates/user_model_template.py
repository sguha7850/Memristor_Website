import numpy as np
import sys
np.set_printoptions(threshold=sys.maxsize)
import matplotlib.pyplot as plt
plt.rcParams.update({
    'axes.labelsize': 24,
    'xtick.labelsize': 18,
    'ytick.labelsize': 18
}) 
fig, ax = plt.subplots()
# --- 1. Physical Constants ---
k_B = 8.617e-5          # Boltzmann constant (eV/K)
T = 300                 # Temperature (K)
G0 = 0.4e-2             # DP1 conductance
L = 0.7e-9              # Device thickness (0.7nm)

# --- 2. Model Parameters ---
Ea = 2.0                # Activation Energy (eV)
beta = 0.65e-9          # Field coupling constant (eV*m/V)
k_attempt = 1e10        # Attempt frequency (Hz)

# Schottky Parameters
Is = 0.5e-8
n_set = 19
n_reset = 15
vt = 0.026

# Metallic Parameters
N_channels = 1
G_metallic = N_channels * G0

freq = 1e3                          # 1 kHz
t = np.linspace(0, 1/freq, 25000)   # 1 cycle
V_max = 4.0                         # 4.5V Amplitude
V_signal = V_max * np.sin(2 * np.pi * freq * t)
V_signal[V_signal < 0] *= 0.4
dt = t[1] - t[0]

class MoTe2:
    def __init__(self): 
        # Thresholds
        self.v_off = 0.4
        self.v_on = -0.4
        self.Eset = 3.39
        self.Ereset = 1.38

        # State limits
        self.w_init = 0    # Starts in OFF State
        self.w = self.w_init
        self.p_set = 5
        self.p_reset = 0.3

    def dw_dt(self, v):
        if v > self.v_off:
            window = (1 - self.w)**self.p_set
            return k_attempt * np.exp((-(self.Eset - beta * (v/L)) / (k_B * T))) * window
        elif v < self.v_on:
            # Using -(self.w**p) to ensure a negative rate for RESET
            window = -(self.w)**self.p_reset 
            return k_attempt * np.exp((-(self.Ereset - beta * (abs(v/L))) / (k_B * T))) * window
        else:
            return 0

# --- 3. Simulation Loop ---
memristor = MoTe2()
current = []
state = []
derivative = []

for v in V_signal:
    dw_val = memristor.dw_dt(v)
    derivative.append(dw_val)
    
    # Update and clip state variable
    memristor.w = np.clip(memristor.w + dw_val * dt, 0, 1)
    state.append(memristor.w)
    
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
    I_clipped = np.maximum(np.abs(I_total), 1e-13)
    current.append(I_clipped)

# --- 4. Plotting ---

# Plot 1: State Variable vs Voltage
plt.figure(figsize=(8, 4))
plt.plot(V_signal, state)
plt.title("State Variable (w) vs Voltage")
plt.xlabel("Voltage (V)")
plt.ylabel("State (w)")
plt.grid(True)
plt.show()

# Plot 2: I-V Characteristics (Log Scale)
plt.figure(figsize=(10, 6.8))
plt.semilogy(V_signal, current, label="Simulated Model", linewidth=4)

# Experimental Data Reference
x_exp = [0.01676,
0.01676,
0.01676,
0.01676,
0.01676,
0.01676,
0.01676,
0.01676,
0.04144,
0.14016,
0.32454,
0.71798,
0.92704,
1.19708,
1.44389,
1.76329,
2.04639,
2.35418,
2.62422,
2.84634,
3.11638,
3.28915,
3.50982,
3.75518,
3.97731,
3.26447,
3.26447,
3.26447,
3.26447,
3.26447,
3.26447,
3.26447,
3.26447,
3.19042,
3.00604,
2.79698,
2.53856,
2.29175,
2.08269,
1.87363,
1.65295,
1.33355,
1.07513,
0.65701,
0.4102,
0.20114,
0.0908,
0.02837,
0.02837,
0.02837,
0.02837,
-0.0689,
-0.21699,
-0.40137,
-0.58575,
-0.77013,
-0.97919,
-1.01694,
-1.20132,
-1.26229,
-1.26229,
-1.26229,
-1.26229,
-1.26229,
-1.26229,
-1.26229,
-1.26229,
-1.26229,
-1.32327,
-1.3857,
-1.49604,
-1.21293,
-1.00387,
-0.7832,
-0.56107,
-0.31571,
-0.16763,
-0.10665]
y_exp = [0.0000000486018,
0.000000081374,
0.000000203254,
0.000000659447,
0.00000241976,
0.0000078508,
0.0000170739,
0.00005169,
0.000248272,
0.000911005,
0.00276,
0.00689,
0.00689,
0.00689,
0.00689,
0.00689,
0.00689,
0.00689,
0.00689,
0.00689,
0.00689,
0.00689,
0.00689,
0.00689,
0.00689,
0.00384,
0.00154,
0.000415681,
0.0000993971,
0.0000308727,
0.0000101977,
0.00000259322,
0.000000659447,
0.000000364703,
0.000000319997,
0.000000280771,
0.000000390847,
0.000000445451,
0.000000445451,
0.000000445451,
0.000000319997,
0.000000120466,
0.0000000671376,
0.0000000306341,
0.0000000123593,
0.00000000465278,
0.00000000118318,
0.000000000364679,
0.000000000120459,
0.0000000000374143,
0.0000000000101182,
0.000615376,
0.002,
0.00358,
0.0053,
0.00733,
0.00408,
0.002,
0.00242,
0.00242,
0.000911005,
0.000282957,
0.0000765221,
0.0000308727,
0.0000101977,
0.00000314311,
0.000000751577,
0.00000023165,
0.000000156478,
0.000000217824,
0.000000264013,
0.000000105699,
0.0000000426441,
0.0000000170728,
0.00000000779014,
0.00000000257319,
0.000000000849959,
0.000000000319976]
print("Finished")
plt.semilogy(x_exp, y_exp, 'r--', label="Experimental Data", alpha=0.7,linewidth=4)

plt.xlabel("Voltage (V)")
plt.ylabel("Current (A)")
plt.legend(fontsize=20)
plt.grid(True, which="both", ls="-", alpha=0.3)
plt.show()
plt.savefig("Akinwande_iv_curve.png", dpi=900)
