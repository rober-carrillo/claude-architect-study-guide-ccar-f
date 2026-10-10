/* Shared behaviour for every page: navigation, theme, progress storage,
   the question widget, embedded quizzes and "section studied" tracking.
   Progress lives in this browser's localStorage only. */
(function () {
  "use strict";

  const body = document.body;
  const BASE = body.dataset.base || "";
  const PAGE = body.dataset.page || "";
  const PREFIX = "cca1:";

  // ---------- Storage (always wrapped: storage can be blocked) ----------
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) {}
    },
    keys(prefix) {
      const out = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREFIX + prefix)) out.push(k.slice(PREFIX.length));
        }
      } catch (e) {}
      return out;
    },
    clearAll() {
      try {
        Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
      } catch (e) {}
    },
  };

  // ---------- Theme ----------
  const THEMES = ["system", "light", "dark"];
  function applyTheme(t) {
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }
  applyTheme(store.get("theme", "system"));

  // ---------- Top bar ----------
  const NAV = [
    ["home", "index.html", "Home"],
    ["exam", "modules/exam.html", "Exam & scenarios"],
    ["d1", "modules/d1-agentic.html", "D1 Agents"],
    ["d2", "modules/d2-tools-mcp.html", "D2 Tools & MCP"],
    ["d3", "modules/d3-claude-code.html", "D3 Claude Code"],
    ["d4", "modules/d4-prompting.html", "D4 Prompts"],
    ["d5", "modules/d5-context.html", "D5 Context"],
    ["cases", "cases.html", "Cases"],
    ["practice", "practice.html", "Practice"],
    ["flash", "flashcards.html", "Flashcards"],
    ["cheat", "cheatsheet.html", "Cheat sheet"],
  ];
  function buildTopbar() {
    const header = document.createElement("header");
    header.className = "topbar";
    const links = NAV.map(([id, href, label]) =>
      `<a href="${BASE}${href}"${id === PAGE ? ' aria-current="page"' : ""}>${label}</a>`).join("");
    header.innerHTML = `<div class="topbar-inner">
      <a class="brand" href="${BASE}index.html">Claude <span>Architect</span></a>
      <nav class="topnav" aria-label="Site">${links}</nav>
      <button class="theme-btn" type="button" id="theme-btn"></button></div>`;
    body.prepend(header);
    const btn = header.querySelector("#theme-btn");
    const label = () => { btn.textContent = "Theme: " + store.get("theme", "system"); };
    label();
    btn.addEventListener("click", () => {
      const cur = store.get("theme", "system");
      const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
      store.set("theme", next);
      applyTheme(next);
      label();
    });
  }

  // ---------- Section TOC + "studied" tracking ----------
  function buildToc() {
    const toc = document.querySelector("nav.toc[data-auto]");
    const sections = [...document.querySelectorAll("main section.sheet[id]")].filter((s) => !s.classList.contains("hero"));
    if (toc) {
      const items = sections.map((s) => {
        const tag = s.dataset.tag || "";
        const label = s.dataset.label || (s.querySelector("h2") || {}).textContent || s.id;
        return `<li><a href="#${s.id}"><span>${tag}</span><span>${label}</span><span class="tick" data-tick="${s.id}"></span></a></li>`;
      }).join("");
      toc.innerHTML = `<h2>${toc.dataset.title || "On this page"}</h2><ol>${items}</ol>`;
    }
    if (!body.dataset.track) return;
    sections.forEach((s) => {
      const key = `read:${PAGE}#${s.id}`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost done-btn";
      const paint = () => {
        const done = store.get(key, false);
        btn.classList.toggle("is-done", done);
        btn.textContent = done ? "✓ Studied (click to undo)" : "Mark section as studied";
        const tick = document.querySelector(`[data-tick="${s.id}"]`);
        if (tick) tick.textContent = done ? "✓" : "";
      };
      btn.addEventListener("click", () => { store.set(key, !store.get(key, false)); paint(); });
      s.appendChild(btn);
      paint();
    });
  }

  // ---------- Helpers ----------
  const LETTERS = "ABCDE";
  function shuffle(arr, seed) {
    const a = arr.slice();
    let s = seed == null ? Math.random() * 1e9 : seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor((seed == null ? Math.random() : rnd()) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const SCEN = {
    1: "Customer Support Agent", 2: "Code Generation with Claude Code", 3: "Multi-Agent Research",
    4: "Developer Productivity", 5: "Claude Code in CI", 6: "Structured Data Extraction",
  };
  const DOM = {
    1: "Agentic Architecture & Orchestration", 2: "Tool Design & MCP Integration",
    3: "Claude Code Configuration & Workflows", 4: "Prompt Engineering & Structured Output",
    5: "Context Management & Reliability",
  };
  const WEIGHT = { 1: 27, 2: 18, 3: 20, 4: 20, 5: 15 };

  function recordAnswer(id, correct) {
    const r = store.get("q:" + id, { a: 0, c: 0, last: null });
    r.a += 1; if (correct) r.c += 1; r.last = correct; r.t = Date.now();
    store.set("q:" + id, r);
  }

  /* Render one question.
     opts.mode: "instant" (feedback on answer) | "exam" (selection only; reveal() later)
     opts.label: text for the header; opts.shuffle (default true); opts.onSelect(sel) */
  function renderQuestion(q, host, opts) {
    opts = Object.assign({ mode: "instant", shuffle: true, label: "" }, opts || {});
    const order = opts.order || (opts.shuffle ? shuffle(q.options.map((_, i) => i)) : q.options.map((_, i) => i));
    const wrap = document.createElement("div");
    wrap.className = "q";
    wrap.dataset.qid = q.id;
    const meta = [opts.label, `Scenario ${q.scenario} · ${SCEN[q.scenario]}`, `Task ${q.task}`].filter(Boolean);
    wrap.innerHTML = `<div class="qn">${meta.map((m) => `<span>${m}</span>`).join("")}</div>
      ${q.type === "multi" ? `<p class="pickn">Multiple response · select ${q.pick}</p>` : ""}
      <p class="stem">${q.stem}</p><div class="opts"></div>
      <div class="q-actions"></div><div class="why" hidden></div>`;
    const optsEl = wrap.querySelector(".opts");
    const actions = wrap.querySelector(".q-actions");
    const why = wrap.querySelector(".why");
    let selected = (opts.initial || []).slice();
    let revealed = false;
    const buttons = order.map((oi, pos) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.oi = oi;
      b.innerHTML = `<span>${LETTERS[pos]}</span><div>${q.options[oi]}</div>`;
      b.addEventListener("click", () => choose(oi));
      optsEl.appendChild(b);
      return b;
    });
    let checkBtn = null;
    if (q.type === "multi" && opts.mode === "instant") {
      checkBtn = document.createElement("button");
      checkBtn.type = "button";
      checkBtn.className = "btn";
      checkBtn.textContent = `Check answer`;
      checkBtn.disabled = true;
      checkBtn.addEventListener("click", reveal);
      actions.appendChild(checkBtn);
    }
    function paintSel() {
      buttons.forEach((b) => b.classList.toggle("sel", selected.includes(+b.dataset.oi)));
      if (checkBtn) checkBtn.disabled = selected.length !== q.pick;
    }
    function choose(oi) {
      if (revealed) return;
      if (q.type === "single") selected = [oi];
      else if (selected.includes(oi)) selected = selected.filter((x) => x !== oi);
      else if (selected.length < q.pick) selected = selected.concat(oi);
      paintSel();
      if (opts.onSelect) opts.onSelect(selected.slice());
      if (q.type === "single" && opts.mode === "instant") reveal();
    }
    function isCorrect() {
      return selected.length === q.answer.length && q.answer.every((a) => selected.includes(a));
    }
    function reveal(silent) {
      if (revealed) return;
      revealed = true;
      const ok = isCorrect();
      buttons.forEach((b) => {
        const oi = +b.dataset.oi;
        b.disabled = true;
        b.classList.remove("sel");
        const isAns = q.answer.includes(oi), isSel = selected.includes(oi);
        if (isAns && isSel) b.classList.add("right");
        else if (isAns) b.classList.add(q.type === "multi" || selected.length ? "missed" : "right");
        else if (isSel) b.classList.add("wrong");
        const r = document.createElement("div");
        r.className = "rat";
        r.innerHTML = (isAns ? "✓ " : "✗ ") + q.rationale[oi];
        b.appendChild(r);
      });
      if (checkBtn) checkBtn.remove();
      const correctLetters = buttons.filter((b) => q.answer.includes(+b.dataset.oi)).map((b) => b.querySelector("span").textContent).join(", ");
      why.innerHTML = `<b>${selected.length === 0 ? "Not answered" : ok ? "Correct" : "Not quite"}</b> · Answer: ${correctLetters}<br>${q.takeaway}`;
      why.hidden = false;
      if (!silent) recordAnswer(q.id, ok);
      if (opts.onReveal) opts.onReveal(ok);
    }
    paintSel();
    host.appendChild(wrap);
    return { el: wrap, reveal, isCorrect, getSelection: () => selected.slice(), q };
  }

  // ---------- Embedded quizzes on module pages ----------
  function mountQuizzes() {
    const bank = window.QBANK || [];
    document.querySelectorAll(".quiz-embed").forEach((box) => {
      const tasks = (box.dataset.tasks || "").split(",").map((s) => s.trim()).filter(Boolean);
      const doms = (box.dataset.domains || "").split(",").map(Number).filter(Boolean);
      const count = +(box.dataset.count || 4);
      const pool = bank.filter((q) => (tasks.length ? tasks.includes(q.task) : true) && (doms.length ? doms.includes(q.domain) : true));
      const head = document.createElement("h4");
      head.textContent = `Check yourself · ${pool.length} question${pool.length === 1 ? "" : "s"} on this topic`;
      const list = document.createElement("div");
      const more = document.createElement("div");
      more.className = "row";
      box.innerHTML = "";
      box.append(head, list, more);
      if (!pool.length) {
        list.innerHTML = `<p class="small">No questions tagged for this topic yet. Use the Practice page.</p>`;
        return;
      }
      function draw() {
        list.innerHTML = "";
        // Prefer questions not yet answered correctly
        const ranked = shuffle(pool).sort((a, b) => {
          const ra = store.get("q:" + a.id, null), rb = store.get("q:" + b.id, null);
          const sa = ra ? (ra.last ? 2 : 1) : 0, sb = rb ? (rb.last ? 2 : 1) : 0;
          return sa - sb;
        });
        ranked.slice(0, count).forEach((q, i) => renderQuestion(q, list, { label: `Q${i + 1}` }));
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost";
      btn.textContent = "Draw another set";
      btn.addEventListener("click", draw);
      const link = document.createElement("a");
      link.href = `${BASE}practice.html`;
      link.className = "small";
      link.textContent = "More in Practice →";
      more.append(btn, link);
      draw();
    });
  }

  // ---------- Highlighting and diagrams ----------
  function decorate() {
    try {
      if (window.hljs) document.querySelectorAll("pre.code code").forEach((el) => window.hljs.highlightElement(el));
    } catch (e) {}
    try {
      if (window.mermaid) {
        const dark = document.documentElement.dataset.theme === "dark" ||
          (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
        window.mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral", securityLevel: "strict" });
        window.mermaid.run({ querySelector: "pre.mermaid" });
      }
    } catch (e) {}
  }

  // ---------- Progress summary (used by the home page) ----------
  function progress() {
    const bank = window.QBANK || [];
    const byDom = {};
    for (let d = 1; d <= 5; d++) byDom[d] = { total: 0, seen: 0, right: 0 };
    bank.forEach((q) => {
      const r = store.get("q:" + q.id, null);
      const d = byDom[q.domain];
      d.total++;
      if (r) { d.seen++; if (r.last) d.right++; }
    });
    return { byDom, readKeys: store.keys("read:") .filter((k) => store.get(k, false)) };
  }

  window.CCA = { store, renderQuestion, shuffle, recordAnswer, progress, SCEN, DOM, WEIGHT, LETTERS, BASE };

  buildTopbar();
  buildToc();
  document.addEventListener("DOMContentLoaded", () => { mountQuizzes(); decorate(); });
  if (document.readyState !== "loading") { mountQuizzes(); decorate(); }
})();
