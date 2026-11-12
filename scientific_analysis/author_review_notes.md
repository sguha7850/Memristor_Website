# Author review notes (not published on the website)

These notes were on the former "Deterministic Code" and "Stochastic Code" pages. They were moved here when those pages were merged into *Model & Equations* (author request, 2026-11-12). They are observations from the code analysis for the author to check; they are not shown to website visitors.

## Deterministic code (`Luisier_IOP_deterministic.py`)

### Variables defined but not used for the result

| Name | Value | Line | Note |
|---|---|---|---|
| `Ea` | 2.0 | 20 | comment "Activation Energy (eV)"; not used |
| `beta` | 0.6e-9 | 21 | comment "Field coupling constant (eV·m/V)"; used only to compute `alpha` |
| `beta_fp` | 0.56e-9 | 22 | used only to compute `alpha_fp` |
| `L` | 0.7e-9 | 16 | comment "Device thickness (0.7nm)"; used only to compute `alpha`, `alpha_fp` |
| `N_channels` | 1 | 34 | `G_metallic = N_channels*G0`; ignored on the website (author) |
| `U0`, `delta_E`, `eta`, `sigma` | 10.0, 0.0, 1.0, 5 | 66–69 | used only in the discarded stochastic term |

### Notes

- **Unused random draw:** `np.random.normal(0, 1)` is evaluated at every step (line 104), but its result is not used (`total_dw = dw_det`, line 107). It does not change the result.
- **Legend never shown:** `plt.show()` is called before `plt.savefig()` (lines 291–292). With an interactive backend the saved PNG can be empty. `plt.legend()` is never called, so the curve labels are not displayed.
- **Points per cycle:** the comment on line 40 says "exactly 1000 pts per cycle". Because `np.linspace` includes the end point, the grid actually has 999.975 points per period. The effect is negligible, and it is kept unchanged on the website.
- **Spelling in plot labels:** "Emperical" and "Ab inito" (lines 266–267).

## Stochastic code (`original_code/stochastic.py`)

### Notes

- **Unused `_fp` path:** `current_fp` uses `w_fp`, which is never updated (it stays 0), so the "ab initio" current here is the pure HRS curve. It is computed but not plotted.
- **$V_\mathrm{RESET}$ definition:** in the third quarter the current is negative. `argmax` therefore selects the current closest to zero, not the largest-magnitude current. Please confirm this is the intended definition (a possible alternative is `argmin` or `argmax(abs(i_q3))`).
- **Noise only on the total state:** the noise acts on $w_\mathrm{stoch}$, which is not bounded by the 0.90 cap, so the total $w$ can still reach 1.
- **Linear current axis:** the I–V panel uses `ax1.plot` (linear axis) with a `LogLocator` on y. A semilog view would need `ax1.semilogy` with $|I|$.
- **Cycle slicing:** the grid has 999.975 points per period, as in the deterministic code, so slicing every 1000 points drifts slightly over 50 cycles.
- **Escape sequence:** `"Resistance ($\Omega$)"` (line 251) is not a raw string; newer Python versions warn about the escape sequence.

### Parameters not listed on the website
- `U0 = 10.0`, `delta_E = 0.0` (lines 57–58): used only in `dU_dw`, which is never called.
- `Eset_fp`, `Ereset_fp`, `beta_fp`: used only in `dw_dt_deterministic_fp`, which is never called.
- `num_cycles = 50` (deterministic code: 40).
- $V_\mathrm{SET}$ extraction window 2.5–3.7 (line 165).
