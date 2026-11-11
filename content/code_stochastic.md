# Stochastic Python code

> **Documentation only.** This code is shown for reference. The stochastic curves are **not** simulated on this website. The descriptions below are transcribed from the code and are for the author to review.

{{toc}}

## Summary

| | |
|---|---|
| **File** | `original_code/stochastic.py` |
| **Language / dependencies** | Python 3; `numpy`, `matplotlib` |
| **What it computes** | I–V cycling of the empirical model with an added random (Wiener) term in the state variable over 50 cycles, then cycle-to-cycle statistics of $V_\mathrm{SET}$, $V_\mathrm{RESET}$, HRS and LRS |
| **Integration** | Euler–Maruyama: deterministic Euler step plus a Gaussian increment $\propto\sqrt{\Delta t}$ |
| **Random seed** | not set, so results differ on every run |
| **Output** | 2×2 figure: I–V curve, $V_\mathrm{SET}$ histogram, $V_\mathrm{RESET}$ histogram, HRS/LRS at 0.3 V against cycle number. Printed mean and standard deviation of $V_\mathrm{SET}$ and $V_\mathrm{RESET}$ |

## Parameters used in the code

Values are as written in `stochastic.py`. Units are *to be added* unless the source states them; this file has no unit comments. Shared values are identical to the deterministic code unless marked **different**.

| Name | Value | Line | Role |
|---|---|---|---|
| `k_B` | 8.617e-5 | 9 | Boltzmann constant |
| `T` | 300 | 10 | temperature |
| `G0` | 0.05e-2 | 11 | metallic conductance ($G_\mathrm{metallic} = N_\mathrm{channels}\,G_0$, line 28) |
| `L` | 0.7e-9 | 12 | thickness, used as $\beta V/L$ |
| `Ea` | 2.0 | 15 | not used |
| `beta` | 0.6e-9 | 16 | field coupling (empirical) |
| `beta_fp` | 0.56e-9 | 17 | field coupling (ab initio); used only in `dw_dt_deterministic_fp`, which is never called |
| `k_attempt` | 6e12 | 18 | attempt frequency |
| `Is` | 5.0e-9 | 21 | Schottky saturation current |
| `n_set`, `n_reset` | 16.280, 15 | 22–23 | ideality factors (V ≥ 0 / V < 0) |
| `vt` | 0.026 | 24 | thermal voltage (fixed) |
| `N_channels` | 1 | 27 | |
| `freq` | 1e3 | 31 | sweep frequency |
| `num_cycles` | **50** (deterministic: 40) | 32 | number of cycles |
| `pts_per_cycle` | 1000 | 33 | |
| `V_max` | 4 | 37 | sweep amplitude |
| `v_off`, `v_on` | 0, 0 | 43–44 | polarity thresholds |
| `Eset`, `Ereset` | 3.1, 3.7 | 45–46 | activation energies (empirical) |
| `Eset_fp`, `Ereset_fp` | 3.0, 3.5 | 47–48 | defined; the `_fp` rate is never called |
| `w_init` | 0 | 50 | initial state |
| `p_set`, `p_reset` | 9, 0.8 | 55–56 | window exponents |
| `U0` | 10.0 | 57 | used only in `dU_dw`, which is never called |
| `delta_E` | 0.0 | 58 | used only in `dU_dw` |
| `eta` | 1.0 | 59 | divides the noise amplitude |
| `sigma` | **1** (deterministic file: 5, unused there) | 60 | noise amplitude |
| `w_det` cap | **0.90** | 96 | upper clip of the deterministic part of the state |
| `V_read` | 0.3 | 135 | read voltage for HRS/LRS |
| Extraction window | 2.5 – 3.7 | 165 | voltage window searched for $V_\mathrm{SET}$ |

## Key equations (with code lines)

**Deterministic rate** (lines 62–70). This file uses the original $\beta V/L$ form, which equals $\alpha q V$ with $\alpha = \beta/(Lq)$:

$$
\dot w_\mathrm{det} = \begin{cases}
k_\mathrm{attempt}\, e^{-(E_\mathrm{set} - \beta V/L)/k_BT}\,(1-w)^{p_\mathrm{set}}, & V > v_\mathrm{off}\\
-k_\mathrm{attempt}\, e^{-(E_\mathrm{reset} - \beta |V|/L)/k_BT}\, w^{p_\mathrm{reset}}, & V < v_\mathrm{on}\\
0 & \text{otherwise}
\end{cases}
$$

The window uses the **total** state $w$.

**State update** (lines 90–108). The deterministic and stochastic parts are integrated separately and then summed:

$$
w_\mathrm{det} \leftarrow \operatorname{clip}\big(w_\mathrm{det} + \dot w_\mathrm{det}\Delta t,\ 0,\ 0.90\big),
\qquad
w_\mathrm{stoch} \leftarrow w_\mathrm{stoch} + \frac{\sigma}{\eta}\,\xi\,\sqrt{\Delta t},\quad \xi\sim\mathcal N(0,1)
$$

$$
w = w_\mathrm{det} + w_\mathrm{stoch}, \quad\text{limited to } [0,1]
$$

At a limit, $w_\mathrm{stoch}$ is reset so that the sum equals the limit (lines 101–106).

**Current** (lines 110–120): the same Schottky/metallic blend as the deterministic model. The signed current is stored, with no $10^{-11}$ floor (the floor lines are commented out):

$$
I = (1-w)\,I_s\big(e^{|V|/(n v_t)}-1\big)\operatorname{sgn}V + w\,G_0 V
$$

**Potential gradient, defined but not used** (lines 82–83):

$$
\frac{dU}{dw} = U_0\,(4w^3 - 6w^2 + 2w) + \Delta E
$$

Mathematically this is the derivative of $U_0\,w^2(1-w)^2 + \Delta E\,w$, a double-well form. The drift term that would use it does not appear in this file (in the deterministic file it is commented out).

**Cycle metrics** (lines 137–188), computed for each cycle $k$ on the quarter-periods:

| Metric | How it is computed (as coded) |
|---|---|
| $V_\mathrm{SET}$ | In the first quarter ($V$ rising, $V>0.1$): the $V$ that maximises $d\log_{10}I/dV$ within $2.5 \le V \le 3.7$ |
| $V_\mathrm{RESET}$ | In the third quarter: $V$ at the maximum of the signed current `argmax(i_q3)` |
| HRS | $V/I$ at the point nearest $V_\mathrm{read} = 0.3$ in the first quarter |
| LRS | $V/I$ at the point nearest $V_\mathrm{read} = 0.3$ in the second quarter |

## Additional notes for the author to check

- **Unused `_fp` path:** `current_fp` uses `w_fp`, which is never updated (it stays 0), so the "ab initio" current here is the pure HRS curve. It is computed but not plotted.
- **$V_\mathrm{RESET}$ definition:** in the third quarter the current is negative. `argmax` therefore selects the current closest to zero, not the largest-magnitude current. Please confirm this is the intended definition (a possible alternative is `argmin` or `argmax(abs(i_q3))`).
- **Noise only on the total state:** the noise acts on $w_\mathrm{stoch}$, which is not bounded by the 0.90 cap, so the total $w$ can still reach 1.
- **Linear current axis:** the I–V panel uses `ax1.plot` (linear axis) with a `LogLocator` on y. A semilog view would need `ax1.semilogy` with $|I|$.
- **Cycle slicing:** the grid has 999.975 points per period, as in the deterministic code, so slicing every 1000 points drifts slightly over 50 cycles.
- **Escape sequence:** `"Resistance ($\Omega$)"` (line 251) is not a raw string; newer Python versions warn about the escape sequence.

## Source code

{{code src="original_code/stochastic.py" lang="python" title="original_code/stochastic.py (original, read-only)"}}
