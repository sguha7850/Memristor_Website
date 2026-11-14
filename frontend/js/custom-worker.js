/* Worker for the "Simulate Your Device" page.
   Runs a user-supplied Python model in Pyodide, isolated from the main
   simulator. The page can terminate this worker at any time (Stop button),
   e.g. if the user's code runs too long. Nothing leaves the browser.

   Messages:
     UI -> worker  {type:"init", pyodideVersion, runnerUrl}
     worker -> UI  {type:"ready", pythonVersion, loadMs} | {type:"progress", stage}
     UI -> worker  {type:"load", code}
     worker -> UI  {type:"loaded", info:{model_name, current_floor, parameters}}
     UI -> worker  {type:"simulate", id, params}
     worker -> UI  {type:"result", id, elapsedMs, V, I, w?, t?, nNonfinite}
     worker -> UI  {type:"error", id?, stage, message}
*/
let pyodide = null, runner = null;

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === "init") await init(m);
    else if (m.type === "load") await load(m);
    else if (m.type === "simulate") simulate(m);
  } catch (err) {
    self.postMessage({ type: "error", id: m.id, stage: m.type, message: tidy(err) });
  }
};

async function init({ pyodideVersion, runnerUrl }) {
  const t0 = performance.now();
  self.postMessage({ type: "progress", stage: "Downloading Python runtime (first visit only)…" });
  const base = `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`;
  importScripts(base + "pyodide.js");
  pyodide = await loadPyodide({ indexURL: base });
  const res = await fetch(runnerUrl, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${runnerUrl} (HTTP ${res.status})`);
  pyodide.FS.mkdirTree("/runner");
  pyodide.FS.writeFile("/runner/user_model_runner.py", await res.text());
  pyodide.runPython("import sys; sys.path.insert(0, '/runner'); import user_model_runner");
  runner = pyodide.pyimport("user_model_runner");
  self.postMessage({ type: "ready", pythonVersion: pyodide.runPython("import sys; sys.version.split()[0]"),
                     loadMs: performance.now() - t0 });
}

async function load({ code }) {
  self.postMessage({ type: "progress", stage: "Loading packages imported by your file…" });
  await pyodide.loadPackagesFromImports(code);      // e.g. numpy, scipy (downloaded on first use)
  const py = runner.load(code);
  const info = py.toJs({ dict_converter: Object.fromEntries });
  py.destroy();
  self.postMessage({ type: "loaded", info });
}

function simulate({ id, params }) {
  const t0 = performance.now();
  const pyParams = pyodide.toPy(params);
  let out = null;
  try {
    out = runner.run(pyParams);
    const r = out.toJs({ dict_converter: Object.fromEntries });
    const msg = { type: "result", id, elapsedMs: performance.now() - t0, nNonfinite: r.n_nonfinite };
    const transfer = [];
    for (const k of ["V", "I", "w", "t"]) {
      if (r[k]) { msg[k] = Float64Array.from(r[k]); transfer.push(msg[k].buffer); }
    }
    self.postMessage(msg, transfer);
  } finally {
    pyParams.destroy();
    if (out) out.destroy();
  }
}

function tidy(err) {
  // keep the useful end of a Python traceback
  const s = String((err && err.message) || err);
  const lines = s.trim().split("\n");
  const start = lines.findIndex((l) => l.includes('File "user_model.py"'));
  return (start >= 0 ? lines.slice(start) : lines.slice(-6)).join("\n");
}
