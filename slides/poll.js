"use strict";
/* EN5425 quick polls — live YES/NO questions inside slide decks, no dependencies.
   Markup contract (see week02.html slide 8):
     <div class="quickpoll" data-pid="w02-s8-w0" data-answer="no">
       <div class="qp-row"> <span class="qp-q">question…</span> <span class="qp-ui"></span> </div>
       <div class="qp-explain" hidden> …shown to everyone when the PI reveals… </div>
     </div>
   Behaviour by origin:
     class app (tunnel / 127.0.0.1:8899) + signed in  → live voting, 2.5 s refresh
     class app, not signed in                          → question + sign-in link
     static Pages mirror or file://                    → question only (no UI)
   The PI account additionally gets the live split and reveal/hide/reset controls;
   reveal locks votes server-side and swaps the slide's gloss for .qp-explain. */
document.addEventListener("DOMContentLoaded", () => {
  const widgets = [...document.querySelectorAll(".quickpoll[data-pid]")].map((el) => ({
    el,
    pid: el.dataset.pid,
    answer: (el.dataset.answer || "").toLowerCase(),   // "yes" | "no"
    ui: el.querySelector(".qp-ui"),
    explain: el.querySelector(".qp-explain"),
    section: el.closest("section.slide"),
    state: null,          // last /api/poll payload
    shownExplain: false,  // explanation currently swapped in for the gloss
    dismissed: false,     // student clicked 접기 after reveal
  })).filter((w) => w.ui);
  if (!widgets.length) return;

  const HDR = { "X-EN5425": "1" };
  let role = null;   // "student" | "pi" | "ta" … | "anon" | "static"

  async function whoami() {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      if (r.status === 401) return "anon";
      if (!r.ok) return "static";
      const me = await r.json();
      return me.must_change ? "anon" : (me.role || "student");
    } catch { return "static"; }
  }

  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  async function refresh(w) {
    try {
      const r = await fetch(`/api/poll?pid=${encodeURIComponent(w.pid)}`, { cache: "no-store" });
      if (!r.ok) return;
      w.state = await r.json();
      render(w);
    } catch {}
  }

  async function vote(w, choice) {
    const fd = new FormData();
    fd.set("pid", w.pid); fd.set("choice", choice);
    try {
      const r = await fetch("/api/poll/vote", { method: "POST", headers: HDR, body: fd });
      if (r.ok) { w.state = Object.assign({}, w.state, await r.json(), { pid: w.pid }); render(w); }
      else refresh(w);   // e.g. 409: revealed while we hesitated
    } catch {}
  }

  async function adminSet(w, action) {
    if (action === "reset" && !confirm("Clear all votes for this question?")) return;
    const fd = new FormData();
    fd.set("pid", w.pid); fd.set("action", action);
    try {
      const r = await fetch("/api/admin/poll-state", { method: "POST", headers: HDR, body: fd });
      if (r.ok) refresh(w);
    } catch {}
  }

  function setExplain(w, on) {
    if (!w.explain || on === w.shownExplain) return;
    w.shownExplain = on;
    w.explain.hidden = !on;
    const gloss = w.section && w.section.querySelector(".gloss");
    if (gloss) gloss.style.display = on ? "none" : "";
  }

  function render(w) {
    const s = w.state, ui = w.ui;
    ui.textContent = "";

    if (role === "static") { ui.append(h("span", "qp-count", "voting opens on the class site")); return; }
    if (role === "anon") {
      const a = h("a", "qp-btn", "Sign in to vote");
      a.href = "/portal/login.html";
      ui.append(a);
      return;
    }
    if (!s) { ui.append(h("span", "qp-count", "…")); return; }

    const revealed = !!s.revealed;
    for (const c of ["yes", "no"]) {
      const b = h("button", "qp-btn", c.toUpperCase());
      if (s.my === c) b.classList.add("sel");
      if (revealed) {
        b.disabled = true;
        if (w.answer === c) b.classList.add("qp-correct");
      } else b.addEventListener("click", () => vote(w, c));
      ui.append(b);
    }

    if (s.counts && (revealed || role === "pi")) {
      const { yes, no } = s.counts, tot = yes + no;
      if (tot) {
        const bar = h("span", "qp-bar");
        const y = h("i"); y.style.width = `${(100 * yes) / tot}%`; y.style.background = "var(--accent)";
        const n = h("i"); n.style.width = `${(100 * no) / tot}%`; n.style.background = "var(--hairline)";
        bar.append(y, n);
        ui.append(bar);
      }
      ui.append(h("span", "qp-count", `YES ${yes} · NO ${no}`));
    } else {
      ui.append(h("span", "qp-count", s.total === 1 ? "1 vote in" : `${s.total} votes in`));
    }

    if (role === "pi") {
      const adm = h("span", "qp-admin");
      const mk = (label, action) => {
        const b = h("button", "qp-btn", label);
        b.addEventListener("click", () => adminSet(w, action));
        return b;
      };
      adm.append(revealed ? mk("Hide again", "hide") : mk("Reveal answer", "reveal"), mk("Reset", "reset"));
      ui.append(adm);
    }

    if (revealed && !w.dismissed) {
      setExplain(w, true);
      const x = h("button", "qp-btn qp-dismiss", "Hide explanation");
      x.addEventListener("click", () => { w.dismissed = true; setExplain(w, false); render(w); });
      ui.append(x);
    } else {
      setExplain(w, false);
      if (revealed && w.dismissed) {
        const x = h("button", "qp-btn qp-dismiss", "Show explanation");
        x.addEventListener("click", () => { w.dismissed = false; render(w); });
        ui.append(x);
      }
    }
  }

  (async () => {
    role = await whoami();
    widgets.forEach(render);
    if (role === "static" || role === "anon") return;

    const active = (w) => !w.section || w.section.classList.contains("on") ||
      !document.body.classList.contains("deck");
    widgets.filter(active).forEach(refresh);
    document.addEventListener("deck:slide", () => widgets.filter(active).forEach(refresh));
    setInterval(() => {
      if (document.hidden) return;
      widgets.filter(active).forEach(refresh);
    }, 2500);
  })();
});
