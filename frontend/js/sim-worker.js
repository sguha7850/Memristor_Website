/* Simulation worker: runs the ORIGINAL-equivalent Python model in Pyodide.
   Protocol: architecture/API.md, section 2.
   The Python files are fetched from the site itself (backend/*.py), so the code
   that runs here is byte-for-byte the code tested in validation/. */

let pyodide = null;
let runFn = null;
let busy = false;
let pending = null;

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") init(m);
  else if (m.type === "simulate") {
    pending = m;                 // latest request wins
    if (!busy && runFn) loop();
  }
};

async function init({ pyodideVersion, files }) {
  const t0 = performance.now();
  try {
    self.postMessage({ type: "progress", stage: "Downloading Python runtime (Pyodide, first visit only)…" });
    const base = `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`;
    importScripts(base + "pyodide.js");
    pyodide = await loadPyodide({ indexURL: base });

    self.postMessage({ type: "progress", stage: "Loading model source…" });
    pyodide.FS.mkdirTree("/model");
    for (const [name, url] of files) {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
      pyodide.FS.writeFile("/model/" + name, await res.text());
    }
    pyodide.runPython("import sys; sys.path.insert(0, '/model'); import memristor_model, web_api");
    runFn = pyodide.pyimport("web_api").run;
    const modelVersion = pyodide.runPython("memristor_model.MODEL_VERSION");
    const pythonVersion = pyodide.runPython("import sys; sys.version.split()[0]");
    self.postMessage({ type: "ready", modelVersion, pythonVersion, pyodideVersion,
                       loadMs: performance.now() - t0 });
    if (pending) loop();
  } catch (err) {
    self.postMessage({ type: "error", id: null, fatal: true, message: String(err && err.message || err) });
  }
}

async function loop() {
  busy = true;
  while (pending) {
    const m = pending;
    pending = null;
    const t0 = performance.now();
    let req = null, out = null;
    try {
      req = pyodide.toPy({ shared: m.shared, empirical: m.empirical,
                           ab_initio: m.ab_initio, variants: m.variants });
      out = runFn(req);
      const js = out.toJs({ dict_converter: Object.fromEntries });
      const results = {};
      const transfer = [];
      for (const [variant, r] of Object.entries(js.results)) {
        const o = { status: r.status, warnings: r.warnings, params: r.params, dt: r.dt };
        for (const k of ["t", "V", "w", "I", "I_abs"]) {
          o[k] = Float64Array.from(r[k]);
          transfer.push(o[k].buffer);
        }
        results[variant] = o;
      }
      self.postMessage({ type: "result", id: m.id, elapsedMs: performance.now() - t0,
                         modelVersion: js.model_version, results }, transfer);
    } catch (err) {
      self.postMessage({ type: "error", id: m.id, message: String(err && err.message || err) });
    } finally {
      if (req) req.destroy();
      if (out) out.destroy();
    }
    await new Promise((r) => setTimeout(r, 0));   // let newer requests arrive
  }
  busy = false;
}
