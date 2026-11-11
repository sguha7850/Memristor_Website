# Technical analysis: `Luisier_IOP_deterministic.py` (deterministic MoTe2 memristor model)

Analyst scope: the deterministic Python model only (`stochastic.py`, the Verilog-A model and the TCAM netlist are out of scope here). Source files were treated as read-only. All simulations ran on copies in a scratch directory.

Conventions used in this report:
- **[SRC]**: stated in the source code (line numbers given).
- **INFERENCE**: my interpretation, with the reasoning. It is not confirmed by the source.
- "Primary" is `original_code/Luisier_IOP_deterministic.py`. "Variant" is the root-level `Luisier_IOP_deterministic.py`.
- "Emp" is the model without the `_fp` suffix (the plot labels it "Emperical Model"). "FP" is the `_fp` model (the plot labels it "Ab inito Model").

---

## 1. Summary

- The model is a single-state-variable (`w` ∈ [0, 1]) memristor with **Arrhenius-type, field-lowered barrier kinetics** for SET (V > 0) and RESET (V < 0). Polynomial window functions `(1-w)^p_set` and `w^p_reset` shape the kinetics. The current is a **linear blend, weighted by w, of a Schottky-type diode current (HRS) and an ohmic "metallic" current (LRS)**.
- Two parameter sets run side by side through the same loop and the same conduction model: Emp (`beta, Eset, Ereset`) and FP (`beta_fp, Eset_fp, Ereset_fp`). They differ **only in the switching kinetics**. **The source's own plot labels call the `_fp` set "Ab inito Model" and the other set "Emperical Model" (lines 264–265).** If anyone has assumed that `_fp` means "free parameter", the source contradicts that. `_fp` most plausibly means "first-principles" (INFERENCE).
- The integration is explicit forward Euler on a fixed grid (40 000 points, dt ≈ 1.0000 µs, 40 cycles of a 4 V, 1 kHz sine). State bounds are enforced by `np.clip` and by the window functions.
- **Both files run cleanly** (Python 3.13, NumPy 2.5.3, Matplotlib 3.11.2, Agg backend). Neither emits warnings. Run time is about 1.7 s including the 900-dpi `savefig`; the physics loop alone takes about 0.38 s.
- **Measured baseline (cycle 2):** Emp V_SET = +3.22 V, V_RESET = −3.80 V, I_HRS(+1 V) = 4.81e-8 A, I_LRS(+1 V) = 4.93e-4 A, ON/OFF(+1 V) = 1.02e4. FP V_SET = +3.32 V, V_RESET = −3.81 V, ON/OFF = 1.01e4. |I| spans 1e-11 A (the floor) to 1.97e-3 A.
- **Primary and variant are mathematically equivalent.** `alpha*(q*v)` ≡ `beta*(v/L)`, and q cancels exactly. Every `abs()` placement is equivalent because L > 0 and q > 0. Outputs agree to a relative 5e-14 in current and 2e-12 in w; this is floating-point rounding, not a behavioural difference. The variant's only other change is that the unused `dU_dw` method is removed.
- **Key structural fact for a GUI.** The observables depend only on these combinations:
  - β/L (= "alpha"·q = 0.857 eV/V)
  - k_attempt/freq
  - n·vt, per polarity
  - N_channels·G0

  Showing both members of a pair as independent sliders would be redundant.
- **The RESET margin is narrow.** At baseline, RESET completes only about 0.2 V below the −4 V peak. A 10 % change in V_max, β, L or Ereset in the unfavourable direction stops RESET entirely, and the device stays in LRS.

---

## 2. Source files and provenance

| File | Lines | md5 | Role |
|---|---|---|---|
| `/mnt/user-data/uploads/Memristor_Website/original_code/Luisier_IOP_deterministic.py` | 292 | `390889b25d701722c3177fb2f54a1630` | **Primary** (user-designated original) |
| `/mnt/user-data/uploads/Memristor_Website/Luisier_IOP_deterministic.py` | 293 | `1a716232249ec3c61e40db2867f7d2c5` | Variant |

### 2.1 Variant diff (complete)

```
16a17   > q=1.6*10**-19
21a23   > alpha=(beta/(L*q))
        > alpha_fp=(beta_fp/(L*q))
71  P:  k_attempt*np.exp((-(self.Eset    - beta    * (v/L))       )/(k_B*T))*window
74  V:  k_attempt*np.exp((-(self.Eset    - alpha   * (q*v))       )/(k_B*T))*window
74  P:  ...(self.Ereset  - beta    * (abs(v/L)))
77  V:  ...(self.Ereset  - alpha   * (abs(q*v)))
80  P:  ...(self.Eset_fp - beta_fp * (v/L))
83  V:  ...(self.Eset_fp - alpha_fp* (q*v))
83  P:  ...(self.Ereset_fp - beta_fp * (abs(v)/L))
86  V:  ...(self.Ereset_fp - alpha_fp* (abs(q*v)))
87-88 P: def dU_dw(self): return self.U0*(4*w**3 - 6*w**2 + 2*w) + self.delta_E   (removed in V)
```

### 2.2 Equivalence proof

$$\alpha\,(qV) = \frac{\beta}{Lq}\,qV = \beta\,\frac{V}{L}, \qquad \alpha\,|qV| = \frac{\beta}{Lq}\,q|V| = \beta\,\frac{|V|}{L}\quad (q>0).$$

In the primary file, `abs(v/L)` (line 74) and `abs(v)/L` (line 83) are equal because L > 0. The value of q (1.6e-19 rather than 1.602176634e-19) cancels, so it has no effect.

**Numerical check (both files run end-to-end):** V and t are bitwise identical. The maximum relative difference is 4.9e-14 in `current`, 2.5e-14 in `current_fp`, 2.3e-12 in `state` and 1.3e-12 in `state_fp`. These differences come from rounding in the different operation order. **The two files show no behavioural difference.** The variant does not call `dU_dw`, and its only call site (primary line 101, variant line 103) is commented out, so removing the method breaks nothing.

### 2.3 Units of "alpha"

`alpha = beta/(L*q)` = **5.357e18** and `alpha_fp` = **5.0e18**. Units are not stated in the source. From the comment on line 21, β is in eV·m/V, so α is in eV·m/V / (m·C) = eV/J.

Read that way, α·(q·V[J]) gives eV, which is dimensionally consistent but awkward. **INFERENCE:** the quantity that has physical meaning for a slider called "alpha" is **α·q = β/L = 0.857 (eV per V)**, which is effectively dimensionless. It is the fraction of the applied potential energy qV that lowers the barrier. For the FP set the value is 0.800. A slider over raw α would need values of about 1e18.

---

## 3. Model overview

The file defines a class `MoTe2` (line 47). Its name suggests a MoTe2-based device (INFERENCE from the class name only). A single module-level loop (lines 97–137) advances two independent state variables, `w` (Emp) and `w_fp` (FP), under a common voltage waveform `V_signal`. At each time step, the loop:

1. computes the switching rate from the barrier-lowering law and the window;
2. applies a forward-Euler update and clips the result to [0, 1];
3. computes the HRS (Schottky) and LRS (metallic) currents for the instantaneous voltage;
4. blends them by the **updated** state w and stores |I|, with a floor of 1e-11.

After the loop, the script plots |I| against V for both models together with 60 hard-coded experimental points, then calls `show()` and `savefig()`.

---

## 4. Governing equations

### 4.1 State kinetics (primary lines 68–85)

The SET rate for V > v_off (lines 69–71, FP lines 78–80) is:

$$\frac{dw}{dt}=k_\text{att}\exp\!\left[-\frac{E_\text{set}-\beta\,V/L}{k_BT}\right](1-w)^{p_\text{set}}$$

The RESET rate for V < v_on (lines 72–74, FP lines 81–83) is:

$$\frac{dw}{dt}=-k_\text{att}\exp\!\left[-\frac{E_\text{reset}-\beta\,|V|/L}{k_BT}\right]w^{p_\text{reset}}$$

Otherwise (v_on ≤ V ≤ v_off, which is only V = 0 at the defaults), dw/dt = 0 (lines 75–76).

For the FP model, replace (β, E_set, E_reset) with (β_fp, E_set_fp, E_reset_fp). Both models share k_att, p_set, p_reset, k_B, T and L.

**Physical interpretation:**
- [SRC] The comments read "Field coupling constant (eV·m/V)" (line 21) and "Attempt frequency (Hz)" (line 22).
- **INFERENCE:** the law is a thermally activated (Arrhenius) hopping rate whose barrier E is lowered linearly by the electric field V/L. This is a standard ion- or defect-migration form, and β·V/L is the barrier lowering in eV.
- The window terms suppress SET as w → 1 and RESET as w → 0. In the source they are labelled only as `window`.

### 4.2 Discrete update (lines 98–117)

$$w_{n+1}=\mathrm{clip}\big(w_n+\dot w(V_n,w_n)\,\Delta t,\;0,\;1\big)$$

### 4.3 Current (lines 119–137)

$$n=\begin{cases}n_\text{set}&V\ge 0\\ n_\text{reset}&V<0\end{cases}\quad(\text{lines }120\text{–}123)$$

$$I_\text{sch}=I_s\left[\exp\!\left(\frac{|V|}{n\,v_t}\right)-1\right]\mathrm{sgn}(V)\quad(\text{line }126)$$

$$I_\text{met}=G_\text{met}V,\qquad G_\text{met}=N_\text{ch}\,G_0\quad(\text{lines }32,\,127)$$

$$I=(1-w_{n+1})\,I_\text{sch}+w_{n+1}\,I_\text{met}\quad(\text{line }130;\ \text{FP: line }135\text{ with }w_\text{fp})$$

$$I_\text{out}=\max(|I|,\,10^{-11})\quad(\text{lines }131,\,136)$$

**Interpretation:**
- [SRC] The comments label these "Schottky Parameters" (line 24), "Metallic Parameters" (line 30) and "Total current blending (HRS vs LRS)" (line 129). w = 0 is the "OFF State" (line 58).
- **INFERENCE:** n is an ideality factor. Its values (15–16.3) are far outside the range of an ideal Schottky diode, so it behaves as an empirical fitting factor. The product n·v_t = 0.423 V (V ≥ 0) or 0.390 V (V < 0) is the effective exponential voltage scale.
- n_set and n_reset are selected **by the sign of V, not by the switching process or the state**, despite their names.

### 4.4 Unused potential (primary lines 87–88, removed in the variant)

$$\frac{dU}{dw}=U_0(4w^3-6w^2+2w)+\Delta E$$

This is the derivative of $U_0\,w^2(1-w)^2+\Delta E\,w$, a double-well potential with minima at w = 0 and w = 1. That is a mathematical observation; the source gives no physical meaning. The only call site is the commented-out drift term on line 101. **It has no effect on the deterministic output.**

---

## 5. State variables and range enforcement

| Variable | Line | Meaning [SRC] | Range | Enforcement |
|---|---|---|---|---|
| `memristor.w` | 59, 108 | state of Emp model; 0 = "OFF State" (line 58) | [0, 1] | `np.clip(...,0,1)` (line 108) plus windows |
| `memristor.w_fp` | 60, 116 | state of FP model | [0, 1] | `np.clip` (line 116) plus windows |

The units of w are not stated. **INFERENCE:** it is a dimensionless filament or metallic-phase fraction, given the blend on line 130.

**How the range is actually reached (measured):**
- **Upper bound:** the clip at 1 is never reached. The maximum w is 0.9857 (Emp) and 0.9735 (FP). The window `(1-w)^9` gives algebraic saturation below 1, and it also bounds LRS current to about 0.986·G0·V rather than G0·V.
- **Lower bound:** RESET is **clip-terminated**. The unwindowed RESET rate·dt at −4 V is about 165, so a forward-Euler step overshoots below 0 and is clipped to exactly 0. Over the run, w = 0 in 11 875 of 40 000 steps (Emp) and 11 754 (FP).
- Because p_reset = 0.8 < 1, the continuous ODE also reaches 0 in finite time, since $w^{0.8}$ is non-Lipschitz at 0.

---

## 6. Parameter table

Classification: **Phys** = physical constant or physical device parameter; **Fit** = fitting or empirical parameter; **Num** = numerical or simulation-protocol parameter; **Unused** = defined but has no effect on outputs. Units in italics are INFERENCE (not stated in the source).

| Name | Line(s) | Value | Unit | Class | Notes |
|---|---|---|---|---|---|
| `k_B` | 13 | 8.617e-5 | eV/K [SRC] | Phys (constant) | |
| `T` | 14 | 300 | K [SRC] | Phys | Enters **only** the rate exponent. `vt` is not linked to T. |
| `G0` | 15 | 0.05e-2 = 5.0e-4 | *S* | Fit/Phys | Comment: "DP1 conductance"; "DP1" is undefined. Not the conductance quantum (7.75e-5 S); the value is 6.45 times larger. |
| `L` | 16 | 0.7e-9 | m [SRC: "0.7nm"] | Phys | "Device thickness". Appears only in the ratio β/L. |
| `q` (variant only) | V17 | 1.6e-19 | *C* | Phys (constant) | Rounded value; cancels out. |
| `Ea` | 19 | 2.0 | eV [SRC] | **Unused** | "Activation Energy". Never referenced. |
| `beta` | 20 | 0.6e-9 | eV·m/V [SRC] | Fit (Emp) | Field coupling; β/L = 0.857 |
| `beta_fp` | 21 | 0.56e-9 | *eV·m/V* | Fit/"ab initio" (FP) | β_fp/L = 0.800. Provenance not stated. |
| `alpha` (variant) | V23 | 5.357e18 | *eV/J* | Derived | = β/(L q); see §2.3 |
| `alpha_fp` (variant) | V24 | 5.0e18 | *eV/J* | Derived | |
| `k_attempt` | 22 | 6e12 | Hz [SRC] | Phys/Fit | Shared by both models |
| `Is` | 25 | 5.0e-9 | *A* | Fit | Schottky saturation current |
| `n_set` | 26 | 16.280 | dimensionless (*ideality*) | Fit | Used for V ≥ 0 |
| `n_reset` | 27 | 15 | dimensionless | Fit | Used for V < 0 |
| `vt` | 28 | 0.026 | *V* (thermal voltage) | Phys (hard-coded) | k_B·T = 0.025851 eV; a mismatch of 0.6 % that is not tied to T |
| `N_channels` | 31 | 1 | count (*inferred*) | Fit | Appears only as N·G0 |
| `G_metallic` | 32 | 5.0e-4 | *S* | Derived | |
| `freq` | 34 | 1e3 | *Hz* | Num (protocol) | |
| `num_cycles` | 35 | 40 | – | Num | |
| `pts_per_cycle` | 38 | 1000 | – | Num | See the dt caveat in §10 |
| `V_max` | 42 | 4 | *V* | Num (protocol) | |
| `v_off`, `v_on` | 50–51 | 0, 0 | *V* | Fit (thresholds) | Polarity gates only; no real threshold |
| `Eset` / `Ereset` | 52–53 | 3.1 / 3.7 | *eV* | Fit (Emp) | |
| `Eset_fp` / `Ereset_fp` | 54–55 | 3.0 / 3.5 | *eV* | FP ("Ab inito") | |
| `w_init` | 58 | 0 | – | Initial condition | |
| `p_set` | 61 | 9 | – | Fit | SET window exponent |
| `p_reset` | 62 | 0.8 | – | Fit | RESET window exponent |
| `U0`, `delta_E` | 63–64 | 10.0, 0.0 | *eV?* | **Unused** (stochastic) | Used only by `dU_dw` |
| `eta`, `sigma` | 65–66 | 1.0, 5 | – | **Unused** for output | Feed `diffusion_stoch` (line 102), which is discarded |
| current floor | 131, 136 | 1e-11 | *A* | Num (display) | Hard-coded |
| `t` grid | 40 | linspace(0, 0.04, 40000) | *s* | Num | dt = 1.0000250006e-6 |

---

## 7. SET and RESET mechanisms

- **SET (V > 0, w ↑):** the barrier E_set is lowered by β·V/L. The rate grows by e-fold for every k_BT·L/β = 30.2 mV of voltage, so the transition behaves like a sharp threshold. **Measured (Emp):** w crosses 0.5 at V = +3.22 V on the rising branch and saturates at 0.986 by the 4 V peak. Windowing with p_set = 9 makes the approach to 1 slow; this is visible as the rounded top of the SET jump.
- **RESET (V < 0, w ↓):** the mechanism has the same form, with E_reset = 3.7 eV and window w^0.8. **Measured (Emp):** w crosses 0.5 at −3.80 V on the falling branch, and the clip drives it to 0 near the peak.
- **Approximate analytic threshold** (my reduction, not in the source): $V_\text{sw}\approx (L/\beta)\,[E - \Delta]$. Fitting to the simulation gives Δ ≈ 0.34 eV for SET and 0.45 eV for RESET. Δ is of order $k_BT\ln(k_\text{att}\tau)$, where τ is the time the sweep spends near threshold, so it depends on k_att/freq and on the window. Consequences:
  - dV_set/dE_set ≈ L/β = 1.17 V/eV, confirmed numerically (§14).
  - dV_sw/dlog10(k_att) ≈ −k_BT·ln(10)·L/β ≈ −0.07 V per decade, confirmed.
- **Cycle-to-cycle:** after the first RESET, w = 0 exactly, so the response is periodic from cycle 1 onward. w_init only affects the first SET; with w_init = 1 the cycle-2 metrics are identical to baseline.

---

## 8. I–V relationship

- **HRS (w ≈ 0):** Schottky-like exp(|V|/(n·v_t)), with an effective scale of 0.423 V (positive) or 0.390 V (negative). It is not symmetric because n_set ≠ n_reset. Measured: I(+1 V) = 4.81e-8 A and I(−1 V) = 6.00e-8 A.
- **LRS (w ≈ 0.986):** ohmic, I ≈ 0.986·G0·V plus 0.014·I_sch. Measured: I(+1 V) = 4.93e-4 A.
- **The blend is linear in current**, not a parallel or series combination of conductances. I_sch and I_met are computed for every V independent of state and then mixed (line 130).
- **The output is |I| with a floor of 1e-11 A.** The sign is discarded, so the stored arrays cannot give signed current.
- **The Schottky term can exceed the metallic term.** With n_set ×0.5 at V ≈ 3 V, I_sch > G0·V, so the HRS branch rises above the LRS branch before SET (see `figures/deterministic_sensitivity.png`, panel n_set).

---

## 9. Initial conditions

- w = w_fp = `w_init` = 0, the "OFF State" (lines 58–60).
- V(0) = 0, since the waveform is a sine that starts at 0.
- There is no initial current or other state.

---

## 10. Numerical method

- **Scheme:** explicit forward Euler with a fixed step (lines 98–99 and 112–113), followed by clipping. The rate uses w_n; the current uses w_{n+1}.
- **Waveform:** `V = 4·sin(2π·1000·t)`, 40 cycles, `t = np.linspace(0, 0.04, 40000)` (line 40). The endpoint is included, so **dt = 1.0000250006e-6 s and the grid holds 999.975 points per period, not "exactly 1000 pts per cycle"** as the comment on line 37 claims. Sampling phase drifts slowly from cycle to cycle. Slicing per cycle by 1000 samples is therefore slightly misaligned, and the measured V_SET jitters by about ±0.001–0.008 V between cycles. That jitter is a sampling artefact, not physics.
- **Voltage resolution:** near 3.2 V, dV per step ≈ 2π·f·V_max·cos(·)·dt ≈ 0.015 V. This bounds how precisely a switching voltage can be read off the grid.
- **RNG side effect:** `np.random.normal(0,1)` is called on every step (line 102), with no seed, and the result is discarded. It does not affect output, but it advances the global RNG.

**Time-step convergence** (4 cycles; metrics from cycle 2; Emp / FP):

| pts_per_cycle | dt (µs) | Emp V_SET | Emp V_RESET | Emp w_max | ON/OFF | FP V_SET | FP V_RESET |
|---|---|---|---|---|---|---|---|
| 250 | 4.0 | 3.224 | −3.786 | 0.98589 | 1.0204e4 | 3.282 | −3.817 |
| 500 | 2.0 | 3.215 | −3.795 | 0.98576 | 1.0240e4 | 3.302 | −3.811 |
| **1000 (default)** | **1.0** | 3.226 | −3.792 | 0.98570 | 1.0248e4 | 3.326 | −3.808 |
| 2000 | 0.5 | 3.223 | −3.794 | 0.98567 | 1.0248e4 | 3.324 | −3.810 |
| 8000 | 0.125 | 3.229 | −3.794 | 0.98564 | 1.0248e4 | 3.330 | −3.810 |
| 16000 | 0.0625 | 3.229 | −3.794 | 0.98564 | 1.0248e4 | 3.331 | −3.811 |

**Conclusion:** at the default dt, the results agree with a 16× finer grid to within about 3 mV for Emp and 5 mV for FP in switching voltage, and 6e-5 in w_max. That is below the grid's voltage resolution. dt-dependence is negligible at baseline. Pushing parameters toward faster switching (larger β, k_att or V_max) increases the Euler overshoot. RESET already relies on clipping, so the clip, not the ODE, sets the endpoint.

---

## 11. Variants: "Emperical" versus `_fp` ("Ab inito")

| | Emp (`beta`, `Eset`, `Ereset`) | FP (`beta_fp`, `Eset_fp`, `Ereset_fp`) |
|---|---|---|
| Plot label [SRC lines 264–265] | "Emperical Model" | "Ab inito Model" |
| β (eV·m/V) / β/L | 0.6e-9 / 0.857 | 0.56e-9 / 0.800 |
| E_set / E_reset (eV) | 3.1 / 3.7 | 3.0 / 3.5 |
| Shared | k_att, p_set, p_reset, T, L, all conduction parameters | same |
| V_SET / V_RESET (measured) | +3.22 / −3.80 V | +3.32 / −3.81 V |
| w_max / ON/OFF(+1 V) | 0.9857 / 1.025e4 | 0.9735 / 1.012e4 |

The I–V curves of the two models differ only through w(t), because the conduction model is identical. The source does not say how the `_fp` values were obtained. **INFERENCE:** "fp" stands for "first-principles", which matches the label "Ab inito". This contradicts any reading of `_fp` as "free parameter".

---

## 12. Calibration

The code has **no fitting or optimisation routine**. All parameters are hard-coded. Experimental reference data are embedded as `x_exp` and `y_exp` (lines 143–262; 60 points; V from −3.997 to +3.479; I from 1.3e-11 to 3.18e-3). Units, device, sweep rate and provenance are not stated. **INFERENCE:** the data are in V and A, and the parameters were tuned by hand against this curve.

My own branch-matched comparison, which is not in the source, assigns each experimental point to its sweep quarter. The log10 RMS error is **1.10 decades for Emp and 1.09 for FP**; per branch it is 1.04, 1.14, 1.29 and 0.51. Discrepancies are visible in `figures/deterministic_iv_baseline.png`:
- The experimental positive sweep peaks at 3.48 V, whereas the simulation uses V_max = 4 V.
- In the data, SET completes on the **down-sweep** from the peak (I rises from 1.2e-5 A at 3.48 V to 8.2e-4 A at 2.82 V). The model sets on the up-sweep at 3.22 V.
- The experimental LRS is strongly non-ohmic near 0 V (it falls to about 1e-8 A), whereas the model LRS is ohmic.

---

## 13. Dependencies and outputs

**Dependencies:** `numpy`, `sys`, `matplotlib.pyplot`, and `matplotlib.ticker` (LogLocator, AutoMinorLocator; imported mid-script at line 279). `np.set_printoptions(threshold=sys.maxsize)` is set globally (line 3) but nothing is printed.

**Outputs:**
- Python lists that become arrays: `current`, `current_fp` (40000,), floored |I|. `state` and `state_fp` remain lists of length 40000.
- A figure (10 × 6.8 in) showing semilog |I| against V for both models plus the experimental markers. It has no axis labels, and **`plt.legend()` is never called, so the label strings are never displayed**.
- `plt.show()` (line 289) runs **before** `plt.savefig(..., dpi=900)` (line 290). With an interactive backend, the saved file is typically blank once the window is closed. With Agg it worked and produced a 9000 × 6120 px PNG (885 kB).

**Measured numbers** (full 40-cycle run; first cycle, cycle 2 and cycle 40 shown):

| Model | cycle | V_SET (w = 0.5) | V_RESET | w_max | I_HRS(+1 V) | I_LRS(+1 V) | ON/OFF | I_HRS(−1 V) |
|---|---|---|---|---|---|---|---|---|
| Emp | 1 | 3.2213 | −3.7965 | 0.9857 | 4.81e-8 | 4.929e-4 | 1.0246e4 | 5.997e-8 |
| Emp | 2 | 3.2217 | −3.7967 | 0.9857 | 4.81e-8 | 4.929e-4 | 1.0246e4 | 5.997e-8 |
| Emp | 40 | 3.2209 | −3.7963 | 0.9857 | 4.81e-8 | 4.929e-4 | 1.0246e4 | 5.997e-8 |
| FP | 1 | 3.3224 | −3.8121 | 0.9735 | 4.81e-8 | 4.867e-4 | 1.0119e4 | 5.997e-8 |
| FP | 40 | 3.3221 | −3.8119 | 0.9735 | 4.81e-8 | 4.867e-4 | 1.0119e4 | 5.997e-8 |

The overall |I| range is [1.0e-11, 1.970e-3] A for Emp and [1.0e-11, 1.945e-3] A for FP.

Figures:
- `figures/deterministic_iv_baseline.png`: semilog I–V for both models plus the experimental data, cycle 2.
- `figures/deterministic_state.png`: w(V) for both models.
- `figures/deterministic_sensitivity.png`: one-at-a-time sensitivity, nine panels.

---

## 14. Parameter influence on hysteresis

Method: change one parameter at a time, re-simulate the full 40-cycle protocol, and measure on cycle 2. V_SET and V_RESET are where w crosses 0.5. ON/OFF is I_LRS/I_HRS at +1 V, where HRS is read on the rising branch and LRS on the falling branch. Baseline (Emp): V_SET 3.222, V_RESET −3.797, w_max 0.9857, I_HRS(+1) 4.81e-8, I_LRS(+1) 4.93e-4, ON/OFF 1.025e4, I_HRS(−1) 6.00e-8. "No RESET" means that w never falls below 0.5 in the cycle.

| Parameter | Change | V_SET | V_RESET | I_HRS(+1 V) | I_LRS(+1 V) | ON/OFF | Effect, from the equations and confirmed numerically |
|---|---|---|---|---|---|---|---|
| **k_attempt** | ×0.1 / ×0.5 / ×2 / ×10 | 3.295 / 3.236 / 3.207 / 3.146 | −3.855 / −3.812 / −3.772 / −3.729 | – | ±0.5 % | ±0.3 % | Shifts both switching voltages by about −0.07 V per decade (∝ k_BT·L/β·ln k). Only k_att/freq matters: k ×10 gives results identical to freq ×0.1. |
| **beta** (≡ "alpha"·q·L) | ×0.5 | no SET | no RESET | – | – | 1.0 | With β·V_max/L = 1.71 eV ≪ E_set, the device never switches. |
| | ×0.9 | (no full SET in cycle 2) | **no RESET** | 4.58e-4 | 4.64e-4 | 1.01 | SET accumulates over cycles but RESET is out of reach, so the device is **stuck in LRS** (w ≈ 0.92). |
| | ×1.1 | 2.934 | −3.456 | – | 4.99e-4 | 1.04e4 | V_sw ∝ 1/β (3.222/1.1 = 2.93) |
| | ×2 | 1.612 | −1.928 | – | 5.00e-4 | 1.04e4 | Both voltages halve; w_max → 1.000 |
| **L** | ×0.9 / ×1.1 | 2.899 / stuck | −3.431 / no RESET | | | | Exactly the inverse of β, because only β/L appears |
| **Eset** | ×0.9 / ×0.98 / ×1.02 / ×1.1 | 2.864 / 3.146 / 3.295 / 3.576 | ≈ unchanged | – | 4.98 / 4.95 / 4.90 / 4.68 e-4 | ≈1.03 / 1.03 / 1.02 / 0.97 e4 | dV_SET/dE_set ≈ L/β = 1.17 V/eV. A higher E_set lowers w_max, and with it LRS current, because SET completes closer to the peak. |
| **Ereset** | ×0.9 / ×0.98 / ×1.02 | – | −3.378 / −3.710 / −3.875 | – | – | – | dV_RESET/dE_reset ≈ 1.17 V/eV |
| | ×1.1 | – | **no RESET** | 4.91e-4 | 4.93e-4 | 1.00 | (E_r − Δ)·L/β > 4 V, so the device is stuck in LRS. **This is the most fragile parameter.** |
| **Eset_fp / Ereset_fp** | ×0.98 / ×1.02 | FP: 3.251 / 3.391 | FP: −3.729 / −3.893 | | | | Same behaviour; affects only the FP curve |
| **beta_fp** | ×0.9 / ×1.1 | FP: stuck / 3.034 | FP: none / −3.481 | | | | Same behaviour as β, on the FP curve only |
| **p_set** | ×0.5 (4.5) / ×2 (18) | 3.146 / 3.391 | −3.797 / −3.789 | – | 5.00e-4 / 4.35e-4 | 1.04e4 / 9.05e3 | A larger p_set slows SET (rounder, later jump) and lowers w_max (0.9999 / 0.870), and therefore LRS current |
| **p_reset** | ×0.5 (0.4) / ×2 (1.6) | – | −3.789 / −3.797 | – / 4.87e-8 | – | – / 1.01e4 | Weak effect: RESET is driven by the exponential and ended by the clip. With 1.6 the tail is slower and leaves a small residual w. |
| **n_set** | ×0.5 / ×2 | unchanged | unchanged | 5.59e-7 / 1.13e-8 | – | 881 / 4.36e4 | Changes only the positive HRS branch (exponential slope). It does **not** affect SET kinetics, despite the name. |
| **n_reset** | ×0.5 / ×2 | unchanged | unchanged | – | – | – | Only the negative HRS branch: I_HRS(−1 V) = 8.40e-7 / 1.30e-8 |
| **vt** | ×0.5 / ×2 | unchanged | unchanged | 5.59e-7 / 1.13e-8 | – | 881 / 4.36e4 | Identical to scaling n_set and n_reset together; not tied to T |
| **Is** | ×0.5 / ×2 | unchanged | unchanged | 2.41e-8 / 9.62e-8 | – | 2.05e4 / 5.12e3 | Moves both HRS branches up or down rigidly on a log scale; ON/OFF ∝ 1/Is |
| **G0** (the user's "Go") | ×0.5 / ×2 | unchanged | unchanged | – | 2.46e-4 / 9.86e-4 | 5.12e3 / 2.05e4 | Moves the LRS branch rigidly; ON/OFF ∝ G0 |
| **N_channels** | ×2 | unchanged | unchanged | – | 9.86e-4 | 2.05e4 | Identical to G0 ×2 |
| **T** | ×0.9 / ×1.1 | 3.266 / 3.176 | −3.841 / −3.738 | – | – | – | Only through k_BT in the rate (the Δ term). It does **not** change the Schottky current, because vt is hard-coded. |
| **V_max** (protocol) | ×0.9 (3.6 V) | (stuck) | **no RESET** | 4.58e-4 | 4.64e-4 | 1.01 | The peak is below the RESET threshold, so the device is stuck in LRS |
| | ×1.1 (4.4 V) | 3.227 | −3.802 | – | 4.99e-4 | 1.04e4 | Thresholds are almost unchanged; w_max rises to 0.997 |
| **freq** (protocol) | ×0.1 / ×10 | 3.146 / 3.295 | −3.729 / −3.855 | – | – | – | Exactly equivalent to k_att ×10 / ×0.1 |
| **v_off / v_on** | 0.5 / −0.5 V | unchanged | unchanged | | | | They gate polarity only. Switching occurs above 3 V, so shifts below about 3 V have no effect. |
| **w_init** | 1 | unchanged (cycle 2) | unchanged | | | | Memory is erased by the first RESET |
| Ea, U0, delta_E, eta, sigma | – | – | – | – | – | – | **No effect** on the deterministic output (unused) |

**Names from the requested list that do not exist as written:**
- **"alpha"** exists only in the variant. In the primary, the closest quantity is `beta` (α = β/(Lq)).
- **"Go"** does not exist; the code has `G0` (and `G_metallic = N_channels*G0`).

All other listed names exist.

**Parameter degeneracies.** The output depends on parameters only through these combinations:
- β/L
- k_att/freq
- n_set·vt and n_reset·vt
- N_channels·G0
- (E − k_BT ln(k_att/f))·L/β, which, together with the windows, sets each switching voltage

---

## 15. Numerical robustness

- **Overflow leading to NaN.** If the rate exponent exceeds about 709, `np.exp` overflows to inf. Multiplied by a window of exactly 0 (w = 0 in RESET, or w = 1 in SET), the result is `inf*0 = NaN`. `np.clip(NaN)` returns NaN, and **the state stays NaN permanently**. Reproduced with:
  - β ×10
  - V_max = 30 V
  - T = 5 K

  NumPy warns ("overflow encountered in exp", "invalid value"), but the script does not stop. β ×6 still runs, giving V_SET = 0.53 V. The threshold for |V| is roughly (E + 709·k_BT)·L/β ≈ 25 V at baseline.
- **Schottky overflow.** n_set = 0.2 gives `I_sch = inf` and Imax = inf. The guard condition is |V|/(n·vt) < 709.
- **RESET is clip-terminated**, as described in §5. The endpoint does not depend on dt, but the trajectory near the end does.
- **Narrow RESET margin.** Baseline RESET occurs at −3.80 V against a −4 V peak. A 10 % change in the unfavourable direction in V_max, β, L or E_reset gives a device stuck in LRS. A 7 % reduction in β (β/L = 0.797) is already enough. Lowering T to 150 K also stops RESET: the barrier-lowering offset Δ ∝ k_BT shrinks, which pushes the threshold toward E_reset·L/β = 4.32 V.
- **Window exponent p_reset < 1.** dw/dt is not Lipschitz at w = 0. This is harmless here because of the clip, but higher-order integrators may struggle.
- **Grid/period mismatch** (999.975 points per period) causes small cycle-to-cycle jitter in extracted metrics.
- **dt convergence:** confirmed at baseline (§10).

---

## 16. Issues and uncertainties

1. Units for G0, Is, vt, freq and V_max are not stated in the source. INFERENCE: S, A, V, Hz, V. "DP1" (line 15) is undefined.
2. The meaning of `_fp` is not stated. The plot labels it "Ab inito", which suggests first-principles; provenance of β_fp, E_set_fp and E_reset_fp is not given. The provenance of the Emp values is also not given.
3. `Ea = 2.0` (line 19) is defined and never used. Its relationship to E_set and E_reset is unclear.
4. `vt = 0.026` is hard-coded and not derived from T. Changing T in a GUI would leave the conduction model at 300 K.
5. `n_set` and `n_reset` are chosen by polarity, not by switching state. Whether this is intended is unknown.
6. Values of n near 15–16 are physically unusual for a Schottky ideality factor. The source does not interpret them.
7. Comment on line 37: "exactly 1000 pts per cycle" is false, because of the endpoint-inclusive `linspace`.
8. Unused code:
   - `dU_dw`, `U0`, `delta_E`, `eta`, `sigma`, `diffusion_stoch`, `dw_stoch`, `N_channels` (= 1)
   - an unseeded RNG call on every step
   - commented lines 44, 101 and 106
9. Plotting:
   - `show()` is called before `savefig()`.
   - There is no `legend()` call and no axis labels.
   - The labels contain typos ("Emperical", "Ab inito").
   - 900 dpi is excessive.
   - The import on line 279 is mid-file.
   - `set_printoptions` is set globally.
10. Experimental data: provenance, units, device and sweep rate are not stated. Its V_max (3.48 V on the positive side) differs from the simulated 4 V.
11. The model's LRS is ohmic while the data's LRS is strongly nonlinear. The model sets on the up-sweep while the data set on the down-sweep. The overall fit error is about 1.1 decades RMS.
12. Output is |I| only; the sign is lost. The floor of 1e-11 is hard-coded.
13. The primary and variant files are equivalent (§2). Which one is authoritative for naming ("beta" or "alpha") is a question for the author.

---

## 17. Implications for website implementation

- **Refactor needed.** The class methods read module-level globals (`k_attempt`, `beta`, `L`, `k_B`, `T`) and the simulation runs at import time. Wrap it as `simulate(params) -> {V, I, I_fp, w, w_fp}`. A faithful refactor, bitwise identical to the primary output, was built and verified at `/tmp/claude-0/-home-claude/7b3d0c97-9349-5b14-a515-ca80f50bbf65/scratchpad/agent1/model.py`.
- **Performance.** The loop is inherently sequential because the state carries over between steps, so it cannot be vectorised in time. Pure Python takes 0.38 s for 2 × 40 000 steps. In JavaScript this would take milliseconds, so client-side simulation is feasible. Because the response is periodic after cycle 1, **simulating 2–3 cycles is enough for display**; the 40-cycle default adds nothing deterministic.
- **The "alpha" slider.** Expose α·q = β/L, about 0.857 (Emp) or 0.800 (FP), in eV/V, rather than raw α ≈ 5e18. Mapping back to the source is β = (slider value)·L. The equivalence proof in §2 guarantees fidelity to both files.
- **Remove redundant sliders**, using the degeneracies in §14. L and β are not independent; neither are k_att and freq, n and vt, or N_channels and G0.
- **Safe slider ranges** (single-parameter, at baseline). Outside these, the device fails to switch, gets stuck in LRS, or produces NaN:

  | Parameter | Tested boundary |
  |---|---|
  | β/L (Emp) | works at 0.814 (β ×0.95); stuck at 0.797 (β ×0.93); works up to at least 5.1 (β ×6); NaN at β ×10 |
  | E_reset | works at 3.80 eV (V_RESET −3.90 V); stuck at 4.07 eV (×1.1) |
  | V_max | works at 3.8 V; stuck at 3.6 V |
  | T | works at 200 K (V_RESET −3.96 V); stuck in LRS at 150 K; NaN at 5 K |

  Guard against NaN by clamping the exponent argument, for example `min(arg, 700)`, or by checking `isfinite`. Note that a clamp alters behaviour only in regimes where the original returns NaN. Alternatively, warn the user when RESET does not occur.
- **Display.** Show |I| on a log axis using the 1e-11 floor, to match the source. If signed current is wanted, that would be a deviation from the source and should be labelled as such.
- **Keep both parameter sets** (Emp and FP) and the embedded experimental points, labelled as in the source, but with corrected spelling flagged as an editorial change.
- **Coupling to T.** If T becomes a slider, decide (or ask the author) whether vt should follow k_BT/q. The source does not couple them.
