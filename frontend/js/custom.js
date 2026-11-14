/* "Simulate Your Device" page.
   Visitors edit the model file (the template's structure, with their own
   parameter values and experimental arrays x_exp / y_exp), press Run, and see
   the simulated curves. The file runs only in the visitor's browser
   (custom-worker.js, Pyodide). */

import { renderMarkdown, escapeHtml } from "./markdown.js";
import { baseLayout, plotConfig, saveBlob } from "./simulator.js";

const RUN_TIMEOUT_MS = 90000;

export async function buildCustom(root, ctx) {
  const { site, page } = ctx;
  let worker = null, ready = false, busy = false, reqId = 0, lastResult = null;
  let watchdog = null, pendingRun = false, fileName = "template";

  root.innerHTML = "";
  if (page.intro) {
    try {
      const intro = renderMarkdown(await (await fetch(page.intro, { cache: "no-cache" })).text(), ctx);
      intro.classList.add("sim-intro");
      root.appendChild(intro);
    } catch { /* optional */ }
  }

  /* ---------- model file ---------- */
  const codeCard = el("section", "card custom-card");
  codeCard.innerHTML = `
    <div class="plot-toolbar"><h2>Model file</h2>
      <div class="toggles">
        <a class="btn" href="${encodeURI(page.template)}" download>Download template</a>
        <label class="btn file-btn">Upload .py file<input type="file" accept=".py,text/x-python,text/plain" hidden data-upload-code></label>
        <button class="btn" data-reset-code>Restore template</button>
      </div></div>
    <div class="alert info custom-note">
      <b>Follow exactly this code.</b> Change only the <b>parameter values</b> and the experimental data arrays
      <code>x_exp</code> (voltage, V) and <code>y_exp</code> (current, A). Keep all variable names and the structure unchanged,
      in particular <code>V_signal</code>, <code>current</code>, <code>state</code>, <code>x_exp</code> and <code>y_exp</code>,
      which the website reads to draw the plots.
    </div>
    <textarea class="code-editor" spellcheck="false" aria-label="Python model code" data-code></textarea>
    <div class="custom-actions">
      <button class="btn primary" data-run>Run code</button>
      <button class="btn" data-stop disabled>Stop</button>
      <span class="custom-file" data-filename></span>
    </div>
    <div data-code-alert></div>`;
  root.appendChild(codeCard);
  const editor = codeCard.querySelector("[data-code]");

  /* ---------- plots ---------- */
  const plots = el("section", "custom-plots");
  plots.innerHTML = `
    <div class="card plot-card">
      <div class="plot-toolbar"><h2>Current–voltage characteristics (semilog)</h2></div>
      <div class="plot" id="cu-iv"><div class="loader">Press <b>Run code</b> to simulate.</div></div>
      <div class="status" data-status><span><span class="dot busy"></span>Starting Python runtime…</span></div>
    </div>
    <div class="card plot-card">
      <div class="plot-toolbar"><h2>State variable vs voltage</h2></div>
      <div class="plot" id="cu-wv"><div class="loader">Press <b>Run code</b> to simulate.</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="btn" data-dl disabled>Download simulation (CSV)</button>
      </div>
    </div>`;
  root.appendChild(plots);

  /* ---------- events ---------- */
  codeCard.querySelector("[data-run]").onclick = runCode;
  codeCard.querySelector("[data-stop]").onclick = () => stopWorker("Stopped.");
  codeCard.querySelector("[data-reset-code]").onclick = async () => { await fetchTemplate(); setFile("template"); };
  codeCard.querySelector("[data-upload-code]").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    editor.value = await f.text(); setFile(f.name); e.target.value = "";
  };
  plots.querySelector("[data-dl]").onclick = downloadCsv;
  ctx.onThemeChange.push(() => draw());

  await fetchTemplate();
  setFile("template");
  startWorker();

  /* ---------- worker ---------- */
  function startWorker() {
    ready = false; busy = false;
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
      if (pendingRun) { pendingRun = false; runCode(); }
    } else if (m.type === "result") {
      setRunning(false);
      if (m.id !== reqId) return;
      lastResult = m;
      alertCode("");
      draw();
      const warn = m.nNonfinite ? ` · ${m.nNonfinite} non-finite current values were skipped` : "";
      const exp = m.x_exp ? ` · ${m.x_exp.length} experimental points` : " · no x_exp / y_exp found";
      setStatus(m.nNonfinite ? "err" : "ok", `Simulated in ${(m.elapsedMs / 1000).toFixed(2)} s · ${m.V.length} points${exp}${warn} · file: ${escapeHtml(fileName)}`);
      plots.querySelector("[data-dl]").disabled = false;
    } else if (m.type === "error") {
      setRunning(false);
      if (m.stage === "init") { setStatus("err", `Could not load the Python runtime: ${escapeHtml(m.message)}. An internet connection is needed on first load.`); return; }
      setStatus("err", "Your file could not be run. See the message under the code.");
      alertCode(`<pre class="custom-error">${escapeHtml(m.message)}</pre>`);
    }
  }

  function runCode() {
    if (!ready) { pendingRun = true; setStatus("busy", "Waiting for the Python runtime…"); return; }
    if (busy) return;
    reqId += 1;
    setRunning(true, "Running your file…");
    worker.postMessage({ type: "run", id: reqId, code: editor.value });
  }

  function setRunning(on, text) {
    busy = on;
    codeCard.querySelector("[data-stop]").disabled = !on;
    codeCard.querySelector("[data-run]").disabled = on;
    clearTimeout(watchdog);
    if (on) {
      setStatus("busy", text);
      watchdog = setTimeout(() => setStatus("err",
        `Still running after ${RUN_TIMEOUT_MS / 1000} s. Press <b>Stop</b> to cancel (for example, use fewer time points).`), RUN_TIMEOUT_MS);
    }
  }

  function stopWorker(message) {
    clearTimeout(watchdog);
    if (worker) worker.terminate();
    setRunning(false);
    setStatus("err", `${message} The Python runtime is restarting…`);
    startWorker();
  }

  /* ---------- drawing ---------- */
  function draw() {
    if (!window.Plotly || !lastResult) return;
    const css = getComputedStyle(document.documentElement);
    const c = (n) => css.getPropertyValue(n).trim();
    const r = lastResult;
    const traces = [{
      type: "scattergl", mode: "lines", name: "Simulated model", x: r.V,
      y: Array.from(r.I, (x) => (isFinite(x) && x > 0 ? x : null)),
      line: { color: c("--curve-emp"), width: 2.4 },
      hovertemplate: "V = %{x:.4g}<br>I = %{y:.4g}<extra>Model</extra>",
    }];
    if (r.x_exp) {
      traces.push({ type: "scatter", mode: "markers", name: "Experimental data", x: r.x_exp,
        y: Array.from(r.y_exp, (x) => (isFinite(x) && x !== 0 ? Math.abs(x) : null)),
        marker: { symbol: "circle-open", size: 8, color: c("--curve-exp"), line: { width: 1.6 } },
        hovertemplate: "V = %{x:.4g}<br>I = %{y:.4g}<extra>Experimental</extra>" });
    }
    const iv = root.querySelector("#cu-iv");
    if (iv.querySelector(".loader")) iv.innerHTML = "";
    const layout = baseLayout(c, site.plot.x_label, site.plot.y_label, "log");
    layout.showlegend = true;
    window.Plotly.react(iv, traces, layout, plotConfig("custom_IV"));

    const wv = root.querySelector("#cu-wv");
    if (wv.querySelector(".loader")) wv.innerHTML = "";
    const lw = baseLayout(c, site.plot.x_label, site.plot.state_y_label, "linear");
    window.Plotly.react(wv, [{ type: "scattergl", mode: "lines", x: r.V, y: r.w,
      line: { color: c("--curve-emp"), width: 2 }, hovertemplate: "V = %{x:.4g}<br>w = %{y:.4f}<extra></extra>" }],
      lw, plotConfig("custom_state_vs_voltage"));
  }

  function downloadCsv() {
    if (!lastResult) return;
    const r = lastResult;
    const lines = [`# Simulation from ${fileName}`, "V_signal,current,state"];
    for (let i = 0; i < r.V.length; i++) lines.push([r.V[i], r.I[i], r.w[i]].map((x) => x.toPrecision(10)).join(","));
    saveBlob(new Blob([lines.join("\n")], { type: "text/csv" }), "custom_simulation.csv");
  }

  /* ---------- helpers ---------- */
  async function fetchTemplate() {
    try { editor.value = await (await fetch(page.template, { cache: "no-cache" })).text(); }
    catch (err) { alertCode(`Could not load the template: ${escapeHtml(err.message)}`); }
  }
  function setFile(name) {
    fileName = name;
    codeCard.querySelector("[data-filename]").textContent = name ? `Current file: ${name}` : "";
  }
  function setStatus(kind, html) {
    const s = plots.querySelector("[data-status]");
    if (s) s.innerHTML = `<span><span class="dot ${kind}"></span>${html}</span>`;
  }
  function alertCode(html) {
    codeCard.querySelector("[data-code-alert]").innerHTML = html ? `<div class="alert err">${html}</div>` : "";
  }
}

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
