# Differences between the original and the website implementation

- **Original (read-only):** `Luisier_IOP_deterministic.py` (the copy at the project root that uses alpha; authoritative per author decision A1)
- **Adapted:** `backend/memristor_model.py` v1.0.0

## Numerical behaviour: unchanged
Verified by `validation/test_model_equivalence.py`, which runs the original file itself:
- **Voltage grid:** identical to within 1e-13 V.
- **Current (`current`, `current_fp`):**
  - 98.3 % of the 40,000 points are bit-identical.
  - Maximum relative difference is 3.7e-15 (floating-point rounding: `math.exp` vs `np.exp`).
- **State (`state`, `state_fp`):** maximum absolute difference is 1.1e-16.

## Structural changes (needed for the website)

| # | Original | Adapted | Effect on results |
|---|---|---|---|
| 1 | Parameters are module globals and class attributes | Passed in as a dict; defaults in `ORIGINAL_DEFAULTS` / `VARIANT_DEFAULTS` with original line numbers | none |
| 2 | Empirical and `_fp` variants updated in one loop | One function called twice with different `alpha`, `Eset`, `Ereset` | none (the variants never interact) |
| 3 | `alpha = beta/(L*q)` computed from `beta`, `L` | `alpha` is a direct input (decision A2); its default is the same expression, so the value is identical | none at defaults |
| 4 | `G_metallic = N_channels * G0` with `N_channels = 1` | `Go` used directly (decision B1) | none |
| 5 | numpy scalar operations (`np.exp`, `np.sin`, `np.clip`, `np.sign`, `np.maximum`) | Python `math` equivalents with numpy semantics (overflow → `inf`, NaN propagation) | ≤ 4e-15 relative |
| 6 | `np.linspace` time grid | Same formula, endpoint forced exactly as numpy does | ≤ 1e-13 |
| 7 | `np.random.normal` drawn every step, result discarded (`total_dw = dw_det`) | Omitted | none (random value was never used) |
| 8 | Unused items: `Ea`, `U0`, `delta_E`, `eta`, `sigma`, `dU_dw` (absent in this copy) | Omitted (decision B4) | none |
| 9 | Plotting, `plt.show()`, `savefig` at 900 dpi | Moved to the frontend (Plotly) | display only |
| 10 | Non-finite results silently plotted (or dropped) by matplotlib | `status="invalid"` + warning; frontend does not draw them | display only |

## Not changed (deliberately kept as in the original)
- Explicit Euler integration with `dt = t[1] - t[0]`, followed by clipping `w` to [0, 1].
- Ideality factor selected by voltage polarity (`n_set` for V ≥ 0, `n_reset` for V < 0).
- Fixed `vt = 0.026`, independent of `T` (decision B2).
- Linear current blend `(1-w)·I_sch + w·I_met` (decision B6).
- Current floor `1e-11`, used for display only (decision B9).
- `num_cycles = 40` and `pts_per_cycle = 1000`. This gives 999.975 points per cycle; it is kept for identical results.
