# About this website

## Purpose

This site presents a physics-based memristor model:
- an interactive deterministic simulation;
- its governing equations;
- the source code: deterministic Python, stochastic Python (documentation only) and Verilog-A with a TCAM circuit.

**Author:** <span class="todo">to be added</span>
**Device:** <span class="todo">to be added</span>

## How the simulation works

There is no server. When you open the Simulator page:
- **Python in the browser:** your browser downloads Pyodide, a full Python interpreter compiled to WebAssembly (about 6–10 MB on the first visit, cached afterwards).
- **The model file:** the browser runs `backend/memristor_model.py`. That file is a restructured copy of the original deterministic script with identical arithmetic.
- **Automatic re-runs:** every slider change re-runs the full simulation (40 cycles, about 40 000 time steps for each model) and redraws the plot.

The website never interpolates or approximates curves. If a parameter combination makes the model's arithmetic overflow, the curve is withheld and a warning is shown.

## Reproducibility

The repository contains:

| Folder | Contents |
|---|---|
| `original_code/`, `Luisier_IOP_deterministic.py` | original source files (unchanged) |
| `backend/` | website model and experimental data |
| `config/` | all parameters, ranges, units and site settings |
| `content/` | the text of every page (Markdown) |
| `validation/` | automated tests comparing the website model with the original script |
| `documentation/` | change log, editing guide, Windows instructions |

To check the implementation yourself, run `python -m pytest validation -v`. See `documentation/RUNNING_ON_WINDOWS.md`.

## How to cite

<span class="todo">To be added by the author.</span>
