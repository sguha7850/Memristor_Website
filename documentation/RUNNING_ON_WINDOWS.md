# Running on Windows

## Prerequisites

| Need | For | Install |
|---|---|---|
| Python 3.10+ | local web server; tests | https://www.python.org/downloads/windows/ (tick "Add python.exe to PATH") |
| A modern browser | viewing the site | Chrome, Edge or Firefox (current versions) |
| Internet connection | first load of the site (Pyodide, Plotly, KaTeX from CDNs) | — |
| *Optional:* numpy, matplotlib, pytest | validation tests only | `pip install -r requirements.txt` |
| *Not needed:* SmartSpice or any circuit simulator | — | required only to re-run the Verilog-A/TCAM netlist yourself |

## 1. View the website locally

**Easiest:** double-click **`start_website.bat`** in the project folder. It starts the server and opens the site.

Or, in **Command Prompt** (in PowerShell, use `cd D:\Memristor_Website` without `/d`):
```
cd /d D:\Memristor_Website
python -m http.server 8000 --bind 127.0.0.1
```

The `/d` is needed to switch drives in Command Prompt. Without it, Python serves your home folder instead of the website. `--bind 127.0.0.1` keeps the server visible only to your own computer.

1. Open **http://localhost:8000** in your browser.
2. The Simulator page shows "Downloading Python runtime…" for a few seconds on the first visit, then the curves appear.
3. Stop the server with **Ctrl+C**.

Double-clicking `index.html` does **not** work. Browsers block the site's file loading and its background simulation worker on `file://` pages, so the local server is required.

## 2. Run the validation tests (optional)

```
cd /d D:\Memristor_Website
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
python -m pytest validation -v
```

Expected result: **13 passed**. The tests run the original `Luisier_IOP_deterministic.py` and compare it with the website model point by point.

To run the model on its own: `python backend\memristor_model.py`. This needs no packages.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `'python' is not recognized` | Re-run the Python installer and tick "Add to PATH", or use `py` instead of `python`. |
| Page says "Could not load the site configuration" | You opened the file directly. Use `python -m http.server` and `http://localhost:8000`. |
| "Could not load the Python runtime" | No internet, or a firewall or proxy blocks `cdn.jsdelivr.net`. Try another network. |
| Port 8000 already in use | Use another port: `python -m http.server 8080`, then open `http://localhost:8080`. |
| Changes to a `.md` or `.json` file do not appear | Press **Ctrl+F5** to force a reload. |
| Site stops loading after editing a JSON file | JSON syntax error. Check the file at https://jsonlint.com. |
| `Activate.ps1 cannot be loaded` (PowerShell) | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or use Command Prompt. |
| Slider moves but nothing updates, with a warning | The parameter combination makes the model overflow; the curve is withheld on purpose. Press ↺ or "Reset all". |
