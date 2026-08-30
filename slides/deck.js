"use strict";
/* EN5425 deck framework — keyboard-driven slide navigation, no dependencies.
   Keys: → ↓ Space PgDn next · ← ↑ PgUp prev · Home/End · N toggles speaker notes.
   URL hash (#7) addresses a slide directly and survives reload. */
try {
  const th = localStorage.getItem("en5425-theme");
  if (th) document.documentElement.dataset.theme = th;
} catch {}
/* Decks unlock one week before their class date (00:00 KST), same as week pages;
   PI/TA accounts preview all. Fails open (e.g. file:// rehearsal, missing JSON). */
(async () => {
  const m = location.pathname.match(/week(\d+)\.html$/);
  if (!m) return;
  try {
    const { weeks } = await (await fetch("../data/weeks.json", { cache: "no-store" })).json();
    const w = (weeks || []).find((x) => x.n === parseInt(m[1], 10));
    if (!w || !w.date) return;
    const d = new Date(w.date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 7);
    const unlock = d.toISOString().slice(0, 10);
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    if (today >= unlock) return;
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      if (r.ok && (await r.json()).role === "pi") return;
    } catch {}
    const [, mm, dd] = unlock.split("-").map(Number);
    document.body.innerHTML =
      `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center">
        <div><div style="font-size:40px">&#128274;</div>
          <p style="font-size:20px;font-weight:600;margin:14px 0 6px">이 슬라이드는 강의 전주인 ${mm}월 ${dd}일에 공개됩니다.</p>
          <p style="opacity:.7;margin:0">These slides open on ${unlock}, one week before the class.</p>
          <p style="margin-top:22px"><a href="../schedule.html" style="color:inherit">&#8592; 주차별 일정 · Schedule</a></p>
        </div></div>`;
  } catch {}
})();
document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("deck");
  const slides = [...document.querySelectorAll("section.slide")];
  if (!slides.length) return;

  const counter = document.createElement("div");
  counter.id = "deckCounter";
  const hint = document.createElement("div");
  hint.id = "deckHint";
  hint.textContent = "←/→ navigate · N notes · print = PDF";
  document.body.append(counter, hint);
  setTimeout(() => { hint.style.transition = "opacity 1s"; hint.style.opacity = "0"; }, 4000);

  let cur = Math.min(Math.max((parseInt(location.hash.slice(1), 10) || 1) - 1, 0), slides.length - 1);
  function show(i) {
    cur = Math.min(Math.max(i, 0), slides.length - 1);
    slides.forEach((s, k) => s.classList.toggle("on", k === cur));
    counter.textContent = `${cur + 1} / ${slides.length}`;
    history.replaceState(null, "", `#${cur + 1}`);
    document.dispatchEvent(new CustomEvent("deck:slide", { detail: cur }));
  }
  /* in-slide YouTube: click an <a class="yt" data-id> to swap its thumbnail for an
     autoplaying embed; leaving the slide restores the thumbnail (and stops audio) */
  document.querySelectorAll("a.yt[data-id]").forEach((a) => {
    const box = a.querySelector(".ytbox");
    if (!box) return;
    const original = box.innerHTML;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${a.dataset.id}?autoplay=1&rel=0"
        style="width:100%;aspect-ratio:16/9;border:0;border-radius:8px;display:block"
        allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
    });
    document.addEventListener("deck:slide", () => {
      if (!a.closest("section.slide").classList.contains("on") && box.querySelector("iframe"))
        box.innerHTML = original;
    });
  });
  show(cur);

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(k)) { e.preventDefault(); show(cur + 1); }
    else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(k)) { e.preventDefault(); show(cur - 1); }
    else if (k === "Home") { e.preventDefault(); show(0); }
    else if (k === "End") { e.preventDefault(); show(slides.length - 1); }
    else if (k === "n" || k === "N") { document.body.classList.toggle("shownotes"); }
  });
  /* click right/left third of the screen to advance/go back */
  document.addEventListener("click", (e) => {
    if (e.target.closest("a, button, input, textarea, .notes")) return;
    const x = e.clientX / window.innerWidth;
    if (x > 0.66) show(cur + 1);
    else if (x < 0.15) show(cur - 1);
  });
  window.addEventListener("hashchange", () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (n && n - 1 !== cur) show(n - 1);
  });
});
