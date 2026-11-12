/* Application shell: loads config, builds navigation, routes between pages.
   Pages are declared in config/site.json; nothing here is page-specific. */

import { renderMarkdown, escapeHtml, codeBlock } from "./markdown.js";
import { buildSimulator } from "./simulator.js";

const ctx = { site: null, modelConfig: null, onThemeChange: [] };
const pageNodes = {};

async function loadJson(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

function waitForLibs() {
  // CDN scripts are loaded with "defer"; module scripts also run after parsing,
  // but give the deferred globals a moment if needed.
  const need = () => window.marked && window.katex && window.hljs;
  return new Promise((resolve) => {
    if (need()) return resolve();
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (need() || Date.now() - t0 > 15000) { clearInterval(iv); resolve(); }
    }, 50);
  });
}

async function main() {
  initTheme();
  const main = document.getElementById("main");
  try {
    [ctx.site, ctx.modelConfig] = await Promise.all([
      loadJson("config/site.json"), loadJson("config/model_config.json"), waitForLibs(),
    ]);
  } catch (err) {
    main.innerHTML = `<div class="alert err">Could not load the site configuration (${escapeHtml(err.message)}).
      If you opened <code>index.html</code> directly from disk, start a local web server instead
      (see README: <code>python -m http.server 8000</code>).</div>`;
    return;
  }
  if (!window.marked || !window.katex) {
    main.innerHTML = `<div class="alert err">Required libraries could not be loaded from the CDN. Check your internet connection.</div>`;
    return;
  }

  const { site } = ctx;
  document.getElementById("site-title").textContent = site.title;
  document.getElementById("site-subtitle").textContent = site.subtitle || "";
  document.title = site.title;
  document.getElementById("site-footer").innerHTML =
    [site.author, site.affiliation].filter(Boolean).map(escapeHtml).join(" · ") +
    (site.author || site.affiliation ? "<br>" : "") + escapeHtml(site.footer || "");

  const nav = document.getElementById("site-nav");
  nav.innerHTML = site.pages.map((p) => `<a href="#${p.id}" data-page="${p.id}">${escapeHtml(p.title)}</a>`).join("");
  const toggle = document.getElementById("nav-toggle");
  toggle.onclick = () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  };
  nav.addEventListener("click", () => nav.classList.remove("open"));

  main.innerHTML = "";
  window.addEventListener("hashchange", route);
  route();
}

async function route() {
  const { site } = ctx;
  const [pageId, anchor] = decodeURIComponent(location.hash.slice(1)).split("/");
  const page = site.pages.find((p) => p.id === pageId) || site.pages[0];
  document.querySelectorAll("#site-nav a").forEach((a) => a.classList.toggle("active", a.dataset.page === page.id));
  document.title = page.id === site.pages[0].id ? site.title : `${page.title} · ${site.title}`;

  const main = document.getElementById("main");
  for (const [id, node] of Object.entries(pageNodes)) node.hidden = id !== page.id;

  if (!pageNodes[page.id]) {
    const node = document.createElement("div");
    node.dataset.page = page.id;
    main.appendChild(node);
    pageNodes[page.id] = node;
    node.innerHTML = `<p class="loading-note">Loading…</p>`;
    try {
      const pctx = { ...ctx, page, pageId: page.id };
      if (page.type === "simulator") {
        await buildSimulator(node, pctx);
      } else {
        const md = await (await fetch(page.source, { cache: "no-cache" })).text();
        node.innerHTML = "";
        const doc = renderMarkdown(md, pctx);
        if (page.aside && page.aside.length) {
          // two columns: text on the left, source files on the right (stacked on narrow screens)
          const layout = document.createElement("div");
          layout.className = "doc-layout";
          const side = document.createElement("aside");
          side.className = "doc-aside";
          side.setAttribute("aria-label", "Source code");
          for (const item of page.aside) {
            const block = document.createElement("div");
            side.appendChild(block);
            codeBlock(block, item);
          }
          layout.append(doc, side);
          node.appendChild(layout);
        } else {
          node.appendChild(doc);
        }
      }
    } catch (err) {
      node.innerHTML = `<div class="alert err">Could not load this page (${escapeHtml(err.message)}).</div>`;
    }
  }
  if (anchor) {
    const target = document.getElementById(anchor);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0 });
  }
  if (page.type === "simulator" && window.Plotly) {
    // plots measured while hidden need a resize
    pageNodes[page.id].querySelectorAll(".js-plotly-plot").forEach((d) => window.Plotly.Plots.resize(d));
  }
}

/* ---------- theme ---------- */
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch { /* storage unavailable */ }
  if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
  applyHljsTheme();
  document.getElementById("theme-toggle").onclick = () => {
    const dark = isDark();
    document.documentElement.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", document.documentElement.dataset.theme); } catch { /* ignore */ }
    applyHljsTheme();
    ctx.onThemeChange.forEach((f) => f());
  };
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    applyHljsTheme();
    ctx.onThemeChange.forEach((f) => f());
  });
}
function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t) return t === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function applyHljsTheme() {
  const dark = isDark();
  document.getElementById("hljs-light").disabled = dark;
  document.getElementById("hljs-dark").disabled = !dark;
}

main();
