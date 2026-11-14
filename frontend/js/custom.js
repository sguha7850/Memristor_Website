/* "Simulate Your Device" page.
   Visitors load a Python model file (template provided), adjust its parameters,
   optionally upload measured I-V data, and see the simulated curves. The code
   runs only in the visitor's browser (custom-worker.js, Pyodide). */

import { renderMarkdown, fmtNum, escapeHtml } from "./markdown.js";
import { baseLayout, plotConfig, saveBlob } from "./simulator.js";

const RUN_TIMEOUT_MS = 60000;
const SLIDER_STEPS = 1000;

export async function buildCustom(root, ctx) {
  const { site, page } = ctx;
  let worker = null, ready = false, loaded = false, busy = false, reqId = 0, lastResult = null;
  let info = null, values = {}, exp = null, debounce = null, watchdog = null, pendingCode = null;
  let codeText = "";

  root.innerHTML = "";
  if (page.intro) {
    try {
      const intro = renderMarkdown(await (await fetch(page.intro, { cache: "no-cache" })).text(), ctx);
      intro.classList.add("sim-intro");
      root.appendChild(intro);
    } catch { /* optional */ }
  }

  /* ---------- 1. code card ---------- */
  const codeCard = el("section", "card custom-card");
  codeCard.innerHTML = `
    <div class="plot-toolbar"><h2>1. Model file</h2>
      <div class="toggles">
        <a class="btn" href="${encodeURI(page.template)}" download>Download template</a>
        <label class="btn file-btn">Upload .py file<input type="file" accept=".py,text/x-python,text/plain" hidden data-upload-code></label>
        <button class="btn" data-reset-code>Restore template</button>
      </div></div>
    <p class="custom-hint">Edit the code below or upload your own file in the same format, then press <b>Run code</b>.
      Your code runs only in your browser; nothing is uploaded to a server.</p>
    <textarea class="code-editor" spellcheck="false" aria-label="Python model code" data-code></textarea>
    <div class="custom-actions">
      <button class="btn primary" data-run>Run code</button>
      <button class="btn" data-stop disabled>Stop</button>
      <span class="custom-file" data-filename></span>
    </div>
    <div data-code-alert></div>`;
  root.appendChild(codeCard);
  const editor = codeCard.querySelector("[data-code]");

  /* ---------- 2 + 3. controls and data, plots ---------- */
  const grid = el("div", "sim-grid");
  const controls = el("aside", "controls card");
  controls.innerHTML = `<div class="controls-head"><h2>2. Parameters</h2><button class="btn" data-reset-params disabled>Reset all</button></div>
    <div data-params><div class="group" style="color:var(--ink-3);font-size:13px">Press <b>Run code</b> to create the parameter controls.</div></div>
    <div class="group">
      <div class="group-title">3. Experimental data (optional)</div>
      <p class="custom-hint" style="margin:0 0 8px">CSV or text file with two columns: voltage (V) and current (A). A header line is allowed.</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <label class="btn file-btn">Upload data<input type="file" accept=".csv,.txt,.dat,text/csv,text/plain" hidden data-upload-exp></label>
        ${page.example_data ? `<button class="btn" data-example-exp>Load example</button>` : ""}
        <button class="btn" data-clear-exp disabled>Clear</button>
      </div>
      <div class="custom-file" data-exp-name style="margin-top:6px"></div>
    </div>`;
  const plots = el("section", "plots");
  plots.innerHTML = `
    <div class="card plot-card">
      <div class="plot-toolbar"><h2 data-plot-title>Current–voltage characteristics (semilog)</h2></div>
      <div class="plot" id="cu-iv"><div class="loader">No simulation yet.</div></div>
      <div class="status" data-status><span><span class="dot busy"></span>Starting Python runtime…</span></div>
    </div>
    <div class="card plot-card">
      <div class="plot-toolbar"><h2>State variable vs voltage</h2>
        <div class="toggles" style="font-size:12.5px;color:var(--ink-3)">Shown when simulate() returns "w"</div></div>
      <div class="plot small" id="cu-wv"><div class="loader">No state variable yet.</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="btn" data-dl disabled>Download simulation (CSV)</button>
      </div>
    </div>`;
  grid.append(controls, plots);
  root.appendChild(grid);

  /* ---------- events ---------- */
  codeCard.querySelector("[data-run]").onclick = () => loadCode(editor.value);
  codeCard.querySelector("[data-stop]").onclick = () => stopWorker("Stopped.");
  codeCard.querySelector("[data-reset-code]").onclick = async () => { await fetchTemplate(); setFile("template"); };
  codeCard.querySelector("[data-upload-code]").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    editor.value = await f.text(); setFile(f.name); e.target.value = "";
    loadCode(editor.value);
  };
  controls.querySelector("[data-reset-params]").onclick = () => {
    if (!info) return;
    for (const [k, s] of Object.entries(info.parameters)) values[k] = s.default;
    buildControls(); schedule(0);
  };
  controls.querySelector("[data-upload-exp]").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    setExp(parseTable(await f.text()), f.name); e.target.value = "";
  };
  const ex = controls.querySelector("[data-example-exp]");
  if (ex) ex.onclick = async () => {
    try { setExp(parseTable(await (await fetch(page.example_data, { cache: "no-cache" })).text()), "example data"); }
    catch (err) { alertCode(`Could not load the example data: ${escapeHtml(err.message)}`); }
  };
  controls.querySelector("[data-clear-exp]").onclick = () => setExp(null, "");
  plots.querySelector("[data-dl]").onclick = downloadCsv;
  ctx.onThemeChange.push(() => draw());

  await fetchTemplate();
  setFile("template");
  startWorker();

  /* ---------- worker ---------- */
  function startWorker() {
    ready = false; loaded = false; busy = false;
    try { worker = new Worker("frontend/js/custom-worker.js"); }
    catch (err) { setStatus("err", `Cannot start the worker: ${escapeHtml(err.message)}`); return; }
    worker.onmessage = onMessage;
    worker.onerror = (e) => setStatus("err", `Worker error: ${escapeHtml(e.message || "unknown")}`);
    worker.postMessage({ type: "init", pyodideVersion: site.simulation.pyodide_version,
                         runnerUrl: new URL("backend/user_model_runner.py", document.baseURI).href });
  }

  function onMessage(e) {
    const m = e.data;
    if (m.type === "progress") setStatus("busy", escapeHtml(m.stage));
    else if (m.type === "ready") {
      ready = true;
      setStatus("ok", `Python ${escapeHtml(m.pythonVersion)} ready (${(m.loadMs / 1000).toFixed(1)} s). Press <b>Run code</b>.`);
      if (pendingCode !== null) { const c = pendingCode; pendingCode = null; loadCode(c); }
    } else if (m.type === "loaded") {
      setRunning(false);
      info = m.info; loaded = true;
      const keep = values; values = {};
      for (const [k, s] of Object.entries(info.parameters)) values[k] = (k in keep) ? keep[k] : s.default;
      plots.querySelector("[data-plot-title]").textContent = `${info.model_name}: current–voltage characteristics (semilog)`;
      alertCode("");
      buildControls();
      schedule(0);
    } else if (m.type === "result") {
      setRunning(false);
      if (m.id !== reqId) { schedule(0); return; }        // a newer request is waiting
      lastResult = m;
      draw();
      const warn = m.nNonfinite ? ` · ${m.nNonfinite} non-finite current values were skipped` : "";
      setStatus(m.nNonfinite ? "err" : "ok", `Simulated in ${(m.elapsedMs / 1000).toFixed(2)} s · ${m.V.length} points${warn}`);
      plots.querySelector("[data-dl]").disabled = false;
    } else if (m.type === "error") {
      setRunning(false);
      if (m.stage === "init") { setStatus("err", `Could not load the Python runtime: ${escapeHtml(m.message)}`); return; }
      setStatus("err", m.stage === "load" ? "Your file could not be loaded." : "simulate() failed.");
      alertCode(`<pre class="custom-error">${escapeHtml(m.message)}</pre>`);
    }
  }

  function loadCode(code) {
    codeText = code;
    if (!ready) { pendingCode = code; setStatus("busy", "Waiting for the Python runtime…"); return; }
    if (busy) { stopWorker(null); pendingCode = code; return; }
    setRunning(true, "Loading your file…");
    worker.postMessage({ type: "load", code });
  }

  function schedule(delay = 250) {
    clearTimeout(debounce);
    debounce = setTimeout(send, delay);
  }

  function send() {
    if (!loaded) return;
    if (busy) { schedule(200); return; }
    reqId += 1;
    setRunning(true, "Simulating…");
    worker.postMessage({ type: "simulate", id: reqId, params: { ...values } });
  }

  function setRunning(on, text) {
    busy = on;
    codeCard.querySelector("[data-stop]").disabled = !on;
    clearTimeout(watchdog);
    if (on) {
      setStatus("busy", text);
      watchdog = setTimeout(() => setStatus("err",
        `Still running after ${RUN_TIMEOUT_MS / 1000} s. Press <b>Stop</b> to cancel (for example, reduce the number of cycles or points).`), RUN_TIMEOUT_MS);
    }
  }

  function stopWorker(message) {
    clearTimeout(watchdog);
    if (worker) worker.terminate();
    if (message) setStatus("err", message + " The Python runtime is restarting…");
    startWorker();
    if (codeText && pendingCode === null) pendingCode = codeText;   // reload the code once ready
  }

  /* ---------- controls ---------- */
  function buildControls() {
    const box = controls.querySelector("[data-params]");
    box.innerHTML = "";
    const g = el("div", "group");
    const entries = Object.entries(info.parameters);
    if (!entries.length) g.innerHTML = `<div style="color:var(--ink-3);font-size:13px">This file defines no PARAMETERS.</div>`;
    for (const [name, s] of entries) g.appendChild(control(name, s));
    box.appendChild(g);
    controls.querySelector("[data-reset-params]").disabled = !entries.length;
  }

  function control(name, s) {
    const node = el("div", "param");
    const hasRange = typeof s.min === "number" && typeof s.max === "number";
    const isLog = s.scale === "log";
    const steps = s.integer && hasRange ? Math.max(1, Math.round(s.max - s.min)) : SLIDER_STEPS;
    const lo = hasRange ? (isLog ? Math.log10(s.min) : s.min) : 0;
    const hi = hasRange ? (isLog ? Math.log10(s.max) : s.max) : 1;
    const toPos = (x) => Math.round((((isLog ? Math.log10(x) : x) - lo) / (hi - lo)) * steps);
    const fromPos = (pos) => {
      const u = lo + (pos / steps) * (hi - lo);
      const x = Number((isLog ? 10 ** u : u).toPrecision(5));
      return s.integer ? Math.round(x) : x;
    };
    node.innerHTML = `
      <div class="param-top"><label class="param-label">${escapeHtml(s.label)} <span class="param-name">${escapeHtml(name)}</span></label></div>
      <div class="param-row">
        ${hasRange ? `<input type="range" min="0" max="${steps}" step="1" aria-label="${escapeHtml(s.label)}">` : `<span style="flex:1"></span>`}
        <input class="param-value" inputmode="decimal" spellcheck="false" aria-label="${escapeHtml(s.label)} value">
        <span class="param-units">${escapeHtml(s.units || "")}</span>
        <button class="param-reset" title="Reset to ${escapeHtml(fmtNum(s.default))}" aria-label="Reset">↺</button>
      </div>
      ${hasRange ? `<div class="param-range"><span>${fmtNum(s.min)}</span><span>${isLog ? "log scale" : ""}</span><span>${fmtNum(s.max)}</span></div>` : ""}`;
    const range = node.querySelector("input[type=range]");
    const box = node.querySelector(".param-value");
    const sync = () => {
      if (range) range.value = Math.min(steps, Math.max(0, toPos(values[name])));
      box.value = fmtNum(values[name]);
      box.classList.remove("invalid");
      node.classList.toggle("changed", values[name] !== s.default);
    };
    if (range) range.oninput = () => { values[name] = fromPos(+range.value); sync(); schedule(); };
    box.onchange = () => {
      const x = Number(box.value.trim());
      if (box.value.trim() === "" || !isFinite(x) || (s.integer && !Number.isInteger(x)) || (isLog && x <= 0)) { box.classList.add("invalid"); return; }
      values[name] = x; sync(); schedule();
    };
    box.onkeydown = (e) => { if (e.key === "Enter") box.onchange(); };
    node.querySelector(".param-reset").onclick = () => { values[name] = s.default; sync(); schedule(); };
    sync();
    return node;
  }

  /* ---------- data ---------- */
  async function fetchTemplate() {
    try { editor.value = await (await fetch(page.template, { cache: "no-cache" })).text(); }
    catch (err) { alertCode(`Could not load the template: ${escapeHtml(err.message)}`); }
  }
  function setFile(name) { codeCard.querySelector("[data-filename]").textContent = name ? `Current file: ${name}` : ""; }
  function setExp(data, name) {
    if (data && data.V.length < 1) { alertCode("No numeric rows with two columns were found in the data file."); data = null; }
    exp = data;
    controls.querySelector("[data-exp-name]").textContent = exp ? `${name}: ${exp.V.length} points` : "";
    controls.querySelector("[data-clear-exp]").disabled = !exp;
    draw();
  }

  /* ---------- drawing ---------- */
  function draw() {
    if (!window.Plotly) return;
    const css = getComputedStyle(document.documentElement);
    const c = (n) => css.getPropertyValue(n).trim();
    const floor = (info && info.current_floor) || 1e-12;
    const traces = [];
    if (lastResult) {
      const I = Array.from(lastResult.I, (x) => (isFinite(x) ? Math.max(Math.abs(x), floor) : null));
      traces.push({ type: "scattergl", mode: "lines", name: info ? info.model_name : "Model", x: lastResult.V, y: I,
        line: { color: c("--curve-emp"), width: 2.4 }, hovertemplate: "V = %{x:.4g}<br>|I| = %{y:.4g}<extra>Model</extra>" });
    }
    if (exp) {
      traces.push({ type: "scatter", mode: "markers", name: "Experimental data", x: exp.V,
        y: exp.I.map((x) => Math.max(Math.abs(x), floor)),
        marker: { symbol: "circle-open", size: 8, color: c("--curve-exp"), line: { width: 1.6 } },
        hovertemplate: "V = %{x:.4g}<br>|I| = %{y:.4g}<extra>Experimental</extra>" });
    }
    const iv = root.querySelector("#cu-iv");
    if (traces.length) {
      if (iv.querySelector(".loader")) iv.innerHTML = "";
      const layout = baseLayout(c, site.plot.x_label, site.plot.y_label, "log");
      layout.showlegend = true;
      window.Plotly.react(iv, traces, layout, plotConfig("custom_IV"));
    }
    const wv = root.querySelector("#cu-wv");
    if (lastResult && lastResult.w) {
      if (wv.querySelector(".loader")) wv.innerHTML = "";
      const lw = baseLayout(c, site.plot.x_label, site.plot.state_y_label, "linear");
      lw.margin.b = 48;
      window.Plotly.react(wv, [{ type: "scattergl", mode: "lines", x: lastResult.V, y: lastResult.w,
        line: { color: c("--curve-emp"), width: 1.8 }, hovertemplate: "V = %{x:.4g}<br>w = %{y:.4f}<extra></extra>" }],
        lw, plotConfig("custom_state_vs_voltage"));
    } else if (lastResult) {
      wv.innerHTML = `<div class="loader">simulate() did not return "w".</div>`;
    }
  }

  function downloadCsv() {
    if (!lastResult) return;
    const cols = ["V", "I", "w", "t"].filter((k) => lastResult[k]);
    const lines = [`# ${info ? info.model_name : "Custom model"}; parameters: ${JSON.stringify(values)}`, cols.join(",")];
    for (let i = 0; i < lastResult.V.length; i++) lines.push(cols.map((k) => lastResult[k][i].toPrecision(10)).join(","));
    saveBlob(new Blob([lines.join("\n")], { type: "text/csv" }), "custom_simulation.csv");
  }

  function setStatus(kind, html) {
    const s = plots.querySelector("[data-status]");
    if (s) s.innerHTML = `<span><span class="dot ${kind}"></span>${html}</span>`;
  }
  function alertCode(html) {
    codeCard.querySelector("[data-code-alert]").innerHTML = html ? `<div class="alert err">${html}</div>` : "";
  }
}

/* Two-column numeric table (V, I) from CSV / whitespace / semicolon text. */
export function parseTable(text) {
  const V = [], I = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/[,;\t ]+/).filter(Boolean);
    if (parts.length < 2) continue;
    const a = Number(parts[0]), b = Number(parts[1]);
    if (isFinite(a) && isFinite(b)) { V.push(a); I.push(b); }
  }
  return { V, I };
}

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
