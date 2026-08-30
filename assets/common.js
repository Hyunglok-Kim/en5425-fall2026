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
/* Semester tracker: W1 begins Mon 2026-08-31 (KST). */
const SEMESTER_START = "2026-08-31";
function todayKST() { return new Date(Date.now() + 9 * 3600 * 1000); }
function weekOf(dateIso) {
  const d = Math.floor((Date.parse(dateIso) - Date.parse(SEMESTER_START)) / (7 * 86400 * 1000)) + 1;
  return d;
}
function navDateChip(lang) {
  const k = todayKST();
  const iso = k.toISOString().slice(0, 10);
  const dayEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][k.getUTCDay()];
  const dayKo = ["일", "월", "화", "수", "목", "금", "토"][k.getUTCDay()];
  const day = lang === "ko" ? dayKo : dayEn;
  const w = weekOf(iso);
  let wtxt = "";
  if (w < 1) wtxt = lang === "ko" ? "1주차는 8/31 시작" : "W1 starts 8/31";
  else if (w <= 16) wtxt = lang === "ko" ? `${w}주차` : `Week ${w}`;
  return `${fmtDate(iso)} (${day})${wtxt ? " · " + wtxt : ""}`;
}
function injectNav() {
  const page = document.body.dataset.page || "";
  const lang = document.body.dataset.lang;
  const P = location.pathname.includes("/portal/") ? "../" : "";
  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.innerHTML = `<div class="in">
    <span class="brand">
      <a class="logo-chip" href="https://env1.gist.ac.kr/env1/" target="_blank" rel="noopener"
         title="GIST School of Environment and Energy Engineering"><img src="${P}assets/img/gist.png" alt="GIST"></a>
      <a class="logo-link" href="https://hydroai.net" target="_blank" rel="noopener" title="HydroAI Lab">
        <img class="logo-ha ha-light" src="${P}assets/img/hydroai_logo_black.png" alt="HydroAI Lab">
        <img class="logo-ha ha-dark" src="${P}assets/img/hydroai_logo_white.png" alt="HydroAI Lab">
      </a>
      <a class="brand-t" href="${P}index.html">EN5425 / EV4240<small>Fall 2026</small></a>
    </span>
    ${NAV.map(([id, en, ko, href]) =>
      `<a class="item${id === page ? " on" : ""}" href="${href.startsWith("/") ? P + href.slice(1) : P + href}">${lang === "ko" ? ko : en}</a>`).join("")}
    <span class="nav-date tnum">${navDateChip(lang)}</span>
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

/* ---- class gate: shared password wall (client-side — keeps outsiders/crawlers out;
   it is a curtain, not a vault. Real auth lives behind /portal sign-in). ---- */
const GATE_HASH = "4c0d0a6332aca7bac1ba8ef0dad4e1f305d9897fc595a84f37332718cb57b57f";
async function _sha256hex(txt) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function gatePassed() {
  try { return localStorage.getItem("en5425-gate") === GATE_HASH; } catch { return false; }
}
function showGate() {
  const ov = document.createElement("div");
  ov.id = "gateOverlay";
  ov.innerHTML = `<div class="gate-card">
    <p class="eyebrow" style="margin-top:0">EN5425 / EV4240 · Fall 2026</p>
    <h2 style="margin:0 0 6px">${t("Class members only", "수강생 전용 페이지")}</h2>
    <p class="sub">${t("Enter the class password from the first session.",
      "첫 수업에서 안내한 수업 비밀번호를 입력하세요.")}</p>
    <form id="gateForm">
      <input id="gatePw" type="password" autocomplete="off" autofocus
        placeholder="${t("Class password", "수업 비밀번호")}">
      <button class="btn primary" type="submit">${t("Enter", "입장")}</button>
    </form>
    <p class="sub" id="gateErr" style="min-height:18px;margin:8px 0 0;color:var(--warn)"></p>
  </div>`;
  document.body.appendChild(ov);
  const form = ov.querySelector("#gateForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const h = await _sha256hex(ov.querySelector("#gatePw").value);
    if (h === GATE_HASH) {
      try { localStorage.setItem("en5425-gate", GATE_HASH); } catch {}
      ov.remove();
    } else {
      ov.querySelector("#gateErr").textContent =
        t("Wrong password — ask a classmate or the instructor.", "비밀번호가 달라요 — 동료나 교수님께 확인하세요.");
      ov.querySelector("#gatePw").select();
    }
  });
}
document.addEventListener("DOMContentLoaded", () => {
  document.body.dataset.lang = LANG.get();
  injectNav();
  injectFooter();
  if (!gatePassed()) showGate();
});

/* Date helpers — weeks.json carries "date": "YYYY-MM-DD" (class day) or null until the
   weekday is fixed; every renderer must degrade gracefully when date is null. */
const fmtDate = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]} ${day}`;
};
function currentWeek(weeks) {
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST-anchored
  const dated = weeks.filter((w) => w.date);
  if (!dated.length) return weeks[0];
  return dated.filter((w) => w.date <= today).pop() || dated[0];
}
