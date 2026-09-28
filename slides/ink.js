"use strict";
/* EN5425 deck ink — draw over the slides with an Apple Pencil (any stylus), no dependencies.
   A stylus draws on every deck straight away: nothing to switch on, and a pen tap that does
   not move still clicks (turns the page, zooms a figure). Fingers and the mouse keep navigating
   unless the hand tool (or D) is on. Tools: pen with pressure, highlighter, laser that fades,
   eraser that lifts whole strokes; undo; clear the slide.
   Strokes are kept per slide in viewport-relative coordinates (they survive rotation, resize
   and the projector) and persist per deck in localStorage. Never printed.
   Keys: D finger/mouse drawing on/off · ⌘Z / Ctrl+Z undo · Esc closes the tool bar. */
document.addEventListener("DOMContentLoaded", () => {
  const slides = [...document.querySelectorAll("section.slide")];
  if (!slides.length) return;
  const KEY = "en5425-ink:" + (location.pathname.split("/").pop() || "deck").replace(/\.html$/, "");
  const PALETTE = { red: "#e5322d", blue: "#2f6fed", green: "#1f9d55", ink: "" };
  const TOOL = { pen: { w: 0.0042 }, hl: { c: "#ffd60a", w: 0.022 }, laser: { c: "#ff3b30", w: 0.006 } }; // w = fraction of viewport width
  const ERASE_R = 14, TAP_MS = 300, TAP_PX = 4, LASER_MS = 900;
  const isDark = () => document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const colorOf = (c) => c === "ink" ? (isDark() ? "#f0eee6" : "#141413") : (PALETTE[c] || c);

  /* ---- state ---- */
  const store = load();      // { "<slide no>": [stroke] }, stroke = { t, c, w, pts:[[x, y, pressure]] }
  const history = {};        // { "<slide no>": [{ add: stroke } | { erase: [stroke] }] }, not persisted
  const strokesOf = (i) => store[i + 1] || (store[i + 1] = []);
  const histOf = (i) => history[i + 1] || (history[i + 1] = []);
  let cur = Math.max(0, slides.findIndex((s) => s.classList.contains("on")));
  let tool = "pen", color = "red", mode = "auto", open = false, autoOpened = false;
  let live = null, lasers = [], raf = 0, swallow = false, W = 0, H = 0;

  /* ---- canvases: main holds committed strokes, over holds the stroke in progress ---- */
  const wrap = document.createElement("div");
  wrap.id = "ink";
  const main = document.createElement("canvas"), over = document.createElement("canvas");
  wrap.append(main, over);
  document.body.appendChild(wrap);
  const mctx = main.getContext("2d"), octx = over.getContext("2d");

  function resize() {
    W = wrap.clientWidth || innerWidth; H = wrap.clientHeight || innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 3);
    for (const [c, ctx] of [[main, mctx], [over, octx]]) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    render();
  }
  function render() {
    mctx.clearRect(0, 0, W, H);
    for (const s of strokesOf(cur)) draw(mctx, s);
  }
  function path(ctx, pts) {   // smooth polyline through the midpoints
    ctx.moveTo(pts[0][0] * W, pts[0][1] * H);
    if (pts.length < 3) { const q = pts[pts.length - 1]; ctx.lineTo(q[0] * W + 0.01, q[1] * H); return; }
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      ctx.quadraticCurveTo(a[0] * W, a[1] * H, (a[0] + b[0]) / 2 * W, (a[1] + b[1]) / 2 * H);
    }
    const z = pts[pts.length - 1];
    ctx.lineTo(z[0] * W, z[1] * H);
  }
  function drawSegs(ctx, s, from) {   // pen: one segment per sample so the width can follow pressure
    const pts = s.pts, base = s.w * W;
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round"; ctx.strokeStyle = colorOf(s.c);
    if (pts.length === 1) {
      ctx.lineWidth = base * (0.6 + 0.8 * pts[0][2]);
      ctx.beginPath(); ctx.moveTo(pts[0][0] * W, pts[0][1] * H); ctx.lineTo(pts[0][0] * W + 0.01, pts[0][1] * H); ctx.stroke();
    }
    for (let i = Math.max(from, 1); i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      ctx.lineWidth = base * (0.6 + 0.4 * (a[2] + b[2]));
      ctx.beginPath(); ctx.moveTo(a[0] * W, a[1] * H); ctx.lineTo(b[0] * W, b[1] * H); ctx.stroke();
    }
    ctx.restore();
  }
  function draw(ctx, s) {
    if (!s.pts.length) return;
    if (s.t === "pen") return drawSegs(ctx, s, 0);
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round"; ctx.strokeStyle = colorOf(s.c); ctx.lineWidth = s.w * W;
    if (s.t === "hl") {   // multiply keeps dark text crisp on the light theme; plain alpha on the dark one
      ctx.globalAlpha *= isDark() ? 0.32 : 0.42;
      ctx.globalCompositeOperation = isDark() ? "source-over" : "multiply";
    } else { ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = s.w * W * 1.6; }
    ctx.beginPath(); path(ctx, s.pts); ctx.stroke();
    ctx.restore();
  }
  const frame = () => { if (!raf) raf = requestAnimationFrame(paintOver); };
  function paintOver() {   // the over canvas: fading laser trails and a highlighter in progress
    raf = 0;
    octx.clearRect(0, 0, W, H);
    const now = performance.now();
    lasers = lasers.filter((L) => !L.end || now - L.end < LASER_MS);
    for (const L of lasers) { octx.globalAlpha = L.end ? 1 - (now - L.end) / LASER_MS : 1; draw(octx, L.s); }
    octx.globalAlpha = 1;
    if (live && live.s && live.s.t === "hl") draw(octx, live.s);
    if (live && live.s && live.s.t === "pen") { drawSegs(octx, live.s, 0); live.drawn = live.s.pts.length; }
    if (lasers.some((L) => L.end)) frame();
  }
  function cursor(e) {   // eraser footprint
    octx.clearRect(0, 0, W, H);
    octx.save();
    octx.strokeStyle = colorOf("ink"); octx.globalAlpha = 0.6; octx.lineWidth = 1.5;
    octx.beginPath(); octx.arc(e.clientX, e.clientY, ERASE_R, 0, Math.PI * 2); octx.stroke();
    octx.restore();
  }

  /* ---- pointer handling (document level, capture phase, so the canvas can stay click-through) ---- */
  const INTERACTIVE = "a, button, input, textarea, select, label, summary, #inkBar, .notes, .qp-ui, .lightbox";
  function wants(e) {
    if (live || !e.isPrimary || !wrap.isConnected) return false;
    if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return false;
    if (e.pointerType === "pen") return true;
    return mode === "all" && e.button === 0;
  }
  const norm = (e) => [e.clientX / W, e.clientY / H, e.pressure > 0 ? e.pressure : 0.5];
  function down(e) {
    if (!wants(e)) return;
    e.preventDefault();
    swallow = true;
    try { wrap.setPointerCapture(e.pointerId); } catch {}
    lasers = [];
    const s = tool === "erase" ? null : { t: tool, c: tool === "pen" ? color : TOOL[tool].c, w: TOOL[tool].w, pts: [] };
    live = { id: e.pointerId, pen: e.pointerType === "pen", x0: e.clientX, y0: e.clientY, t0: e.timeStamp,
             moved: false, s, drawn: 0, pp: 0, erased: [] };
    document.body.classList.add("inking");
    if (s && s.t === "laser") lasers.push({ s, end: 0 });
    if (e.pointerType === "pen" && !open && !autoOpened) { autoOpened = true; setOpen(true); }
    feed(e);
  }
  function feed(e) {
    const co = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of co.length ? co : [e]) {
      if (!live.moved && Math.hypot(ev.clientX - live.x0, ev.clientY - live.y0) > TAP_PX) live.moved = true;
      const p = norm(ev);
      if (!live.s) { erase(p); continue; }
      if (live.s.t === "pen") { live.pp = live.pp ? 0.6 * live.pp + 0.4 * p[2] : p[2]; p[2] = live.pp; }
      live.s.pts.push(p);
    }
    if (!live.moved && e.timeStamp - live.t0 < TAP_MS) return;   // may still be a tap: keep the screen clean
    if (!live.s) cursor(e);
    else if (live.s.t === "pen") { drawSegs(octx, live.s, live.drawn); live.drawn = live.s.pts.length; }
    else frame();
  }
  function move(e) { if (live && e.pointerId === live.id) feed(e); }
  function finish(e) {
    if (!live || e.pointerId !== live.id) return;
    const l = live;
    live = null;
    document.body.classList.remove("inking");
    try { wrap.releasePointerCapture(e.pointerId); } catch {}
    const tap = !l.moved && e.timeStamp - l.t0 < TAP_MS;
    if (l.s && l.s.t === "laser") {
      if (tap) lasers = lasers.filter((L) => L.s !== l.s);
      else for (const L of lasers) if (L.s === l.s) L.end = performance.now();
      frame();
    } else {
      octx.clearRect(0, 0, W, H);
      if (l.s && !tap && l.s.pts.length) {
        l.s.pts = l.s.pts.map(([x, y, p]) => [+x.toFixed(4), +y.toFixed(4), +p.toFixed(2)]);
        strokesOf(cur).push(l.s); histOf(cur).push({ add: l.s });
        draw(mctx, l.s); save();
      }
      if (!l.s && l.erased.length) { histOf(cur).push({ erase: l.erased }); save(); }
    }
    if (tap && l.s) click(e);   // a pen tap still turns the page / opens a figure
    setTimeout(() => { swallow = false; }, 150);
  }
  function click(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el) el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window,
      clientX: e.clientX, clientY: e.clientY }));
  }
  function erase(p) {
    const list = strokesOf(cur);
    let hit = false;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i], r = ERASE_R + s.w * W / 2;
      if (s.pts.some((q) => Math.hypot((q[0] - p[0]) * W, (q[1] - p[1]) * H) < r)) { live.erased.push(...list.splice(i, 1)); hit = true; }
    }
    if (hit) render();
  }
  document.addEventListener("pointerdown", down, true);
  document.addEventListener("pointermove", move, true);
  document.addEventListener("pointerup", finish, true);
  document.addEventListener("pointercancel", finish, true);
  window.addEventListener("blur", () => { if (live) finish({ pointerId: live.id, clientX: live.x0, clientY: live.y0, timeStamp: performance.now() }); });
  /* the browser's own click after a stroke (or a pen tap) is swallowed; click() above re-issues taps */
  document.addEventListener("click", (e) => {
    if (swallow && e.isTrusted && !(e.target instanceof Element && e.target.closest("#inkBar"))) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  /* Safari drives scrolling, text selection and the long-press callout from touch events */
  const block = (e) => { if (live) e.preventDefault(); };
  for (const t of ["touchstart", "touchmove"]) document.addEventListener(t, block, { capture: true, passive: false });
  for (const t of ["selectstart", "dragstart", "contextmenu"]) document.addEventListener(t, block, true);

  /* ---- undo / clear / persistence ---- */
  function undo() {
    const op = histOf(cur).pop();
    if (!op) return;
    const list = strokesOf(cur);
    if (op.add) { const i = list.lastIndexOf(op.add); if (i >= 0) list.splice(i, 1); }
    else list.push(...op.erase);
    render(); save();
  }
  function clearSlide() {
    const list = strokesOf(cur);
    if (!list.length) return;
    histOf(cur).push({ erase: list.splice(0) });
    render(); save();
  }
  let saveT = 0;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        const out = {};
        for (const k in store) if (store[k].length) out[k] = store[k];
        if (Object.keys(out).length) localStorage.setItem(KEY, JSON.stringify(out));
        else localStorage.removeItem(KEY);
      } catch {}
    }, 250);
  }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || "{}");
      return Object.fromEntries(Object.entries(o).filter(([, v]) => Array.isArray(v) && v.every((s) => s && Array.isArray(s.pts))));
    } catch { return {}; }
  }

  /* ---- tool bar (left edge; collapsed to one quiet pen glyph until opened) ---- */
  const I = {
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    hl: '<path d="M3 21h7"/><path d="M15.5 3.5l5 5L10 19H5v-5Z"/><path d="M13 6l5 5"/>',
    laser: '<circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    erase: '<path d="M16.2 3.8l4 4L9.5 18.5H5.5l-2.7-2.7L16.2 3.8Z"/><path d="M6.3 11.3l6.4 6.4"/><path d="M4 21h16"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    clear: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
  };
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const bar = document.createElement("div");
  bar.id = "inkBar";
  const B = {};
  const add = (k, title, inner, on, cls) => {
    const b = document.createElement("button");
    b.type = "button"; b.title = title; b.setAttribute("aria-label", title); b.innerHTML = inner;
    if (cls) b.className = cls;
    b.addEventListener("click", (e) => { e.stopPropagation(); on(); });
    bar.appendChild(b); B[k] = b;
  };
  const sep = () => { const d = document.createElement("div"); d.className = "sep"; bar.appendChild(d); };
  add("toggle", "", svg(I.pen), () => setOpen(!open), "toggle");
  add("pen", "Pen", svg(I.pen), () => setTool("pen"));
  add("hl", "Highlighter", svg(I.hl), () => setTool("hl"));
  add("laser", "Laser pointer (fades)", svg(I.laser), () => setTool("laser"));
  add("erase", "Eraser (lifts whole strokes)", svg(I.erase), () => setTool("erase"));
  sep();
  for (const k in PALETTE) {
    add("c:" + k, k[0].toUpperCase() + k.slice(1), "<i></i>", () => setColor(k), "sw");
    B["c:" + k].style.setProperty("--c", PALETTE[k] || "var(--ink)");
  }
  sep();
  add("undo", "Undo (⌘Z / Ctrl+Z)", svg(I.undo), undo);
  add("clear", "Clear this slide", svg(I.clear), clearSlide);
  sep();
  add("hand", "Draw with finger / mouse too (D)", svg(I.hand), () => setMode(mode === "all" ? "auto" : "all"));
  document.body.appendChild(bar);

  function setTool(t) { tool = t; for (const k of ["pen", "hl", "laser", "erase"]) B[k].classList.toggle("sel", k === t); }
  function setColor(c) { color = c; setTool("pen"); for (const k in PALETTE) B["c:" + k].classList.toggle("sel", k === c); }
  function setMode(m) { mode = m; document.body.classList.toggle("inkall", m === "all"); B.hand.classList.toggle("sel", m === "all"); }
  function setOpen(o) {
    open = o;
    bar.classList.toggle("open", o);
    B.toggle.innerHTML = svg(o ? I.close : I.pen);
    B.toggle.title = B.toggle.ariaLabel = o ? "Close (Esc)" : "Draw on the slide (D)";
    if (!o) setMode("auto");
  }
  setTool("pen"); setColor("red"); setOpen(false);

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof Element && e.target.matches("input, textarea, select")) return;
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
      if (histOf(cur).length) { e.preventDefault(); undo(); }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "d" || e.key === "D") { e.preventDefault(); setMode(mode === "all" ? "auto" : "all"); if (mode === "all") setOpen(true); }
    else if (e.key === "Escape" && open) setOpen(false);
  });
  document.addEventListener("deck:slide", (e) => {
    cur = e.detail; lasers = [];
    octx.clearRect(0, 0, W, H);
    render();
  });
  addEventListener("resize", resize);
  resize();
});
