/* Worker for the "Simulate Your Device" page.
   Runs the visitor's model file (same structure as the template) in Pyodide,
   isolated from the main simulator. The page can terminate this worker at any
   time (Stop button). Nothing leaves the browser.

   Messages:
     UI -> worker  {type:"init", pyodideVersion, runnerUrl}
     worker -> UI  {type:"progress", stage} | {type:"ready", pythonVersion, loadMs}
     UI -> worker  {type:"run", id, code}
     worker -> UI  {type:"result", id, elapsedMs, V, I, w, x_exp?, y_exp?, nNonfinite, stdout}
     worker -> UI  {type:"error", id?, stage, message}
*/
let pyodide = null, runner = null;
const OPTIONAL_PACKAGES = ["scipy", "pandas"];   // loaded only if the file imports them

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === "init") await init(m);
    else if (m.type === "run") await run(m);
  } catch (err) {
    self.postMessage({ type: "error", id: m.id, stage: m.type, message: tidy(err) });
  }
};

async function init({ pyodideVersion, runnerUrl }) {
  const t0 = performance.now();
  self.postMessage({ type: "progress", stage: "Downloading Python runtime and numpy (first visit only)…" });
  const base = `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`;
  importScripts(base + "pyodide.js");
  pyodide = await loadPyodide({ indexURL: base });
  await pyodide.loadPackage("numpy");
  const res = await fetch(runnerUrl, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${runnerUrl} (HTTP ${res.status})`);
  pyodide.FS.mkdirTree("/runner");
  pyodide.FS.writeFile("/runner/user_model_runner.py", await res.text());
  pyodide.runPython("import sys; sys.path.insert(0, '/runner'); import user_model_runner");
  runner = pyodide.pyimport("user_model_runner");
  self.postMessage({ type: "ready", pythonVersion: pyodide.runPython("import sys; sys.version.split()[0]"),
                     loadMs: performance.now() - t0 });
}

async function run({ id, code }) {
  const extra = OPTIONAL_PACKAGES.filter((p) => new RegExp(`^\\s*(import|from)\\s+${p}\\b`, "m").test(code));
  if (extra.length) {
    self.postMessage({ type: "progress", stage: `Loading ${extra.join(", ")}…` });
    await pyodide.loadPackage(extra);
  }
  self.postMessage({ type: "progress", stage: "Running your file…" });
  const t0 = performance.now();
  const out = runner.run_script(code);
  try {
    const r = out.toJs({ dict_converter: Object.fromEntries });
    const msg = { type: "result", id, elapsedMs: performance.now() - t0, nNonfinite: r.n_nonfinite, stdout: r.stdout };
    const transfer = [];
    for (const k of ["V", "I", "w", "x_exp", "y_exp"]) {
      if (r[k]) { msg[k] = Float64Array.from(r[k]); transfer.push(msg[k].buffer); }
    }
    self.postMessage(msg, transfer);
  } finally {
    out.destroy();
  }
}

function tidy(err) {
  // keep the useful end of a Python traceback
  const s = String((err && err.message) || err);
  const lines = s.trim().split("\n");
  const start = lines.findIndex((l) => l.includes('File "user_model.py"'));
  return (start >= 0 ? lines.slice(start) : lines.slice(-6)).join("\n");
}
