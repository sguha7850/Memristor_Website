# Model & Equations

{{toc}}

## Overview

The device is described by a single internal state variable $w \in [0, 1]$:

| State | $w$ | Description |
|---|---|---|
| OFF | $w = 0$ | OFF state, semiconducting, high resistance (HRS) |
| ON | $w = 1$ | ON state, metallic, low resistance (LRS) |

- **Switching:** $w$ changes through thermally activated SET and RESET transitions. The applied voltage lowers the activation energy of each transition.
- **Current:** a linear blend of a Schottky-type (OFF) term and a metallic (ON) term, weighted by $w$.

Two parameter sets of the same model are provided:

| Model | Parameters | Origin of values |
|---|---|---|
| Free data | `alpha`, `Eset`, `Ereset` | Every parameter value is a fitted value, chosen to best match the experimental data |
| Ab initio | `alpha_fp`, `Eset_fp`, `Ereset_fp` | $E_\mathrm{set,fp}$ and $E_\mathrm{reset,fp}$ from first principles (reference papers); $\alpha_\mathrm{fp}$ calibrated to the experimental data |

All other parameters are shared by both models.

## Governing equations

### 1. Applied voltage

$$
V(t) = V_{\max}\,\sin(2\pi f t)
$$

### 2. State kinetics: SET and RESET

$$
\frac{dw}{dt} =
\begin{cases}
\;\;\,k_\mathrm{attempt}\,\exp\!\left[-\dfrac{E_\mathrm{set} - \alpha\, q\, V}{k_B T}\right](1-w)^{p_\mathrm{set}}, & V > 0 \quad \text{(SET)}\\[2ex]
-\,k_\mathrm{attempt}\,\exp\!\left[-\dfrac{E_\mathrm{reset} - \alpha\, q\, |V|}{k_B T}\right] w^{\,p_\mathrm{reset}}, & V < 0 \quad \text{(RESET)}\\[2ex]
\;\;\,0, & V = 0
\end{cases}
$$

- **Barrier lowering:** the term $\alpha q V$ describes the barrier lowering due to the applied field.
- **Ab initio model:** the same expressions, with $\alpha \to \alpha_\mathrm{fp}$, $E_\mathrm{set} \to E_\mathrm{set,fp}$ and $E_\mathrm{reset} \to E_\mathrm{reset,fp}$.
- **Window functions:** the factors $(1-w)^{p_\mathrm{set}}$ and $w^{p_\mathrm{reset}}$ slow the transition as $w$ approaches its limit. $p_\mathrm{set}$ and $p_\mathrm{reset}$ are fitted parameters.

### 3. Time integration

Explicit (forward) Euler with a fixed time step $\Delta t$, followed by clipping:

$$
w_{i} = \operatorname{clip}\!\Big(w_{i-1} + \dot w\big(V_i,\, w_{i-1}\big)\,\Delta t,\; 0,\; 1\Big), \qquad w_\mathrm{init} = 0
$$

### 4. Current

$$
I_\mathrm{sch} = I_s\left[\exp\!\left(\frac{|V|}{n\, v_t}\right) - 1\right]\operatorname{sgn}(V),
\qquad
n = \begin{cases} n_\mathrm{set}, & V \ge 0\\ n_\mathrm{reset}, & V < 0\end{cases}
$$

$$
I_\mathrm{met} = G_0\, V, \qquad I = (1-w)\,I_\mathrm{sch} + w\, I_\mathrm{met}
$$

### 5. Stochastic model

The stochastic code adds a Gaussian random increment to the state. The deterministic part $w_\mathrm{det}$ follows the kinetics above:

$$
w = w_\mathrm{det} + w_\mathrm{stoch}, \qquad
w_\mathrm{stoch} \leftarrow w_\mathrm{stoch} + \delta\,\xi\,\sqrt{\Delta t}, \quad \xi \sim \mathcal{N}(0, 1)
$$

The stochastic model is shown here as documentation; the simulator runs the deterministic model.

## Parameters

{{param-table}}

### Stochastic parameters

These are used only by the stochastic code, in addition to the parameters above (free-data values).

| Parameter | Symbol | Value in code | Units | Description |
|---|---|---|---|---|
| `delta` (= `sigma/eta`) | $\delta$ | 1 (= 1 / 1) | <span class="todo">to be added</span> | Amplitude of the random state increment |
| `w_det` upper limit | $w_\mathrm{det,max}$ | 0.90 | dimensionless | Upper limit of the deterministic part of the state |
| `V_read` | $V_\mathrm{read}$ | 0.3 | V | Read voltage used to extract the HRS and LRS resistance in each cycle |

## How each parameter shapes the I–V curve

The effects below follow from the equations. The numbers come from one-parameter-at-a-time simulations of the free data model at the default settings (second cycle).

**Baseline (free data model):**
- SET at about $+3.22$ V.
- RESET at about $-3.80$ V.
- ON/OFF current ratio at +1 V of about $1.0\times10^4$.

| Parameter | Main effect on the hysteresis | Example |
|---|---|---|
| $k_\mathrm{attempt}$ | Shifts **both** switching voltages. A higher value gives earlier switching. | about −0.07 V per decade |
| $\alpha$ | Sets how strongly the voltage lowers the barrier. Switching voltages scale roughly as $1/\alpha$. A lower value can prevent RESET within ±4 V, so the device stays ON. | ×1.1 → SET 2.93 V, RESET −3.46 V; −7 % → no RESET |
| $E_\mathrm{set}$ | Moves the SET voltage (about 1.17 V per eV). | ×0.9 → SET 2.86 V |
| $E_\mathrm{reset}$ | Moves the RESET voltage (about 1.17 V per eV). The most sensitive parameter. | ×1.1 → no RESET at 4 V |
| $p_\mathrm{set}$ | Shape of the SET transition. A larger value gives a slower, more rounded SET and a lower LRS current. | 18 → final $w$ 0.87 |
| $p_\mathrm{reset}$ | Weak effect on the shape of the RESET transition. | small |
| $n_\mathrm{set}$ | Slope of the **positive** HRS branch only. | ×0.5 → ON/OFF 881 |
| $n_\mathrm{reset}$ | Slope of the **negative** HRS branch only. | ×0.5 → $I_\mathrm{HRS}(-1\,\mathrm{V})$ ×14 |
| $I_s$ | Moves both HRS branches up or down on the log axis. ON/OFF $\propto 1/I_s$. | ×2 → ON/OFF $5.1\times10^3$ |
| $G_0$ | Moves the LRS branch up or down. ON/OFF $\propto G_0$. | ×2 → ON/OFF $2.05\times10^4$ |
