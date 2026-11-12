/* Markdown + LaTeX renderer with small directives for the documentation pages.

   Math:        $inline$   and   $$display$$   (KaTeX)
   Directives (each on its own line):
     {{toc}}                                         table of contents of the page
     {{param-table}}                                 parameter table generated from config/model_config.json
     {{code src="path" lang="python" title="..."}}  syntax-highlighted source file with copy/download
*/

const MATH_TOKEN = (i) => `@@MATH${i}@@`;

export function renderMarkdown(text, ctx) {
  const math = [];
  const directives = [];

  // 1. directives on their own line
  text = text.replace(/^\{\{\s*([\w-]+)([^}]*)\}\}\s*$/gm, (_, name, args) => {
    directives.push({ name, args: parseArgs(args) });
    return `\n<div class="directive" data-directive="${directives.length - 1}"></div>\n`;
  });

  // 2. protect math outside code (split on fenced and inline code)
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  text = parts.map((seg, i) => {
    if (i % 2 === 1) return seg;                // code: leave untouched
    seg = seg.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => { math.push({ tex, display: true }); return MATH_TOKEN(math.length - 1); });
    seg = seg.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (_, pre, tex) => { math.push({ tex, display: false }); return pre + MATH_TOKEN(math.length - 1); });
    return seg;
  }).join("");

  // 3. markdown
  let html = window.marked.parse(text, { gfm: true });

  // 4. restore math
  html = html.replace(/@@MATH(\d+)@@/g, (_, i) => {
    const m = math[+i];
    try {
      return window.katex.renderToString(m.tex, { displayMode: m.display, throwOnError: false });
    } catch { return m.tex; }
  });

  const el = document.createElement("article");
  el.className = "doc";
  el.innerHTML = html;

  // tables scroll horizontally on small screens
  el.querySelectorAll("table").forEach((t) => {
    const w = document.createElement("div");
    w.className = "table-wrap";
    t.replaceWith(w);
    w.appendChild(t);
  });
  // heading anchors
  el.querySelectorAll("h2, h3").forEach((h) => {
    h.id = h.id || slug(h.textContent);
  });
  // directives
  el.querySelectorAll(".directive").forEach((d) => {
    const spec = directives[+d.dataset.directive];
    hydrate(d, spec, el, ctx);
  });
  return el;
}

function parseArgs(s) {
  const out = {};
  s.replace(/(\w+)="([^"]*)"/g, (_, k, v) => { out[k] = v; });
  return out;
}

export function slug(s) {
  return s.toLowerCase().trim().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
}

function hydrate(node, spec, page, ctx) {
  if (!spec) return;
  if (spec.name === "toc") {
    const items = [...page.querySelectorAll("h2")];
    if (!items.length) { node.remove(); return; }
    node.className = "toc card";
    node.innerHTML = `<strong>On this page</strong><ol>${items.map((h) =>
      `<li><a href="#${ctx.pageId}/${h.id}">${escapeHtml(h.textContent)}</a></li>`).join("")}</ol>`;
  } else if (spec.name === "param-table") {
    node.replaceWith(paramTable(ctx.modelConfig));
  } else if (spec.name === "code") {
    codeBlock(node, spec.args);
  } else {
    node.innerHTML = `<div class="alert warn">Unknown directive: ${escapeHtml(spec.name)}</div>`;
  }
}

/* ---------- parameter table generated from the config ---------- */
export function fmtNum(x) {
  if (typeof x !== "number" || !isFinite(x)) return String(x);
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a >= 1e4 || a < 1e-3) {
    const [m, e] = x.toExponential(4).split("e");
    return `${parseFloat(m)}e${e.replace("+", "")}`;
  }
  return String(parseFloat(x.toPrecision(6)));
}

function tex(s) {
  try { return window.katex.renderToString(s, { throwOnError: false }); } catch { return escapeHtml(s); }
}

function paramTable(cfg) {
  const wrap = document.createElement("div");
  const rows = [];
  const groups = [["Adjustable parameters (sliders)", cfg.parameters.sliders, true],
                  ["Constants and fixed values", cfg.parameters.fixed, false]];
  for (const [title, list, isSlider] of groups) {
    rows.push(`<tr><th colspan="7" style="background:var(--accent-soft);color:var(--accent)">${title}</th></tr>`);
    for (const p of list) {
      if (p.show_in_table === false) continue;
      let value, range = "—", codeName = `<code>${escapeHtml(p.name)}</code>`;
      if (p.variant_specific) {
        const parts = cfg.variants.map((v) => ({ v, spec: p.variants[v.id], name: p.name + (v.param_suffix || "") }));
        codeName = parts.map((x) => `<code>${escapeHtml(x.name)}</code>`).join("<br>");
        value = parts.map((x) => `${escapeHtml(x.v.short_label || x.v.label)}: <code>${fmtNum(x.spec.default)}</code>`).join("<br>");
        if (isSlider) range = parts.map((x) => `${escapeHtml(x.v.short_label || x.v.label)}: ${fmtNum(x.spec.min)} – ${fmtNum(x.spec.max)}`).join("<br>");
      } else {
        value = `<code>${fmtNum(p.default)}</code>`;
        if (isSlider) range = `${fmtNum(p.min)} – ${fmtNum(p.max)}${p.scale === "log" ? " (log)" : ""}`;
      }
      const units = p.units ? escapeHtml(p.units) : (p.integer ? "—" : `<span class="todo">to be added</span>`);
      const note = [p.description, p.classification_note].filter(Boolean).map(escapeHtml).join(" ");
      rows.push(`<tr>
        <td>${codeName}</td>
        <td>${tex(p.symbol || p.name)}</td>
        <td>${value}</td>
        <td>${units}</td>
        <td>${escapeHtml(p.classification || "")}</td>
        <td>${range}</td>
        <td>${note}</td></tr>`);
    }
  }
  wrap.className = "table-wrap";
  wrap.innerHTML = `<table><thead><tr><th>Code name</th><th>Symbol</th><th>Value in code</th><th>Units</th>
    <th>Type</th><th>Slider range</th><th>Description / notes</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
  return wrap;
}

/* ---------- source code viewer ---------- */
export async function codeBlock(node, { src, lang = "plaintext", title }) {
  node.className = "code-block card";
  node.innerHTML = `<div class="code-head"><span class="file">${escapeHtml(title || src)}</span>
    <span class="actions">
      <button class="btn" data-act="copy">Copy</button>
      <a class="btn" href="${encodeURI(src)}" download>Download</a>
      <button class="btn" data-act="expand">Expand</button>
    </span></div><div class="code-body"><div class="loader">Loading ${escapeHtml(src)}…</div></div>`;
  const body = node.querySelector(".code-body");
  let text = "";
  try {
    const res = await fetch(src, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = (await res.text()).replace(/\r\n/g, "\n");
  } catch (err) {
    body.innerHTML = `<div class="alert err">Could not load <code>${escapeHtml(src)}</code>: ${escapeHtml(err.message)}</div>`;
    return;
  }
  let highlighted;
  try {
    const language = window.hljs.getLanguage(lang) ? lang : "plaintext";
    highlighted = window.hljs.highlight(text, { language }).value;
  } catch { highlighted = escapeHtml(text); }
  const n = text.replace(/\n$/, "").split("\n").length;
  const ln = Array.from({ length: n }, (_, i) => i + 1).join("\n");
  body.innerHTML = `<pre><span class="ln" aria-hidden="true">${ln}</span><code class="hljs">${highlighted}</code></pre>`;
  node.querySelector('[data-act="copy"]').onclick = async (e) => {
    try { await navigator.clipboard.writeText(text); e.target.textContent = "Copied"; }
    catch { e.target.textContent = "Copy failed"; }
    setTimeout(() => (e.target.textContent = "Copy"), 1500);
  };
  node.querySelector('[data-act="expand"]').onclick = (e) => {
    body.classList.toggle("expanded");
    e.target.textContent = body.classList.contains("expanded") ? "Collapse" : "Expand";
  };
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
