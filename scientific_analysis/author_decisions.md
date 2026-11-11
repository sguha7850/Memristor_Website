# Author decisions (answers to scientific_questions.md)

- **Recorded:** 2026-11-11.
- **Status of questions:** "Resolved" items are implemented. "Open" items are kept and shown on the website as *to be added by the author*.

| Q | Decision | Status | Implemented in |
|---|---|---|---|
| A1 | Use the root copy `D:\Memristor_Website\Luisier_IOP_deterministic.py` (alpha form) | Resolved | `backend/memristor_model.py` |
| A2 | Slider uses raw `alpha` only; `beta` and `L` are not sliders | Resolved | config `alpha` |
| A3 | `_fp` = first principles; used for the ab initio curve. `Eset_fp` and `Ereset_fp` come from reference papers. `beta_fp` (→ `alpha_fp`) was calibrated to the experimental data | Resolved; references to be added | config variants; references placeholders |
| A4 | Verilog-A model uses the fp (first-principles) parameters | Resolved | docs (Phase 3) |
| A5 | Device naming ignored for now; author adds it later | Open (placeholder) | config `model.device_name` = "" |
| A6 | Verilog-A `w` handling kept as is; it works in SmartSpice (confirmed by `TCAM_new_all.png`) | Kept as is | docs (Phase 3) |
| B1 | Ignore `N_channels`; use `Go` directly. Units to be added later | Resolved; units open | config `Go` |
| B2 | `vt` fixed; temperature not varied | Resolved | `T`, `vt` fixed |
| B3 | Ideality factors used as in the code; physical interpretation later | Resolved; interpretation open | config `n_set`, `n_reset` |
| B4 | Ignore `Ea` (unused) | Resolved | omitted |
| B5 | `p_set` and `p_reset` are fitted parameters | Resolved | classification "fitting" |
| B6 | Linear current blend is intended | Resolved | unchanged |
| B7, B8 | Verilog-A: use the code as written; explanations open | Open | presented as code |
| B9 | Current floor is for visualization only; value differs between codes | Resolved | `current_floor`, labelled display-only |
| C1 | Experimental data = `x_exp` / `y_exp`; reference later | Resolved; reference open | `backend/data/experimental_iv.json` |
| C2 | Fitting is manual | Resolved | documented |
| C3 | Code values are the best-fit values | Resolved | defaults = code values |
| D1–D5 | Use the netlist as written; SmartSpice output supplied as `TCAM_new_all.png`; other questions remain open | Open | static figure, labelled as SmartSpice output |

**Slider defaults:** every slider defaults to the value in the original code (author instruction). The start and end values were chosen by the coordinator and can be edited in `config/model_config.json`:
- **Linear sliders:** the default ±50 % (`n_set`, `n_reset`), or a symmetric band around it for energies, alpha, `p_set` and `p_reset`.
- **Log sliders:** ×0.1 to ×10 around the default (`k_attempt`, `Go`, `Is`).
