# Editing guide

You can change everything below with a text editor such as Notepad++ or VS Code. No programming is needed. After saving, reload the browser page (Ctrl+F5).

**Tip:** JSON is strict.
- Use double quotes, and no comma after the last item in a list.
- If the site stops loading after an edit, paste the file into https://jsonlint.com to find the error.

## 1. Slider ranges, labels, units, descriptions

**File:** `config/model_config.json` → `parameters.sliders`

Example entry:

```json
{
  "name": "Is",
  "label": "Schottky saturation current",
  "symbol": "I_s",
  "units": "",
  "description": "...",
  "scale": "log",
  "default": 5e-9,
  "min": 5e-10,
  "max": 5e-8,
  "references": []
}
```

| Field | What to change |
|---|---|
| `label`, `description` | Free text |
| `symbol` | LaTeX without dollar signs, e.g. `E_{\\mathrm{set}}` (backslashes are doubled in JSON) |
| `units` | e.g. `"A"`. Use `"dimensionless"` for quantities without units (nothing is shown next to the slider). An empty string `""` shows "to be added" in the parameter table |
| `show_in_table` | (fixed parameters) `false` hides the parameter from the table on the Model & Equations page |
| `units_source` | Where the unit comes from |
| `min`, `max` | Slider start and end values. `min` must be below the default and the default below `max` |
| `scale` | `"linear"` or `"log"`. Log needs `min > 0` |
| `classification`, `classification_note` | Physical / fitting / numerical …, shown in the parameter table |
| `references` | e.g. `[{"id": "Smith2024", "text": "A. Smith et al., Journal 1, 2 (2024)", "doi": "10.xxxx/yyyy"}]` |

**Do not change `default`.** It must equal the value in the original code; the tests check this. If you deliberately change a value in the original code, update `default` here and in `backend/memristor_model.py` (`ORIGINAL_DEFAULTS`) too.

**Variant-specific parameters** (`alpha`, `Eset`, `Ereset`) keep `default`, `min` and `max` under `"variants": {"empirical": {...}, "ab_initio": {...}}`.

## 2. Turning a fixed parameter into a slider

Fixed parameters are in `parameters.fixed`: `T`, `vt`, `V_max`, `freq`, `num_cycles` and so on. To turn one into a slider:
1. Cut its entry from `fixed` and paste it into `sliders`.
2. Add `"scale"`, `"min"`, `"max"` and a `"description"`.

The slider appears automatically. No code change is needed, because the model already accepts every parameter by name.

**Integer parameters:** `num_cycles` and `pts_per_cycle` are marked `"integer": true`, so a slider for them rounds to whole numbers. Large values make each run proportionally slower.

## 3. Adding a completely new parameter

A new parameter means a change to the physics, so it needs the model code to change:
1. Add it to `backend/memristor_model.py`, in `ORIGINAL_DEFAULTS` and in the equation.
2. Add it to the config.
3. Run the tests.

Ask for help with this step if needed.

## 4. Page text, equations, references

**Files:** `content/*.md` (Markdown).

**Equations:**
- Inline: `$E_\mathrm{set}$`
- Display (on its own lines): `$$ ... $$`

**Special lines:** each of these must sit on its own line.

| Line | Inserts |
|---|---|
| `{{toc}}` | table of contents for the page |
| `{{param-table}}` | parameter table generated from the config (units appear automatically) |
| `{{code src="original_code/stochastic.py" lang="python" title="..."}}` | a source file with Copy and Download buttons |

**Placeholders:** text still to be written is marked `<span class="todo">to be added</span>`. Replace it with your text.

## 5. Pages and navigation

**File:** `config/site.json` → `pages`.

To add a page:
1. Create `content/my_page.md`.
2. Add `{ "id": "my-page", "title": "My page", "type": "markdown", "source": "content/my_page.md" }` to `pages`.

The order in the list is the order in the menu.

The same file also holds:
- the site title, subtitle, author, affiliation and footer;
- the plot axis labels (`plot`).

### Source-code column on a page

In `config/site.json`, a page can list source files in `"aside"`. They are shown in a right-hand column, or below the text on narrow screens. Example (the Model & Equations page):

```json
"aside": [
  { "src": "Luisier_IOP_deterministic.py", "lang": "python", "title": "Deterministic model (Python)" },
  { "src": "original_code/stochastic.py", "lang": "python", "title": "Stochastic model (Python)" }
]
```

### Model names

The model names ("Free data model", "Ab initio model"), their short names in the legend, their descriptions and the `_fp` suffix shown on the ab initio sliders are set under `variants` in `config/model_config.json`.

## 6. Figures

1. Copy an image into `frontend/assets/figures/`.
2. Insert it in a page with `![Caption](frontend/assets/figures/name.png)`, or use a `<figure>` block, as in `content/code_verilog.md`.

## 7. Experimental data

**File:** `backend/data/experimental_iv.json` (`V`, `I`, `label`, `reference`, `units`).

## 8. "Simulate Your Device" page

Visitors run a model file with their own parameter values and experimental data. Their code runs only in their own browser; nothing is uploaded.

| What | Where |
|---|---|
| Page text and instructions | `content/custom_intro.md` |
| Template shown in the code box and offered for download | `backend/templates/user_model_template.py` |
| Page title and template path | `config/site.json` → the page with `"type": "custom"` |

**How it works:** the file is executed exactly as written (matplotlib commands are ignored), then the website reads the variables `V_signal`, `current`, `state` and, if present, `x_exp` and `y_exp`, and plots them. This is done by `backend/user_model_runner.py`.

**Replacing the template:** you can replace `user_model_template.py` with a new version at any time. Keep those five variable names, or update `REQUIRED` in `backend/user_model_runner.py` and the instructions in `content/custom_intro.md` to match. Then run the tests (`python -m pytest validation`).

**Showing the ab initio model again on the Simulator page:** in `config/model_config.json`, under `variants`, set `"show_in_simulator": true` (or delete that line) for `ab_initio`.
