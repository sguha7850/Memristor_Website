# Model & Equations

{{toc}}

> **Status of this page.** The equations below are transcribed directly from the source code (`Luisier_IOP_deterministic.py`), with line numbers. Physical interpretations are marked *interpretation*; they are draft text for the author to confirm or correct. Units are shown only where the source states them.

## Overview

The device is described by a single internal state variable $w \in [0, 1]$:

| State | $w$ | Description |
|---|---|---|
| OFF | $w = 0$ | "OFF State" in the code (line 61); "Semiconducting" in the Verilog-A comment. High-resistance state (HRS). |
| ON | $w = 1$ | Low-resistance, metallic conduction. Low-resistance state (LRS). |

- **Switching:** $w$ changes through thermally activated SET and RESET transitions. Each transition has an activation energy that the applied voltage lowers.
- **Current:** a linear blend of a Schottky-type (OFF) term and a metallic (ON) term, weighted by $w$.

Two parameter sets of the same model are provided:

| Variant | Code names | Origin of values |
|---|---|---|
| Empirical | `alpha`, `Eset`, `Ereset` | Manual fit to the experimental I–V data |
| Ab initio (first principles) | `alpha_fp`, `Eset_fp`, `Ereset_fp` | $E_\mathrm{set}$, $E_\mathrm{reset}$ from reference papers *(references to be added)*; $\alpha_\mathrm{fp}$ (via $\beta_\mathrm{fp}$) calibrated to the experimental data |

All other parameters are shared.

## Governing equations

### 1. Applied voltage (stimulus)

The applied voltage is a sinusoidal sweep (lines 43–48):

$$
V(t) = V_{\max}\,\sin(2\pi f t), \qquad t_i = \frac{i}{N-1}\,\frac{N_\mathrm{cyc}}{f},\quad i = 0,\dots,N-1,\quad N = N_\mathrm{cyc}\,N_\mathrm{pts}
$$

The time step is $\Delta t = t_1 - t_0$. The default values are $V_{\max}=4$, $f=10^3$, $N_\mathrm{cyc}=40$ and $N_\mathrm{pts}=1000$.

### 2. State kinetics: SET and RESET

The state rate has three regimes, selected by the sign of the voltage (lines 71–79):

$$
\frac{dw}{dt} =
\begin{cases}
\;\;\,k_\mathrm{attempt}\,\exp\!\left[-\dfrac{E_\mathrm{set} - \alpha\, q\, V}{k_B T}\right](1-w)^{p_\mathrm{set}}, & V > v_\mathrm{off} \quad \text{(SET)}\\[2ex]
-\,k_\mathrm{attempt}\,\exp\!\left[-\dfrac{E_\mathrm{reset} - \alpha\, q\, |V|}{k_B T}\right] w^{\,p_\mathrm{reset}}, & V < v_\mathrm{on} \quad \text{(RESET)}\\[2ex]
\;\;\,0, & \text{otherwise}
\end{cases}
$$

- **Ab initio variant:** the same expressions, with $\alpha \to \alpha_\mathrm{fp}$, $E_\mathrm{set} \to E_\mathrm{set,fp}$ and $E_\mathrm{reset} \to E_\mathrm{reset,fp}$ (lines 80–88).
- **Definition of $\alpha$:** in the original, $\alpha = \beta/(L\,q)$ (lines 23–24). On this website $\alpha$ is set directly, and its default is that same value.

*Interpretation (to be confirmed):*
- The rate has an Arrhenius form. The term $\alpha q |V|$ lowers the activation barrier linearly with the applied voltage.
- The factors $(1-w)^{p_\mathrm{set}}$ and $w^{p_\mathrm{reset}}$ are window functions. They slow the transition as $w$ approaches its limit.
- $p_\mathrm{set}$ and $p_\mathrm{reset}$ are fitted parameters (author).

### 3. Time integration

Explicit (forward) Euler with a fixed step, followed by clipping (lines 99–118):

$$
w_{i} = \operatorname{clip}\!\Big(w_{i-1} + \dot w\big(V_i,\, w_{i-1}\big)\,\Delta t,\; 0,\; 1\Big), \qquad w_{-1} = w_\mathrm{init} = 0
$$

The rate uses the previous state $w_{i-1}$. The current at step $i$ uses the updated state $w_i$.

### 4. Current

The Schottky term uses an ideality factor chosen by the sign of the voltage (lines 121–128):

$$
I_\mathrm{sch} = I_s\left[\exp\!\left(\frac{|V|}{n\, v_t}\right) - 1\right]\operatorname{sgn}(V),
\qquad
n = \begin{cases} n_\mathrm{set}, & V \ge 0\\ n_\mathrm{reset}, & V < 0\end{cases}
$$

The metallic term and the total current are (lines 129–132):

$$
I_\mathrm{met} = G_0\, V, \qquad I = (1-w)\,I_\mathrm{sch} + w\, I_\mathrm{met}
$$

**Plotting:** the plotted quantity (line 133) is $\max(|I|,\ I_\mathrm{floor})$, with $I_\mathrm{floor} = 10^{-11}$. This floor is for visualisation only; it is not physical (author).

**Fixed $v_t$:** $v_t = 0.026$ is fixed in the code and does not follow $T$ (author decision: temperature is not varied).

## Parameters

The table is generated from `config/model_config.json`, the same file that drives the sliders. Units marked *to be added* are not stated in the source code.

{{param-table}}

**Variables in the original code that do not enter the deterministic result.** These are omitted on the website:

| Variable | Line(s) | Status |
|---|---|---|
| `Ea = 2.0` | 20 | defined, never used |
| `beta`, `beta_fp`, `L` | 16, 21–22 | used only to compute the default $\alpha = \beta/(Lq)$ |
| `N_channels = 1` | 34 | ignored; $G_0$ used directly (author) |
| `U0`, `delta_E`, `eta`, `sigma` | 66–69 | used only by the stochastic term, which is computed and discarded (`total_dw = dw_det`) |

## How each parameter shapes the I–V curve

The effects below follow from the equations. The numbers come from one-parameter-at-a-time simulations of the empirical model at the default settings (Phase 1 analysis, cycle 2).

**Baseline (empirical model):**
- SET at about $+3.22$ V (where $w$ crosses 0.5).
- RESET at about $-3.80$ V.
- ON/OFF current ratio at +1 V of about $1.0\times10^4$.

| Slider | Main effect on the hysteresis | Measured example |
|---|---|---|
| $k_\mathrm{attempt}$ | Shifts **both** switching voltages. A higher value gives earlier switching. Only the ratio $k_\mathrm{attempt}/f$ matters. | about −0.07 V per decade |
| $\alpha$ | Sets how strongly voltage lowers the barrier. Switching voltages scale roughly as $1/\alpha$. Lowering it makes the device unable to RESET within ±4 V, so it stays stuck ON. | ×1.1 → SET 2.93 V, RESET −3.46 V; −7 % → no RESET |
| $E_\mathrm{set}$ | Moves the SET voltage (about 1.17 V per eV). A higher value also lowers the final $w$ and the LRS current slightly. | ×0.9 → SET 2.86 V |
| $E_\mathrm{reset}$ | Moves the RESET voltage (about 1.17 V per eV). **The most sensitive parameter:** +10 % prevents RESET at a 4 V sweep amplitude. | ×1.1 → no RESET |
| $p_\mathrm{set}$ | Shape of the SET transition. A larger value gives a slower, more rounded SET, a lower final $w$ and a lower LRS current. | 18 → final $w$ 0.87 |
| $p_\mathrm{reset}$ | Weak effect on the RESET shape; RESET is ended by the clip at $w=0$. | small |
| $n_\mathrm{set}$ | Slope of the **positive** HRS (OFF) branch only. Does not change the switching voltages. | ×0.5 → ON/OFF 881 |
| $n_\mathrm{reset}$ | Slope of the **negative** HRS branch only. | ×0.5 → $I_\mathrm{HRS}(-1\,\mathrm{V})$ ×14 |
| $I_s$ | Moves both HRS branches up or down rigidly on the log axis. ON/OFF $\propto 1/I_s$. | ×2 → ON/OFF $5.1\times10^3$ |
| $G_0$ | Moves the LRS (ON) branch rigidly. ON/OFF $\propto G_0$. | ×2 → ON/OFF $2.05\times10^4$ |

**Parameters that only act in combination** (the output depends only on these groupings):
- $k_\mathrm{attempt}/f$
- $n_\mathrm{set} v_t$ and $n_\mathrm{reset} v_t$

## Assumptions and numerical notes

- **Sweep and grid:**
  - The response is periodic after the first cycle, because the first RESET returns $w$ to exactly 0.
  - All cycles are simulated and plotted, as in the original.
  - The grid has $999.975$ points per period, not exactly 1000, because `linspace` includes the endpoint. It is kept so that results are identical to the original.
- **Time step:** at the default step ($\Delta t \approx 1\ \mu$s), switching voltages agree with a 16× finer step to within 5 mV (Phase 1 convergence test).
- **Validity checks:** for parameter values far outside the slider ranges, $\exp(\cdot)$ can overflow. The original arithmetic then gives NaN. The website detects this and shows a warning instead of a curve.
- **No circuit effects:** there is no series resistance or current compliance in this model. The voltage is applied directly to the device.

## Validation of the website implementation

The website runs `backend/memristor_model.py` in the browser. It is a restructured copy of the original script with identical arithmetic:
- **Bit-identical points:** 98 % of the current points are bit-identical to the original script.
- **Largest difference:** $3.7\times10^{-15}$ (relative), at the remaining points.

The automated tests in `validation/` execute the original file itself for the comparison. All changes are listed in `documentation/CHANGES_FROM_ORIGINAL.md`.
