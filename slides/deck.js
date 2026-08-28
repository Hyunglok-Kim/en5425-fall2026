"use strict";
/* EN5425 deck framework — keyboard-driven slide navigation, no dependencies.
   Keys: → ↓ Space PgDn next · ← ↑ PgUp prev · Home/End · N toggles speaker notes.
   URL hash (#7) addresses a slide directly and survives reload. */
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
  }
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
