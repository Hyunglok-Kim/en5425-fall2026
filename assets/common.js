"use strict";
/* EN5425 course site — shared helpers. Vanilla JS, no dependencies. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function loadJSON(name) {
  const r = await fetch(`data/${name}.json`, { cache: "no-cache" });
  if (!r.ok) throw new Error(`data/${name}.json → HTTP ${r.status}`);
  return r.json();
}

/* Language toggle — same pattern as the lab dashboards: localStorage + top-right button.
   Static bilingual content uses <span class="lang-en">…</span><span class="lang-ko">…</span>
   blocks (CSS hides the inactive one via body[data-lang]); JS-rendered strings use t(en, ko).
   Toggling reloads the page so every renderer picks up the new language. */
const LANG = {
  get: () => { try { return localStorage.getItem("en5425-lang") || "en"; } catch { return "en"; } },
  set: (v) => { try { localStorage.setItem("en5425-lang", v); } catch {} },
};
const t = (en, ko) => (document.body.dataset.lang === "ko" && ko) ? ko : en;

/* Nav is injected so every page stays in sync. body[data-page] marks the active item. */
const NAV = [
  ["index", "Home", "Home", "index.html"],
  ["syllabus", "Syllabus", "강의계획", "syllabus.html"],
  ["schedule", "Schedule", "주차별 일정", "schedule.html"],
  ["journal", "Journal Club", "저널클럽", "journal.html"],
  ["capstone", "Capstone", "프로젝트", "capstone.html"],
  ["setup", "Setup", "환경 설정", "setup.html"],
  ["students", "Students", "수강생", "students.html"],
  ["submit", "Sign in / Submit", "로그인 · 제출", "/portal/login.html"],
];
function injectNav() {
  const page = document.body.dataset.page || "";
  const lang = document.body.dataset.lang;
  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.innerHTML = `<div class="in">
    <a class="brand" href="index.html">EN5425</a>
    ${NAV.map(([id, en, ko, href]) =>
      `<a class="item${id === page ? " on" : ""}" href="${href}">${lang === "ko" ? ko : en}</a>`).join("")}
    <button class="btn lang-btn" id="langBtn" type="button"
      aria-label="Switch language">${lang === "ko" ? "EN" : "한국어"}</button>
  </div>`;
  document.body.prepend(nav);
  nav.querySelector("#langBtn").addEventListener("click", () => {
    LANG.set(lang === "ko" ? "en" : "ko");
    location.reload();
  });
}
function injectFooter() {
  const f = document.createElement("footer");
  f.className = "site";
  f.innerHTML = `EN5425 / EV4240 · Deep Learning Applications in Environmental Big Data ·
    Fall 2026 · Prof. Hyunglok Kim · <a href="https://hydroai.net">HydroAI Lab</a>, GIST`;
  ($(".wrap") || document.body).appendChild(f);
}
document.addEventListener("DOMContentLoaded", () => {
  document.body.dataset.lang = LANG.get();
  injectNav();
  injectFooter();
});

/* Date helpers — weeks.json carries "date": "YYYY-MM-DD" (class day) or null until the
   weekday is fixed; every renderer must degrade gracefully when date is null. */
const fmtDate = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]} ${day}`;
};
function currentWeek(weeks) {
  const today = new Date().toISOString().slice(0, 10);
  const dated = weeks.filter((w) => w.date);
  if (!dated.length) return weeks[0];
  return dated.filter((w) => w.date <= today).pop() || dated[0];
}
