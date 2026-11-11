/* Interactive simulator page.
   - Builds every control from config/model_config.json (nothing hard-coded).
   - Sends parameters to the Python worker (sim-worker.js) and plots the result.
   - Only arrays returned by the Python model are plotted; curves whose status
     is "invalid" are never drawn (architecture/API.md, section 4). */

import { renderMarkdown, fmtNum, escapeHtml } from "./markdown.js";

const SLIDER_STEPS = 1000;

export async function buildSimulator(root, ctx) {
  const { modelConfig: cfg, site } = ctx;
  const variants = cfg.variants;
  const state = initialState(cfg);
  let worker = null, ready = false, reqId = 0, lastShown = 0, lastResult = null, info = {};
  let debounceTimer = null;
  const view = { cycles: "all", show: { empirical: true, ab_initio: true, experimental: site.plot.show_experimental_by_default !== false } };

  /* ---------- layout ---------- */
  root.innerHTML = "";
  if (ctx.page.intro) {
    try {
      const md = await (await fetch(ctx.page.intro, { cache: "no-cache" })).text();
      const intro = renderMarkdown(md, ctx);
      intro.classList.add("sim-intro");
      root.appendChild(intro);
    } catch { /* intro is optional */ }
  }
  const grid = el("div", "sim-grid");
  const controls = el("aside", "controls card");
  const plots = el("section", "plots");
  grid.append(controls, plots);
  root.appendChild(grid);

  /* ---------- controls ---------- */
  const head = el("div", "controls-head");
  head.innerHTML = `<h2>Parameters</h2>`;
  const resetAll = button("Reset all", "btn");
  head.appendChild(resetAll);
  controls.appendChild(head);

  const shared = cfg.parameters.sliders.filter((p) => !p.variant_specific);
  const specific = cfg.parameters.sliders.filter((p) => p.variant_specific);
  const paramWidgets = [];

  controls.appendChild(group("Shared by both models", null, shared.map((p) => paramControl(p, null))));
  for (const v of variants) {
    controls.appendChild(group(v.label, v, specific.map((p) => paramControl(p, v.id))));
  }
  const fixedNote = el("div", "group");
  fixedNote.innerHTML = `<div class="group-title">Fixed in this version</div>
    <div style="font-size:12.5px;color:var(--ink-2)">${cfg.parameters.fixed.map((p) =>
      `<code style="font-size:11.5px">${escapeHtml(p.name)}</code>&nbsp;=&nbsp;${fmtNum(p.default)}${p.units ? "&nbsp;" + escapeHtml(p.units) : ""}`).join(" · ")}
    <br><span style="color:var(--ink-3)">Values from the original code. They can be made into sliders in <code>config/model_config.json</code>.</span></div>`;
  controls.appendChild(fixedNote);

  resetAll.onclick = () => { paramWidgets.forEach((w) => w.reset(false)); schedule(); };

  /* ---------- plots ---------- */
  const ivCard = el("div", "card plot-card");
  ivCard.innerHTML = `<div class="plot-toolbar"><h2>Current–voltage hysteresis (semilog)</h2>
    <div class="toggles">
      ${variants.map((v) => `<label><input type="checkbox" data-show="${v.id}" checked>
        <span class="swatch ${v.plot_style.dash === "dot" ? "dot" : ""}" style="background:${colorFor(v.id)};border-color:${colorFor(v.id)}"></span>${escapeHtml(shortLabel(v.label))}</label>`).join("")}
      <label><input type="checkbox" data-show="experimental" ${view.show.experimental ? "checked" : ""}>
        <span style="color:var(--curve-exp)">○</span>Experimental</label>
      <label title="Display only: the simulation always runs all cycles">Show
        <select data-cycles style="font:inherit;font-size:12.5px;padding:1px 4px;border-radius:5px;border:1px solid var(--line);background:var(--surface);color:var(--ink)">
          <option value="all">all cycles</option><option value="last">last cycle</option></select></label>
    </div></div>
    <div class="plot" id="iv-plot"><div class="loader">Preparing…</div></div>
    <div id="sim-alerts"></div>
    <div class="status" id="sim-status"><span><span class="dot busy"></span>Starting Python runtime…</span></div>`;
  plots.appendChild(ivCard);

  const wCard = el("div", "card plot-card");
  wCard.innerHTML = `<div class="plot-toolbar"><h2>State variable over time</h2>
    <div class="toggles" style="font-size:12.5px;color:var(--ink-3)">w = 0: OFF (HRS) · w = 1: ON (LRS)</div></div>
    <div class="plot small" id="w-plot"></div>
    <table class="summary-table" id="sim-summary"></table>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn" id="dl-csv" disabled>Download data (CSV)</button>
      <button class="btn" id="dl-params">Download parameters (JSON)</button>
    </div>`;
  plots.appendChild(wCard);

  ivCard.querySelectorAll("[data-show]").forEach((cb) => {
    cb.onchange = () => { view.show[cb.dataset.show] = cb.checked; draw(); };
  });
  ivCard.querySelector("[data-cycles]").onchange = (e) => { view.cycles = e.target.value; draw(); };
  wCard.querySelector("#dl-csv").onclick = downloadCsv;
  wCard.querySelector("#dl-params").onclick = downloadParams;

  // experimental data are shown immediately (no simulation needed)
  let exp = null;
  try { exp = await (await fetch(cfg.experimental_data, { cache: "no-cache" })).json(); } catch { exp = null; }

  /* ---------- worker ---------- */
  startWorker();
  ctx.onThemeChange.push(() => draw());

  function startWorker() {
    try {
      worker = new Worker("frontend/js/sim-worker.js");
    } catch (err) {
      setStatus("err", `Cannot start the simulation worker: ${escapeHtml(err.message)}. Open the site through a web server (see README), not as a local file.`);
      return;
    }
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") setStatus("busy", escapeHtml(m.stage));
      else if (m.type === "ready") {
        ready = true; info = m;
        setStatus("ok", `Python runtime ready (${(m.loadMs / 1000).toFixed(1)} s)`);
        schedule(0);
      } else if (m.type === "result") {
        if (m.id < lastShown) return;          // stale
        lastShown = m.id;
        lastResult = m;
        draw();
        const latest = m.id === reqId;
        setStatus(latest ? "ok" : "busy",
          `Simulated in your browser in <b>${(m.elapsedMs / 1000).toFixed(2)} s</b> · Python ${escapeHtml(info.pythonVersion || "")} (Pyodide ${escapeHtml(info.pyodideVersion || "")}) · model <code>backend/memristor_model.py</code> v${escapeHtml(m.modelVersion)}`);
      } else if (m.type === "error") {
        setStatus("err", m.fatal
          ? `Could not load the Python runtime: ${escapeHtml(m.message)}. An internet connection is needed on first load.`
          : `Simulation error: ${escapeHtml(m.message)}`);
      }
    };
    worker.onerror = (e) => setStatus("err", `Worker error: ${escapeHtml(e.message || "unknown")}`);
    worker.postMessage({ type: "init", pyodideVersion: site.simulation.pyodide_version,
      // absolute URLs: inside the worker, relative paths would resolve against frontend/js/
      files: [["memristor_model.py", new URL("backend/memristor_model.py", document.baseURI).href],
              ["web_api.py", new URL("backend/web_api.py", document.baseURI).href]] });
    draw();
  }

  function schedule(delay = site.simulation.debounce_ms ?? 150) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(send, delay);
  }

  function send() {
    if (!ready) return;
    const req = buildRequest();
    reqId += 1;
    setStatus("busy", "Simulating…");
    worker.postMessage({ type: "simulate", id: reqId, ...req });
  }

  function buildRequest() {
    const sharedVals = {}, perVariant = { empirical: {}, ab_initio: {} };
    for (const p of cfg.parameters.fixed) sharedVals[p.name] = p.default;
    for (const p of cfg.parameters.sliders) {
      if (p.variant_specific) for (const v of variants) perVariant[v.id][p.name] = state[key(p.name, v.id)];
      else sharedVals[p.name] = state[key(p.name, null)];
    }
    return { shared: sharedVals, empirical: perVariant.empirical, ab_initio: perVariant.ab_initio,
             variants: variants.map((v) => v.id) };
  }

  /* ---------- drawing ---------- */
  function draw() {
    if (!window.Plotly) return;
    const css = getComputedStyle(document.documentElement);
    const c = (n) => css.getPropertyValue(n).trim();
    const traces = [];
    const alerts = [];
    const res = lastResult && lastResult.results;
    if (res) {
      for (const v of variants) {
        const r = res[v.id];
        if (!r) continue;
        if (r.status !== "ok") {
          alerts.push(`<div class="alert warn"><b>${escapeHtml(v.label)}:</b> not plotted. ${r.warnings.map(escapeHtml).join(" ")}</div>`);
          continue;
        }
        if (!view.show[v.id]) continue;
        const [V, I] = sliceCycles(r.V, r.I_abs, r.params);
        traces.push({
          type: "scattergl", mode: "lines", name: v.label, x: V, y: I,
          line: { color: colorFor(v.id, c), width: 2.4, dash: v.plot_style.dash === "dot" ? "dot" : "solid" },
          hovertemplate: "V = %{x:.4g}<br>|I| = %{y:.4g}<extra>" + escapeHtml(shortLabel(v.label)) + "</extra>",
        });
      }
    }
    if (exp && view.show.experimental) {
      traces.push({
        type: "scatter", mode: "markers", name: exp.label || "Experimental data", x: exp.V, y: exp.I,
        marker: { symbol: "circle-open", size: 8, color: c("--curve-exp"), line: { width: 1.6 } },
        hovertemplate: "V = %{x:.4g}<br>I = %{y:.4g}<extra>Experimental</extra>",
      });
    }
    const floor = cfg.parameters.fixed.find((p) => p.name === "current_floor");
    const layout = baseLayout(c, site.plot.x_label, site.plot.y_label, "log");
    layout.annotations = floor ? [{
      xref: "paper", yref: "paper", x: 1, y: -0.2, xanchor: "right", showarrow: false,
      text: `|I| floored at ${fmtNum(floor.default)} for display (as in the original code)`,
      font: { size: 10.5, color: c("--ink-3") },
    }] : [];
    const ivDiv = root.querySelector("#iv-plot");
    if (ivDiv.querySelector(".loader") && (traces.length || res)) ivDiv.innerHTML = "";
    if (!ivDiv.querySelector(".loader")) {
      window.Plotly.react(ivDiv, traces, layout, plotConfig("memristor_IV"));
    }
    root.querySelector("#sim-alerts").innerHTML = alerts.join("");

    // state plot
    const wDiv = root.querySelector("#w-plot");
    if (res) {
      const wt = [];
      for (const v of variants) {
        const r = res[v.id];
        if (!r || r.status !== "ok" || !view.show[v.id]) continue;
        wt.push({ type: "scattergl", mode: "lines", name: v.label, x: r.t, y: r.w,
          line: { color: colorFor(v.id, c), width: 1.8, dash: v.plot_style.dash === "dot" ? "dot" : "solid" },
          hovertemplate: "t = %{x:.4g}<br>w = %{y:.4f}<extra></extra>" });
      }
      const lw = baseLayout(c, site.plot.time_label, site.plot.state_y_label, "linear");
      lw.yaxis.range = [-0.05, 1.05];
      lw.margin.b = 48;
      if (wDiv.querySelector(".loader")) wDiv.innerHTML = "";
      window.Plotly.react(wDiv, wt, lw, plotConfig("memristor_state"));
      summary(res);
      root.querySelector("#dl-csv").disabled = false;
    } else if (!wDiv.innerHTML) {
      wDiv.innerHTML = `<div class="loader">Waiting for the first simulation…</div>`;
    }
  }

  function sliceCycles(V, I, params) {
    if (view.cycles !== "last") return [V, I];
    const n = params.pts_per_cycle;
    return [V.subarray(V.length - n), I.subarray(I.length - n)];
  }

  function summary(res) {
    const rows = variants.map((v) => {
      const r = res[v.id];
      if (!r) return "";
      if (r.status !== "ok") return `<tr><td style="font-family:var(--font-body)">${escapeHtml(shortLabel(v.label))}</td><td colspan="4">not valid</td></tr>`;
      let wmin = Infinity, wmax = -Infinity, imin = Infinity, imax = -Infinity;
      for (let i = 0; i < r.w.length; i++) {
        if (r.w[i] < wmin) wmin = r.w[i];
        if (r.w[i] > wmax) wmax = r.w[i];
        if (r.I_abs[i] < imin) imin = r.I_abs[i];
        if (r.I_abs[i] > imax) imax = r.I_abs[i];
      }
      return `<tr><td style="font-family:var(--font-body)">${escapeHtml(shortLabel(v.label))}</td>
        <td>${wmin.toFixed(4)}</td><td>${wmax.toFixed(4)}</td><td>${fmtNum(imin)}</td><td>${fmtNum(imax)}</td></tr>`;
    }).join("");
    root.querySelector("#sim-summary").innerHTML =
      `<thead><tr><th>Model</th><th>min w</th><th>max w</th><th>min |I|</th><th>max |I|</th></tr></thead><tbody>${rows}</tbody>
       <caption style="caption-side:bottom;text-align:left;font-size:11.5px;color:var(--ink-3);padding-top:6px">
       Read directly from the simulated arrays (whole run). max w ≈ 0 means the device never switched ON; min w ≈ 1 means it never switched back OFF.</caption>`;
  }

  /* ---------- downloads ---------- */
  function downloadCsv() {
    if (!lastResult) return;
    const res = lastResult.results;
    const ids = variants.map((v) => v.id).filter((id) => res[id]);
    const n = res[ids[0]].t.length;
    const cols = ["t", "V", ...ids.flatMap((id) => [`w_${id}`, `I_${id}`, `I_abs_${id}`])];
    const lines = [`# Memristor model simulation, model v${lastResult.modelVersion}. Parameters: see the JSON download.`, cols.join(",")];
    for (let i = 0; i < n; i++) {
      const row = [res[ids[0]].t[i], res[ids[0]].V[i]];
      for (const id of ids) row.push(res[id].w[i], res[id].I[i], res[id].I_abs[i]);
      lines.push(row.map((x) => x.toPrecision(10)).join(","));
    }
    save(new Blob([lines.join("\n")], { type: "text/csv" }), "memristor_simulation.csv");
  }

  function downloadParams() {
    const out = { model_version: lastResult?.modelVersion, request: buildRequest() };
    save(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }), "memristor_parameters.json");
  }

  /* ---------- controls ---------- */
  function paramControl(p, variantId) {
    const spec = variantId ? p.variants[variantId] : p;
    const k = key(p.name, variantId);
    const isLog = p.scale === "log";
    const lo = isLog ? Math.log10(spec.min) : spec.min;
    const hi = isLog ? Math.log10(spec.max) : spec.max;
    const toPos = (x) => {
      const u = isLog ? Math.log10(x) : x;
      return Math.round(((u - lo) / (hi - lo)) * SLIDER_STEPS);
    };
    const fromPos = (pos) => {
      const u = lo + (pos / SLIDER_STEPS) * (hi - lo);
      const x = Number((isLog ? 10 ** u : u).toPrecision(5));
      return p.integer ? Math.round(x) : x;
    };
    const node = el("div", "param");
    const unitsHtml = p.units ? escapeHtml(p.units) : `<span title="Units not stated in source; to be added">—</span>`;
    node.innerHTML = `
      <div class="param-top">
        <label class="param-label" for="in-${k}">${escapeHtml(p.label)} <span class="param-name">${escapeHtml(p.name)}</span></label>
      </div>
      <div class="param-row">
        <input type="range" id="rg-${k}" min="0" max="${SLIDER_STEPS}" step="1" aria-label="${escapeHtml(p.label)}">
        <input class="param-value" id="in-${k}" inputmode="decimal" spellcheck="false">
        <span class="param-units ${p.units ? "" : "missing"}">${unitsHtml}</span>
        <button class="param-reset" title="Reset to value in code (${fmtNum(spec.default)})" aria-label="Reset">↺</button>
      </div>
      <div class="param-range"><span>${fmtNum(spec.min)}</span><span>${isLog ? "log scale" : ""}</span><span>${fmtNum(spec.max)}</span></div>`;
    const range = node.querySelector("input[type=range]");
    const box = node.querySelector(".param-value");
    const sync = () => {
      range.value = Math.min(SLIDER_STEPS, Math.max(0, toPos(state[k])));
      box.value = fmtNum(state[k]);
      box.classList.remove("invalid");
      node.classList.toggle("changed", state[k] !== spec.default);
      box.title = (state[k] < spec.min || state[k] > spec.max) ? "Outside the slider range" : "";
    };
    range.oninput = () => { state[k] = fromPos(+range.value); sync(); schedule(); };
    box.onchange = () => {
      const x = Number(box.value.trim());
      if (!isFinite(x) || box.value.trim() === "" || (isLog && x <= 0) || (p.integer && !Number.isInteger(x))) { box.classList.add("invalid"); return; }
      state[k] = x; sync(); schedule();
    };
    box.onkeydown = (e) => { if (e.key === "Enter") box.onchange(); };
    const reset = (run = true) => { state[k] = spec.default; sync(); if (run) schedule(); };
    node.querySelector(".param-reset").onclick = () => reset(true);
    sync();
    paramWidgets.push({ reset });
    return node;
  }

  function group(title, variant, nodes) {
    const g = el("div", "group");
    const sw = variant ? `<span class="swatch ${variant.plot_style.dash === "dot" ? "dot" : ""}" style="background:${colorFor(variant.id)};border-color:${colorFor(variant.id)}"></span>` : "";
    g.innerHTML = `<div class="group-title">${sw}${escapeHtml(title)}</div>`;
    nodes.forEach((n) => g.appendChild(n));
    return g;
  }

  function setStatus(kind, html) {
    const s = root.querySelector("#sim-status");
    if (s) s.innerHTML = `<span><span class="dot ${kind}"></span>${html}</span>`;
  }
}

/* ---------- helpers ---------- */
function initialState(cfg) {
  const s = {};
  for (const p of cfg.parameters.sliders) {
    if (p.variant_specific) for (const [v, spec] of Object.entries(p.variants)) s[key(p.name, v)] = spec.default;
    else s[key(p.name, null)] = p.default;
  }
  return s;
}
const key = (name, variant) => (variant ? `${name}__${variant}` : name);
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function button(text, cls) { const b = el("button", cls); b.textContent = text; return b; }
function shortLabel(s) { return s.replace(/\s*\([^)]*\)\s*/g, " ").trim().replace(/\s+model$/i, ""); }
function colorFor(id, c) {
  const varName = id === "empirical" ? "--curve-emp" : "--curve-ab";
  if (c) return c(varName);
  return `var(${varName})`;
}
function baseLayout(c, xTitle, yTitle, yType) {
  const axis = (title, type) => ({
    title: { text: title, font: { size: 13, color: c("--ink-2") } }, type,
    gridcolor: c("--line"), zerolinecolor: c("--line"), linecolor: c("--ink-3"),
    tickfont: { color: c("--ink-2"), size: 11.5 }, showline: true, mirror: true, ticks: "outside",
    exponentformat: "power",
  });
  return {
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 70, r: 16, t: 12, b: 64 }, font: { family: "Inter, sans-serif", color: c("--ink") },
    xaxis: axis(xTitle, "linear"), yaxis: axis(yTitle, yType),
    legend: { orientation: "h", x: 0, y: 1.02, yanchor: "bottom", font: { size: 11.5, color: c("--ink-2") } },
    showlegend: false, hovermode: "closest", uirevision: "keep",
  };
}
function plotConfig(filename) {
  return { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"],
           toImageButtonOptions: { format: "png", filename, scale: 3 } };
}
function save(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
