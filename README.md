# Physics-Based Memristor Model: Interactive Website

An interactive website for a deterministic physics-based memristor model. It offers:
- **a live simulator:** sliders change the semilog current–voltage hysteresis;
- **equations and documentation** for the model;
- **source code** in three languages: deterministic Python, stochastic Python (shown as documentation only) and Verilog-A with a TCAM circuit.

The simulation runs the **Python model inside the browser** using [Pyodide](https://pyodide.org). There is no server, so the site can be hosted free on **GitHub Pages**.

## Quick start (Windows)

You need Python 3.10 or newer from https://www.python.org/downloads/. When installing, tick "Add python.exe to PATH".

**Easiest:** double-click **`start_website.bat`** in the project folder. It starts the server and opens the site.

Or, in Command Prompt:
```
cd /d D:\Memristor_Website
python -m http.server 8000 --bind 127.0.0.1
```

The `/d` is needed to switch drives in Command Prompt. Without it, Python serves your home folder instead of the website. `--bind 127.0.0.1` keeps the server visible only to your own computer.

Then open **http://localhost:8000** in Chrome, Edge or Firefox.

- **Internet:** an internet connection is needed. The browser downloads Pyodide, Plotly and the other libraries from CDNs on the first visit.
- **Why a server:** opening `index.html` by double-clicking does **not** work. Browsers block the file loading the site needs on `file://` pages.

More detail and troubleshooting: [`documentation/RUNNING_ON_WINDOWS.md`](documentation/RUNNING_ON_WINDOWS.md).

## Publish on GitHub Pages

See [`documentation/DEPLOY_GITHUB_PAGES.md`](documentation/DEPLOY_GITHUB_PAGES.md).

## Edit content, parameters, units and references

Everything is in plain text files; no programming is needed. See [`documentation/EDITING_GUIDE.md`](documentation/EDITING_GUIDE.md).

| What | Where |
|---|---|
| Sliders: ranges, labels, units, descriptions | `config/model_config.json` |
| Page titles, navigation, plot labels | `config/site.json` |
| Page text, equations, references | `content/*.md` |
| Figures | `frontend/assets/figures/` |

## Project structure

```
index.html                  website entry page
frontend/                   user interface (css, js, assets)
backend/                    Python model run by the website + experimental data
config/                     editable configuration
content/                    editable page text (Markdown + LaTeX)
original_code/              original source files (read-only)
Luisier_IOP_deterministic.py  authoritative original deterministic script (read-only)
validation/                 automated tests (website model vs. original script)
architecture/               architecture and backend/frontend API
documentation/              guides and change log
scientific_analysis/        analysis reports and author decisions
```

## Verify the implementation

```
python -m pip install -r requirements.txt
python -m pytest validation -v
```

The tests execute the original script and confirm the website model reproduces it. 98 % of points are bit-identical, and the maximum relative difference is 3.7e-15.

## Dependencies

| Used for | Dependency | How it is obtained |
|---|---|---|
| Website | Pyodide 0.26.4, Plotly.js 2.35.2, KaTeX 0.16.11, marked 12.0.2, highlight.js 11.10.0 | loaded from CDN (pinned versions); nothing to install |
| Website model | Python standard library only | — |
| Tests | numpy, matplotlib, pytest | `requirements.txt` |
| Verilog-A / TCAM | a circuit simulator with a Verilog-A compiler | **not** required for the website; see the Verilog-A page |
