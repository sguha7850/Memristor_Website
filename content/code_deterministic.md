# Deterministic Python code

{{toc}}

## Summary

| | |
|---|---|
| **File** | `Luisier_IOP_deterministic.py` (authoritative version; uses `alpha`) |
| **Language / dependencies** | Python 3; `numpy`, `matplotlib` |
| **What it computes** | Deterministic I–V hysteresis of the memristor under a sinusoidal sweep. Two variants: empirical and ab initio ("`_fp`") |
| **Integration** | Explicit Euler, fixed time step, state clipped to $[0,1]$ |
| **Output** | Semilog plot of $\max(|I|, 10^{-11})$ against $V$ for both variants, with the experimental data overlaid |
| **Simulated on this website?** | **Yes.** The [Simulator](#simulator) runs a validated, restructured copy (below) |

## Parameters used in the code

The values below are exactly as written in the code. Units are shown where the source states them; others are *to be added*. The same table drives the simulator sliders.

{{param-table}}

**Defined in the code but not used for the result:**

| Name | Value | Line | Note |
|---|---|---|---|
| `Ea` | 2.0 | 20 | comment "Activation Energy (eV)"; not used |
| `beta` | 0.6e-9 | 21 | comment "Field coupling constant (eV·m/V)"; used only to compute `alpha` |
| `beta_fp` | 0.56e-9 | 22 | used only to compute `alpha_fp` |
| `L` | 0.7e-9 | 16 | comment "Device thickness (0.7nm)"; used only to compute `alpha`, `alpha_fp` |
| `N_channels` | 1 | 34 | `G_metallic = N_channels*G0`; ignored on the website (author) |
| `U0`, `delta_E`, `eta`, `sigma` | 10.0, 0.0, 1.0, 5 | 66–69 | used only in the discarded stochastic term |

## Key equations (with code lines)

**State rate, lines 71–79** (`dw_dt_deterministic`; the `_fp` version at lines 80–88 uses `alpha_fp`, `Eset_fp`, `Ereset_fp`):

$$
\frac{dw}{dt} = \begin{cases}
k_\mathrm{attempt}\, e^{-(E_\mathrm{set} - \alpha q V)/k_BT}\,(1-w)^{p_\mathrm{set}}, & V > v_\mathrm{off}\\
-k_\mathrm{attempt}\, e^{-(E_\mathrm{reset} - \alpha q |V|)/k_BT}\, w^{p_\mathrm{reset}}, & V < v_\mathrm{on}\\
0 & \text{otherwise}
\end{cases}
$$

**Euler update with clipping, lines 100–110:**

$$
w \leftarrow \operatorname{clip}(w + \dot w\,\Delta t,\ 0,\ 1)
$$

**Current, lines 122–133:**

$$
I_\mathrm{sch} = I_s\big(e^{|V|/(n v_t)}-1\big)\operatorname{sgn}V,\quad
I_\mathrm{met} = G_0 V,\quad
I = (1-w) I_\mathrm{sch} + w I_\mathrm{met},\quad
I_\mathrm{plot} = \max(|I|, 10^{-11})
$$

Here $n = n_\mathrm{set}$ for $V \ge 0$ and $n = n_\mathrm{reset}$ for $V<0$. A full derivation and explanation are on the [Model & Equations](#model) page.

## Additional notes for the author to check

- **Unused random draw:** `np.random.normal(0, 1)` is evaluated at every step (line 104), but its result is not used (`total_dw = dw_det`, line 107). It does not change the result.
- **Legend never shown:** `plt.show()` is called before `plt.savefig()` (lines 291–292). With an interactive backend the saved PNG can be empty. `plt.legend()` is never called, so the curve labels are not displayed.
- **Points per cycle:** the comment on line 40 says "exactly 1000 pts per cycle". Because `np.linspace` includes the end point, the grid actually has 999.975 points per period. The effect is negligible, and it is kept unchanged on the website.
- **Spelling in plot labels:** "Emperical" and "Ab inito" (lines 266–267).

## Original source code

{{code src="Luisier_IOP_deterministic.py" lang="python" title="Luisier_IOP_deterministic.py (original, read-only)"}}

## Website implementation

This is the file that runs in your browser. It contains the same arithmetic, restructured into functions that take a parameter dictionary, with plotting removed. It is tested against the original by `validation/test_model_equivalence.py`:
- 98 % of points are bit-identical.
- The maximum relative difference is $3.7\times10^{-15}$.

| # | Change | Effect on numbers |
|---|---|---|
| 1 | Parameters passed as a dictionary instead of globals | none |
| 2 | Empirical and ab initio run as two calls of one function | none |
| 3 | `alpha` is a direct input; its default is $\beta/(Lq)$ as before | none |
| 4 | `math` instead of `numpy` scalar functions, with the same overflow behaviour | ≤ 4e-15 |
| 5 | Unused random draw and plotting removed | none |
| 6 | Non-finite results flagged as invalid instead of silently plotted | display only |

{{code src="backend/memristor_model.py" lang="python" title="backend/memristor_model.py (website version)"}}
