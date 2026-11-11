# Architecture

**Status:** Phase 3, implemented (minimal website).

## 1. Constraints driving the design

| Constraint | Source |
|---|---|
| Hosted on GitHub Pages (`*.github.io`) | Author, Phase 2 instructions |
| Simulation code is Python; the Python code is the reference | Project rules |
| The website must show real numerical simulations, never illustrations | Project rules |
| The author must be able to edit parameters, ranges, units, names, references and text later, without programming | Author, Phase 2 instructions |
| Must run locally on Windows, with no commercial simulator | Project rules |
| Keep the build and maintenance cost low | Author ("optimally using the Claude resources") |

GitHub Pages serves **static files only**. It cannot run a Python server, so a Flask or FastAPI backend is impossible there.

## 2. Decision: Python runs in the visitor's browser (Pyodide)

```
            GitHub Pages (static files)
 ┌──────────────────────────────────────────────────────────┐
 │ frontend/  (HTML + CSS + JS modules, no build step)      │
 │   ├─ UI: sliders, variant toggles, docs pages            │
 │   ├─ Visualization: Plotly.js semilog I-V, w(t), V(t)    │
 │   └─ sim-worker.js (Web Worker)                          │
 │         └─ Pyodide (CPython → WebAssembly)               │
 │               └─ backend/memristor_model.py  ◄── same file tested in CPython
 │ config/model_config.json   (parameters, ranges, units)   │
 │ content/*.md               (theory, references, TCAM)    │
 │ backend/data/experimental_iv.json                        │
 └──────────────────────────────────────────────────────────┘
```

- **Scientific backend:** `backend/memristor_model.py`.
  - Pure Python standard library only (`math`), with no numpy or other third-party packages.
  - The **same file** runs in CPython, where the tests run, and in the browser.
  - There is no second implementation to keep in sync.
- **Backend–frontend boundary:** a Web Worker running Pyodide, with a defined message protocol (`architecture/API.md`).
  - The user interface never blocks while the model runs.
  - The "backend" is a process boundary, not a network server. If you later move to a real server (for example Render or a university machine), only the worker needs replacing; the protocol stays the same.
- **Frontend:** plain HTML, CSS and JavaScript modules.
  - No React and no build step, so nothing needs compiling.
  - You can edit files directly, and Windows needs only Python to serve the site locally.
- **Visualization:** Plotly.js, loaded from a pinned CDN version.
  - Semilog axes, zoom and pan, PNG and SVG export, and hover readout.
- **Equations:** KaTeX, rendered from LaTeX written in the content files.
- **Documentation and text:** Markdown files in `content/`, rendered in the page.
  - You edit text, assumptions and references without touching code.

### Measured and estimated performance
| | Value |
|---|---|
| Both variants, 40 cycles × 1000 points, CPython 3.13 (measured) | **0.08 s** |
| Same run in Pyodide 0.26.4 / Python 3.12, desktop browser (measured) | **0.45–0.72 s** |
| First visit, runtime download included (measured, one network) | ~38 s |
| First-visit download: Pyodide core only, no numpy (cached afterwards) | ~6–10 MB |

Slider changes are debounced, and the latest request always wins. Browser results match CPython to within 1.6e-15 relative.

### Alternatives rejected
| Option | Why not |
|---|---|
| Python server (Flask/FastAPI) | Not possible on GitHub Pages. Needs paid or always-on hosting. |
| Port the model to JavaScript | Fast, but creates a second implementation that can drift from the Python reference. |
| Precomputed lookup tables | Ten sliders make the parameter space too large. Interpolated curves would be approximations, which the project rules forbid presenting as simulations. |
| React/Vite build | Adds Node.js, a build step and dependencies that bring no benefit at this size. |

## 3. Editability (author requirement)

| You want to change… | Edit | Code change? |
|---|---|---|
| Slider min, max, scale, label, symbol, units, description | `config/model_config.json` | No |
| Make a fixed parameter (e.g. `V_max`, `T`) into a slider | Move its entry from `fixed` to `sliders`, then add `scale`, `min` and `max` | No |
| References (per parameter or global) | `references` arrays in the config, and `content/references.md` | No |
| Device name, page text, assumptions, equations | `content/*.md`, `config/model_config.json` → `model` | No |
| TCAM figures or new figures | Drop the image into `frontend/assets/figures/`, reference it in `content/tcam.md` | No |
| A parameter that does not yet exist in the model | `backend/memristor_model.py` + config + test | Yes (Python only) |

The website reads everything from the config and content files at load time; nothing is hard-coded in the frontend. The test suite fails if a config default stops matching the original code.

## 4. Repository layout (target)

```
Memristor_Website/
├─ index.html                      website entry page (loads frontend/)
├─ start_website.bat               local server for Windows
├─ Luisier_IOP_deterministic.py    original (read-only, authoritative)
├─ original_code/                  originals (read-only)
├─ backend/
│   ├─ memristor_model.py          website model (Phase 2, done)
│   └─ data/experimental_iv.json   x_exp, y_exp (Phase 2, done)
├─ config/model_config.json        parameters (Phase 2, done)
├─ content/                        Markdown pages
├─ frontend/                       UI, worker, styles, assets
├─ validation/                     pytest suite (Phase 2, done)
├─ architecture/                   this file, API.md
├─ documentation/                  changes log, editing guide, Windows guide
├─ scientific_analysis/            Phase 1 reports, author decisions
└─ requirements.txt
```

## 5. Deployment

- **GitHub Pages:** "Deploy from branch", serving the `main` branch from its root. The site appears at `https://<user>.github.io/<repo>/`; the root `index.html` is the site.
- **Local and Windows:** double-click `start_website.bat` (or `python -m http.server 8000 --bind 127.0.0.1` in the project root), then open `http://localhost:8000`. A server is needed because browsers block `fetch()` from `file://` pages.
- **Publication:** GitHub Pages publishes the entire repository, including `original_code/stochastic.py`. The author decided to show that file as documentation.

## 6. Scope limits

- **Verilog-A model and TCAM deck:** presented as source code with documentation, plus your SmartSpice result figure (`TCAM_new_all.png`), clearly labelled as supplied simulator output.
- **No circuit simulation on the website:** the site does not run SPICE or Verilog-A. Running them needs an external simulator, documented separately.
- **Stochastic model:** its code is shown as documentation; it is not simulated (author decision).
