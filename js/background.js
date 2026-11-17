/* Animated background: a drifting data graph (nodes linked when close, like a
   pipeline DAG or a neural network) with embers rising through it, a nod to the
   "Fenix" in Data Fenix. Nodes near the pointer light up and link to it.
   Pure canvas, no libraries. Pauses when the tab is hidden and renders a single
   static frame when the visitor prefers reduced motion. */
(function () {
  "use strict";
  const canvas = document.getElementById("bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: -9999, y: -9999 };
  let w = 0, h = 0, dpr = 1, nodes = [], embers = [], raf = 0;

  const LINK = 150;
  const palette = () => {
    const light = document.documentElement.getAttribute("data-theme") === "light";
    return light
      ? { node: "40,60,110", link: "40,60,110", ember: ["232,87,31", "217,138,0"], nodeA: 0.35, linkA: 0.13 }
      : { node: "150,180,255", link: "120,150,230", ember: ["255,122,69", "255,181,71"], nodeA: 0.6, linkA: 0.16 };
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(110, Math.round((w * h) / 16000));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.6 + 0.8,
    }));
    embers = Array.from({ length: Math.round(count / 3) }, newEmber);
    if (reduce) draw();
  }

  function newEmber(fromBottom) {
    return {
      x: Math.random() * w,
      y: fromBottom === true ? h + 10 : Math.random() * h,
      vy: -(Math.random() * 0.55 + 0.2),
      sway: Math.random() * Math.PI * 2,
      r: Math.random() * 2 + 0.6,
      life: Math.random() * 0.6 + 0.4,
      c: Math.random() < 0.6 ? 0 : 1,
    };
  }

  function draw() {
    const p = palette();
    ctx.clearRect(0, 0, w, h);

    // links
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK * LINK) {
          const t = 1 - Math.sqrt(d2) / LINK;
          ctx.strokeStyle = `rgba(${p.link},${(t * p.linkA).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      // pointer links glow in ember colour
      const px = a.x - pointer.x, py = a.y - pointer.y;
      const pd = Math.sqrt(px * px + py * py);
      if (pd < 190) {
        const t = 1 - pd / 190;
        ctx.strokeStyle = `rgba(${p.ember[0]},${(t * 0.55).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(pointer.x, pointer.y);
        ctx.stroke();
      }
    }

    // nodes
    for (const n of nodes) {
      const px = n.x - pointer.x, py = n.y - pointer.y;
      const near = Math.max(0, 1 - Math.sqrt(px * px + py * py) / 190);
      ctx.fillStyle = near > 0 ? `rgba(${p.ember[1]},${(0.5 + near * 0.5).toFixed(3)})` : `rgba(${p.node},${p.nodeA})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + near * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // embers
    for (const e of embers) {
      const fade = Math.min(1, e.y / (h * 0.35)) * e.life;
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4);
      g.addColorStop(0, `rgba(${p.ember[e.c]},${(0.85 * fade).toFixed(3)})`);
      g.addColorStop(1, `rgba(${p.ember[e.c]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function step() {
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;
    }
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      e.sway += 0.02;
      e.y += e.vy;
      e.x += Math.sin(e.sway) * 0.3;
      if (e.y < -20) embers[i] = newEmber(true);
    }
    draw();
    raf = requestAnimationFrame(step);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; });
  window.addEventListener("pointerleave", () => { pointer.x = pointer.y = -9999; });
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !reduce) raf = requestAnimationFrame(step);
  });
  // redraw immediately on theme change so a static frame matches the theme
  new MutationObserver(() => reduce && draw()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  resize();
  if (!reduce) raf = requestAnimationFrame(step);
})();
