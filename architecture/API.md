# Backend / Frontend API (v1.0)

This contract is fixed before the frontend is implemented. Both sides must follow it.

## 1. Python API — `backend/memristor_model.py`

### `default_params(variant="empirical") -> dict`
Returns the full parameter dict reproducing the original script for that variant.
- `variant` is `"empirical"` or `"ab_initio"`.

### `simulate(params=None, variant="empirical") -> dict`
Runs the original explicit-Euler sweep for one variant.
- **`params`:** overrides any key of `default_params(variant)`. An unknown key raises `KeyError`.

**Result:**

| key | type | meaning |
|---|---|---|
| `model_version` | str | e.g. `"1.0.0"` |
| `variant` | str | `"empirical"` or `"ab_initio"` |
| `params` | dict | fully resolved parameters used for this run |
| `dt` | float | time step (s) |
| `t` | list[float] | time (s) |
| `V` | list[float] | applied voltage `V_max·sin(2πft)` |
| `w` | list[float] | state variable, in [0, 1] (0 = OFF) |
| `I` | list[float] | signed total current `I_total` (before floor) |
| `I_abs` | list[float] | `max(|I_total|, current_floor)`, the quantity plotted in the original |
| `status` | `"ok"` \| `"invalid"` | `"invalid"` means non-finite values occurred |
| `warnings` | list[str] | human-readable explanations |

**Status rule:** the frontend **must not draw** a curve whose status is `"invalid"`. It shows the warning instead.

### `simulate_both(shared=None, empirical=None, ab_initio=None) -> dict`
Runs both variants and returns `{"empirical": result, "ab_initio": result}`.
- `shared` holds parameters common to both variants (e.g. `k_attempt`).
- `empirical` and `ab_initio` hold the variant-specific values (`alpha`, `Eset`, `Ereset`).

### Parameter names (exact, case-sensitive)
- **Sliders:** `k_attempt`, `alpha`, `Eset`, `Ereset`, `n_set`, `n_reset`, `p_set`, `p_reset`, `Go`, `Is`
- **Fixed:** `k_B`, `T`, `q`, `vt`, `v_off`, `v_on`, `w_init`, `current_floor`, `V_max`, `freq`, `num_cycles`, `pts_per_cycle`
- **Variant-specific:** `alpha`, `Eset`, `Ereset`. All others are shared.

## 2. Worker protocol — `frontend/sim-worker.js`

All messages are JavaScript objects passed with `postMessage`.

| direction | message | payload |
|---|---|---|
| UI → worker | `{type:"init", modelUrl}` | loads Pyodide and the model file |
| worker → UI | `{type:"ready", modelVersion, loadMs}` | |
| worker → UI | `{type:"progress", stage}` | `"pyodide"`, `"model"` (loading feedback) |
| UI → worker | `{type:"simulate", id, shared, empirical, ab_initio, variants}` | `variants` lists which to run, e.g. `["empirical","ab_initio"]` |
| worker → UI | `{type:"result", id, elapsedMs, results:{<variant>:{V, I_abs, w, t, status, warnings, params}}}` | arrays sent as `Float64Array` (transferable) |
| worker → UI | `{type:"error", id, message}` | Python exception text |

**Rules**
- **IDs:** every `simulate` request carries an increasing `id`. The UI ignores any result whose `id` is older than the latest request it sent ("latest wins").
- **Debouncing:** the UI debounces slider input (~150 ms) and sends at most one request at a time. If a newer request arrives while one is running, the worker runs only the newest after the current one finishes.
- **Types:** the worker sends exactly the numbers it receives, with no rounding. Integers (`num_cycles`, `pts_per_cycle`) are passed as JavaScript integers.

## 3. Configuration contract — `config/model_config.json`

The frontend builds every control from this file.

**Fields for each parameter:**

| field | required | meaning |
|---|---|---|
| `name` | yes | must match a Python parameter name |
| `label`, `symbol` (LaTeX), `description` | yes | display text |
| `units` | yes | empty string → displayed as "units not stated in source" |
| `units_source` | no | provenance of the unit |
| `classification` | yes | `physical` \| `fitting` \| `numerical` \| `stimulus` \| `constant` \| `visualisation` |
| `classification_note` | no | free text |
| `scale` | sliders | `"linear"` or `"log"` (log: slider moves in log₁₀ space) |
| `default`, `min`, `max` | sliders | for variant-specific parameters these sit under `variants.<id>` |
| `step` | no | linear sliders only; default (max−min)/400 |
| `variant_specific` | no | true → `variants: {empirical:{…}, ab_initio:{…}}` |
| `references` | no | list of `{ "id", "text", "doi", "url" }` |

**Enforced by `validation/`:**
- Every default equals the original code.
- `min < default < max` for every slider.
- `min > 0` for log-scale sliders.
- The config covers exactly the model's parameters.

## 4. Display contract (I–V plot)
- **Axes:** x is `V`; y is `I_abs` on a log₁₀ axis, the same as `plt.semilogy(V_signal, current)` in the original.
- **Default curves:** both variants plus `backend/data/experimental_iv.json` as open markers, the same as the original figure.
- **Cycles:** all `num_cycles` cycles are plotted, as in the original. Cycles after the first overlap.
- **Labels:** units on the axis labels come from the config; an empty unit shows no unit, never a guessed one.
- **Floor note:** a note states that `current_floor` is a display floor only.

## 5. Versioning
- `MODEL_VERSION` (Python) and `config_version` (JSON) follow semantic versioning.
- **Major bump:** any change to the model's numerical behaviour. It must come with updated validation and an entry in `documentation/CHANGES_FROM_ORIGINAL.md`.
