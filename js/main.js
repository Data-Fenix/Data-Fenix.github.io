/* Portfolio interactivity: loader, theme, nav, scroll progress, staggered
   reveals, timeline fill, typewriter, counters, card tilt, project grid with
   "Explore all" expansion, lightbox, live GitHub stats and the AI assistant. */
(function () {
  "use strict";

  const GITHUB_USER = "Data-Fenix";
  // Backend of the RAG assistant (project: portfolio-rag-chatbot). Override with
  // ?backend=https://your-host once; the value is remembered in localStorage.
  const DEFAULT_BACKEND = "http://localhost:8000";
  const INITIAL_PROJECTS = 6;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
  };

  /* ---------- Loader ---------- */
  const loader = $("#loader");
  let loaderDone = false;
  function hideLoader() {
    if (loaderDone) return;
    loaderDone = true;
    document.body.classList.remove("is-loading");
    loader.classList.add("is-hidden");
    setTimeout(() => loader.remove(), 700);
  }
  window.addEventListener("load", () => setTimeout(hideLoader, 450));
  setTimeout(hideLoader, 2500); // never trap the visitor behind a slow image

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  const savedTheme = store.get("theme");
  if (savedTheme) root.setAttribute("data-theme", savedTheme);
  $("#themeToggle").addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    store.set("theme", next);
  });

  /* ---------- Mobile nav ---------- */
  const navToggle = $("#navToggle");
  const navLinks = $(".nav__links");
  navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  navLinks.addEventListener("click", (e) => { if (e.target.tagName === "A") navLinks.classList.remove("open"); });

  /* ---------- Active nav link ---------- */
  const navAnchors = $$(".nav__links a");
  const sectionObserver = new IntersectionObserver(
    (entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navAnchors.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${entry.target.id}`));
    }),
    { rootMargin: "-40% 0px -55% 0px" }
  );
  $$("main section[id]").forEach((s) => sectionObserver.observe(s));

  /* ---------- Reveal on scroll (with stagger for groups) ---------- */
  $$("[data-reveal-group]").forEach((group) => {
    Array.from(group.children).forEach((child, i) => {
      child.classList.add("reveal");
      child.style.transitionDelay = `${Math.min(i * 90, 540)}ms`;
    });
  });
  const revealObserver = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-visible"); revealObserver.unobserve(e.target); }
    }),
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  const observeReveals = (scope = document) => $$(".reveal:not(.is-visible)", scope).forEach((el) => revealObserver.observe(el));
  observeReveals();

  /* ---------- Scroll progress, back-to-top, timeline fill ---------- */
  const progress = $("#scrollProgress");
  const toTop = $("#toTop");
  const timelines = $$("[data-timeline]");
  let ticking = false;
  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    toTop.classList.toggle("is-visible", window.scrollY > 600);
    const mid = window.innerHeight * 0.6;
    timelines.forEach((t) => {
      const r = t.getBoundingClientRect();
      const filled = Math.max(0, Math.min(1, (mid - r.top) / r.height));
      t.style.setProperty("--fill", filled.toFixed(3));
    });
    ticking = false;
  }
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));

  /* ---------- Typewriter ---------- */
  const tw = $("#typewriter");
  const words = JSON.parse(tw.dataset.words);
  if (reduceMotion) tw.textContent = words[0];
  else {
    let wi = 0, ci = 0, deleting = false;
    (function tick() {
      const word = words[wi];
      tw.textContent = word.slice(0, ci);
      let delay = deleting ? 45 : 85;
      if (!deleting && ci === word.length) { delay = 1600; deleting = true; }
      else if (deleting && ci === 0) { deleting = false; wi = (wi + 1) % words.length; delay = 300; }
      ci += deleting ? -1 : 1;
      setTimeout(tick, delay);
    })();
  }

  /* ---------- Terminal animation ---------- */
  const terminalLines = [
    '<span class="c"># ml-pipeline/sagemaker.yaml</span>',
    '<span class="k">pipeline</span>: churn-prediction',
    '<span class="k">steps</span>:',
    '  - <span class="k">name</span>: preprocess   <span class="c"># PySpark on Snowflake</span>',
    '  - <span class="k">name</span>: train        <span class="c"># XGBoost, BYO container</span>',
    '  - <span class="k">name</span>: evaluate',
    '    <span class="k">gate</span>: <span class="s">"auc >= 0.85"</span>',
    '  - <span class="k">name</span>: register',
    '    <span class="k">when</span>: gate.passed',
    '  - <span class="k">name</span>: deploy       <span class="c"># Flask inference endpoint</span>',
    '<span class="k">observability</span>: [drift, cost, latency]',
    '<span class="k">genai</span>:',
    '  <span class="k">assistant</span>: rag + evals + guardrails',
    '<span class="c"># status: ✓ all checks passed</span>',
  ];
  const codeEl = $("#terminalCode");
  if (reduceMotion) codeEl.innerHTML = terminalLines.join("\n");
  else {
    let li = 0;
    setTimeout(function typeLine() {
      if (li >= terminalLines.length) return;
      codeEl.innerHTML += terminalLines[li++] + "\n";
      setTimeout(typeLine, 240);
    }, 900);
  }

  /* ---------- Counters ---------- */
  function animateCounter(el) {
    const target = parseFloat(el.dataset.counter);
    const suffix = el.dataset.suffix || "";
    const decimals = String(target).includes(".") ? 1 : 0;
    if (reduceMotion) { el.textContent = target.toFixed(decimals) + suffix; return; }
    const start = performance.now();
    (function frame(now) {
      const p = Math.min(1, (now - start) / 1300);
      el.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  }
  const counterObserver = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { animateCounter(e.target); counterObserver.unobserve(e.target); }
  }));
  $$("[data-counter]").forEach((el) => counterObserver.observe(el));

  /* ---------- 3D tilt on hover ---------- */
  function attachTilt(el) {
    if (reduceMotion || !window.matchMedia("(hover: hover)").matches) return;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-4px)`;
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  }
  $$(".tilt").forEach(attachTilt);

  /* ---------- Projects ---------- */
  const projects = window.PORTFOLIO_PROJECTS || [];
  const categories = window.PORTFOLIO_CATEGORIES || [];
  const catLabel = Object.fromEntries(categories.map((c) => [c.id, c.label]));
  const grid = $("#projectGrid");
  const filtersEl = $("#filters");
  const searchEl = $("#search");
  const countEl = $("#resultsCount");
  const moreBtn = $("#moreBtn");
  const moreLabel = $("#moreLabel");
  const ghStats = {};
  let activeCat = "all";
  let expanded = false;

  categories.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.textContent = c.label;
    b.setAttribute("aria-selected", String(c.id === activeCat));
    b.addEventListener("click", () => {
      activeCat = c.id;
      $$("button", filtersEl).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      renderProjects();
    });
    filtersEl.appendChild(b);
  });
  searchEl.addEventListener("input", renderProjects);
  moreBtn.addEventListener("click", () => {
    expanded = !expanded;
    renderProjects();
    if (!expanded) $("#projects").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function relativeDate(iso) {
    if (!iso) return "";
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days < 1) return "today";
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }

  function projectCard(p, i) {
    const stats = ghStats[p.repo.toLowerCase()];
    const img = `assets/projects/${p.image}`;
    const links = [{ label: "GitHub", url: `https://github.com/${p.repo}` }]
      .concat(p.demo ? [{ label: p.demoLabel || "Live demo", url: p.demo }] : [])
      .concat(p.links || []);
    return `
      <article class="project" style="animation-delay:${Math.min(i * 60, 480)}ms">
        <a class="project__media zoomable" href="${escapeHtml(img)}" data-lightbox data-caption="${escapeHtml(p.title)}" aria-label="Open preview of ${escapeHtml(p.title)}">
          <img src="${escapeHtml(img)}" alt="Visual for ${escapeHtml(p.title)}" loading="lazy">
          <span class="project__cat">${escapeHtml(catLabel[p.category] || p.category)}</span>
          ${p.image.endsWith(".gif") ? '<span class="project__gif">GIF</span>' : ""}
        </a>
        <div class="project__body">
          <h3>${escapeHtml(p.title)}</h3>
          <p class="project__summary">${escapeHtml(p.summary)}</p>
          <div class="project__tags">${(p.tags || []).map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>
          <div class="project__foot">
            <div class="project__stats">
              <span title="GitHub stars">★ ${stats ? stats.stars : "–"}</span>
              <span title="Last push">⟳ ${stats ? relativeDate(stats.pushed) : p.year}</span>
            </div>
            <div class="project__links">
              ${links.map((l) => `<a href="${escapeHtml(l.url)}" ${l.url.startsWith("#") ? "" : 'target="_blank" rel="noopener"'}>${escapeHtml(l.label)}</a>`).join("")}
            </div>
          </div>
        </div>
      </article>`;
  }

  function renderProjects() {
    const q = searchEl.value.trim().toLowerCase();
    const browsing = activeCat !== "all" || q !== ""; // filter or search shows every match
    const matches = projects
      .filter((p) => activeCat === "all" || p.category === activeCat)
      .filter((p) => !q || [p.title, p.summary, ...(p.tags || [])].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (b.featured === true) - (a.featured === true) || b.year - a.year);
    const list = browsing || expanded ? matches : matches.slice(0, INITIAL_PROJECTS);
    const hidden = matches.length - list.length;

    countEl.textContent = browsing
      ? `${matches.length} of ${projects.length} projects`
      : `Showing ${list.length} of ${projects.length} projects`;
    grid.innerHTML = list.length ? list.map(projectCard).join("") : '<p class="empty">No projects match that search.</p>';
    $$(".project", grid).forEach(attachTilt);

    moreBtn.hidden = browsing;
    moreBtn.setAttribute("aria-expanded", String(expanded));
    moreBtn.classList.toggle("is-open", expanded);
    moreLabel.textContent = expanded ? "Show highlights only" : `Explore all projects (+${hidden} more)`;
  }
  renderProjects();

  async function loadGitHub() {
    try {
      const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100`);
      if (!res.ok) return;
      const repos = await res.json();
      repos.forEach((r) => { ghStats[r.full_name.toLowerCase()] = { stars: r.stargazers_count, pushed: r.pushed_at }; });
      const rc = $("#repoCount");
      rc.dataset.counter = String(repos.length);
      rc.textContent = String(repos.length);
      renderProjects();
    } catch (_) { /* offline or rate limited: cards keep static values */ }
  }
  loadGitHub();

  /* ---------- Lightbox ---------- */
  const lightbox = $("#lightbox");
  const lightboxImg = $("#lightboxImg");
  const lightboxCaption = $("#lightboxCaption");
  let lastFocus = null;
  function openLightbox(src, caption) {
    lastFocus = document.activeElement;
    lightboxImg.src = src;
    lightboxImg.alt = caption || "Preview";
    lightboxCaption.textContent = caption || "";
    lightbox.hidden = false;
    document.body.classList.add("no-scroll");
    $("#lightboxClose").focus();
  }
  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
    document.body.classList.remove("no-scroll");
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-lightbox]");
    if (trigger) {
      e.preventDefault();
      const img = $("img", trigger);
      openLightbox(trigger.getAttribute("href"), trigger.dataset.caption || (img && img.alt) || "");
    } else if (e.target === lightbox || e.target.id === "lightboxClose") closeLightbox();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lightbox.hidden) closeLightbox(); });

  /* ---------- AI assistant ---------- */
  const params = new URLSearchParams(location.search);
  const backend = (params.get("backend") || store.get("assistantBackend") || DEFAULT_BACKEND).replace(/\/$/, "");
  if (params.get("backend")) store.set("assistantBackend", backend);
  const statusEl = $("#assistantStatus");
  const log = $("#chatLog");
  const form = $("#chatForm");
  const input = $("#chatInput");
  const sendBtn = $("#chatSend");
  let backendOnline = false;
  const history = [];

  async function checkBackend() {
    try {
      const res = await fetch(`${backend}/health`, { signal: AbortSignal.timeout(3000) });
      backendOnline = res.ok;
    } catch (_) { backendOnline = false; }
    statusEl.textContent = backendOnline ? "Online · Claude-powered" : "Answers from Lahiru's portfolio";
    statusEl.className = `status ${backendOnline ? "status--on" : "status--off"}`;
  }
  checkBackend();

  function sourcesEl(sources) {
    const src = document.createElement("div");
    src.className = "msg__sources";
    src.innerHTML = "Sources: " + sources
      .map((s, i) => `<a href="${escapeHtml(s.url || "#")}" target="_blank" rel="noopener">[${i + 1}] ${escapeHtml(s.title)}</a>`)
      .join("");
    return src;
  }
  function addMessage(role, text, sources) {
    const wrap = document.createElement("div");
    wrap.className = `msg msg--${role}`;
    const bubble = document.createElement("div");
    bubble.className = "msg__bubble";
    bubble.textContent = text;
    wrap.appendChild(bubble);
    if (sources && sources.length) bubble.appendChild(sourcesEl(sources));
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  // Offline mode: retrieval + extractive answers over the full knowledge base (js/assistant-offline.js).
  function localAnswer(question) {
    if (window.OfflineAssistant) return window.OfflineAssistant.answer(question, history);
    return { text: "The assistant is unavailable right now. Please reach out on LinkedIn.", sources: [] };
  }

  // Reveal an offline answer word by word so it feels like the live assistant.
  async function typeOut(bubble, text) {
    if (reduceMotion) { bubble.textContent = text; return; }
    const parts = text.split(/(\s+)/);
    let shown = "";
    for (let i = 0; i < parts.length; i++) {
      shown += parts[i];
      if (i % 3 === 0 || i === parts.length - 1) {
        bubble.textContent = shown;
        log.scrollTop = log.scrollHeight;
        await new Promise((r) => setTimeout(r, 14));
      }
    }
  }

  async function streamAnswer(question) {
    const bubble = addMessage("bot", "");
    bubble.parentElement.classList.add("msg--typing");
    let full = "", sources = [];
    try {
      const res = await fetch(`${backend}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history: history.slice(-6) }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop();
        for (const ev of events) {
          const line = ev.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = JSON.parse(line.slice(5));
          if (payload.type === "delta") { full += payload.text; bubble.textContent = full; log.scrollTop = log.scrollHeight; }
          else if (payload.type === "sources") sources = payload.sources;
          else if (payload.type === "error") throw new Error(payload.message);
        }
      }
    } catch (_) {
      checkBackend();
      const fb = localAnswer(question);
      full = fb.text;
      sources = fb.sources;
      bubble.textContent = full;
    }
    bubble.parentElement.classList.remove("msg--typing");
    if (sources.length) bubble.appendChild(sourcesEl(sources));
    history.push({ role: "user", content: question }, { role: "assistant", content: full });
  }

  async function ask(question) {
    const q = question.trim();
    if (!q) return;
    addMessage("user", q);
    $("#chatSuggestions").hidden = true; // give the conversation the room once it starts
    input.value = "";
    sendBtn.disabled = true;
    if (backendOnline) await streamAnswer(q);
    else {
      const fb = localAnswer(q);
      const bubble = addMessage("bot", "");
      bubble.parentElement.classList.add("msg--typing");
      await new Promise((r) => setTimeout(r, 300));
      await typeOut(bubble, fb.text);
      bubble.parentElement.classList.remove("msg--typing");
      if (fb.sources.length) bubble.appendChild(sourcesEl(fb.sources));
      history.push({ role: "user", content: q }, { role: "assistant", content: fb.text });
    }
    sendBtn.disabled = false;
    input.focus();
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });
  $$("#chatSuggestions button").forEach((b) => b.addEventListener("click", () => ask(b.textContent)));

  /* ---------- Floating assistant widget ---------- */
  const fab = $("#chatFab");
  const panel = $("#chatPanel");
  const hint = $("#chatHint");
  function setChat(open) {
    panel.classList.toggle("is-open", open);
    fab.classList.toggle("is-open", open);
    panel.setAttribute("aria-hidden", String(!open));
    fab.setAttribute("aria-expanded", String(open));
    fab.setAttribute("aria-label", open ? "Close AI assistant" : "Open AI assistant");
    hint.classList.remove("is-visible");
    if (open) { store.set("chatHintSeen", "1"); checkBackend(); setTimeout(() => input.focus(), 250); }
  }
  fab.addEventListener("click", () => setChat(!panel.classList.contains("is-open")));
  $("#chatClose").addEventListener("click", () => { setChat(false); fab.focus(); });
  // Any link to #assistant (hero button, project cards, GenAI card) opens the widget.
  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href="#assistant"]');
    if (link) { e.preventDefault(); setChat(true); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.hidden && panel.classList.contains("is-open")) { setChat(false); fab.focus(); }
  });
  // Introduce the assistant once, a few seconds after the page settles.
  if (!store.get("chatHintSeen")) {
    setTimeout(() => { if (!panel.classList.contains("is-open")) hint.classList.add("is-visible"); }, 4000);
    setTimeout(() => hint.classList.remove("is-visible"), 12000);
  }
  if (new URLSearchParams(location.search).has("chat")) setChat(true);

  $("#year").textContent = new Date().getFullYear();
})();
