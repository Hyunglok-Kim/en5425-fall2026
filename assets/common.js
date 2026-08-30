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

/* Manual theme override: null = follow system, "dark"/"light" = explicit. */
const THEME = {
  get: () => { try { return localStorage.getItem("en5425-theme"); } catch { return null; } },
  set: (v) => { try { v ? localStorage.setItem("en5425-theme", v) : localStorage.removeItem("en5425-theme"); } catch {} },
  apply: () => {
    const v = THEME.get();
    if (v) document.documentElement.dataset.theme = v;
    else delete document.documentElement.dataset.theme;
  },
  effectiveDark: () => {
    const v = THEME.get();
    if (v) return v === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  },
};
THEME.apply();

/* Nav is injected so every page stays in sync. body[data-page] marks the active item. */
const NAV = [
  ["index", "Home", "Home", "index.html"],
  ["syllabus", "Syllabus", "강의계획", "syllabus.html"],
  ["schedule", "Schedule", "주차별 일정", "schedule.html"],
  ["journal", "Journal Club", "저널클럽", "journal.html"],
  ["quiz", "Quizzes", "퀴즈", "quiz.html"],
  ["capstone", "Capstone", "프로젝트", "capstone.html"],
  ["setup", "Setup", "환경 설정", "setup.html"],
  ["assignments", "Assignments", "과제 제출", "assignments.html"],
  ["present", "Presentations", "발표", "present.html"],
  ["myspace", "My Space", "내 공간", "myspace.html"],
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
    <div class="row row1">
      <span class="brand">
        <a class="logo-chip" href="https://env1.gist.ac.kr/env1/" target="_blank" rel="noopener"
           title="GIST School of Environment and Energy Engineering"><img src="${P}assets/img/gist.png" alt="GIST"></a>
        <a class="logo-link" href="https://hydroai.net" target="_blank" rel="noopener" title="HydroAI Lab">
          <img class="logo-ha ha-light" src="${P}assets/img/hydroai_logo_black.png" alt="HydroAI Lab">
          <img class="logo-ha ha-dark" src="${P}assets/img/hydroai_logo_white.png" alt="HydroAI Lab">
        </a>
        <a class="brand-t" href="${P}index.html">EN5425 / EV4240<small>Fall 2026</small></a>
      </span>
      <span class="menu">${NAV.map(([id, en, ko, href]) =>
        `<a class="item${id === page ? " on" : ""}" href="${href.startsWith("/") ? P + href.slice(1) : P + href}">${lang === "ko" ? ko : en}</a>`).join("")}</span>
    </div>
    <div class="row row2">
      <span class="nav-date tnum">${navDateChip(lang)}</span>
      <span id="navAuth" style="display:flex;gap:10px;align-items:center;white-space:nowrap">
        <a class="item" href="${P}portal/login.html">${lang === "ko" ? "로그인" : "Sign in"}</a>
      </span>
      <button class="btn lang-btn" id="themeBtn" type="button" title="${THEME.effectiveDark()
        ? (lang === "ko" ? "라이트 모드로" : "Switch to light mode")
        : (lang === "ko" ? "다크 모드로" : "Switch to dark mode")}"
        aria-label="Toggle dark mode">${THEME.effectiveDark() ? "☀" : "☾"}</button>
      <button class="btn lang-btn" id="langBtn" type="button"
        aria-label="Switch language">${lang === "ko" ? "EN" : "한국어"}</button>
    </div>
  </div>`;
  document.body.prepend(nav);
  nav.querySelector("#themeBtn").addEventListener("click", () => {
    THEME.set(THEME.effectiveDark() ? "light" : "dark");
    location.reload();
  });
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
/* Embedded mode: the site is shown inside an iframe on hydroai.net (Webflow Code
   Embed, same pattern as /data). Framed = our own shop window, so skip the curtain;
   sign-in must escape the frame — session cookies are third-party inside an iframe
   and Safari/Chrome drop them. */
const EMBEDDED = (() => { try { return window.self !== window.top; } catch { return true; } })();
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

/* ---- session-aware nav + shared in-page submission helpers ----------------
   One sign-in gives submit rights on the site pages themselves. On the static
   mirror (no API) the boxes link to the live class address instead. */
const XHDR = { "X-EN5425": "1" };
async function siteSession() {
  try {
    const r = await fetch("/api/me", { cache: "no-store" });
    if (r.ok) return { mode: "authed", me: await r.json() };
    if (r.status === 401 || r.status === 403) return { mode: "anon" };
  } catch {}
  return { mode: "mirror" };
}
async function liveClassURL() {
  try {
    const html = await (await fetch("portal/login.html", { cache: "no-store" })).text();
    const m = html.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    return m ? m[0] : null;
  } catch { return null; }
}
async function navSession() {
  const slot = document.getElementById("navAuth");
  if (!slot) return null;
  const st = await siteSession();
  if (st.mode === "authed") {
    if (st.me.must_change) { location.href = "/portal/login.html#change"; return st; }
    slot.innerHTML = `${st.me.role === "pi"
        ? `<a class="item" href="/portal/admin.html">${t("Grades", "성적 관리")}</a>` : ""}
      <span class="item" style="color:var(--accent);font-weight:600">${esc(st.me.name || st.me.sid)}</span>
      <a class="item" href="#" id="navLogout">${t("Sign out", "로그아웃")}</a>`;
    slot.querySelector("#navLogout").addEventListener("click", async (e) => {
      e.preventDefault();
      try { await fetch("/api/logout", { method: "POST", headers: XHDR }); } catch {}
      location.reload();
    });
  } else if (st.mode === "anon") {
    const a = slot.querySelector("a");
    if (a) a.href = "/portal/login.html?next=" + encodeURIComponent(location.pathname + location.search);
  }
  return st;
}
/* generic in-page submission box: type "text" (ticket-like) or "pdf" (report) */
function submitBoxHTML(row, mine, label) {
  const dueTxt = row.due ? `${fmtDate(row.due.slice(0, 10))} ${row.due.slice(11, 16)}` : "";
  const status = mine && mine.at
    ? t("submitted", "제출됨") + " " + String(mine.at).slice(5, 16).replace("T", " ") + (row.late || (mine && mine.late) ? ` · <span style="color:var(--warn);font-weight:700">${t("late", "지각")}</span>` : "")
    : (row.status === "miss" ? `<span style="color:var(--warn)">${t("missing", "미제출")}</span>` : t("not submitted yet", "아직 제출 전"));
  const graded = row.score !== null && row.score !== undefined;
  return `<p class="mybox-t" style="font-weight:700;font-size:13.5px;margin:0 0 8px;font-family:var(--serif)">${esc(label)}
      <span class="sub" style="margin:0;display:inline"> · ${t("due", "마감")} ${esc(dueTxt)} · ${status}${graded
        ? ` · <b>${t("score", "점수")} ${esc(row.score)}</b>` : ""}</span></p>
    ${graded && row.feedback ? `<blockquote style="margin:6px 0">${esc(row.feedback)}</blockquote>` : ""}
    ${row.type === "text"
      ? `<textarea maxlength="20000" style="width:100%;min-height:110px;resize:vertical;padding:10px 11px;border:1px solid var(--hairline);border-radius:8px;background:var(--surface);color:var(--ink);font-size:13.5px;font-family:var(--sans);line-height:1.6">${mine && mine.text ? esc(mine.text) : ""}</textarea>`
      : `<input type="file" accept="application/pdf,.pdf" style="font-size:12.5px">`}
    <div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap">
      <button class="btn primary">${mine && mine.at ? t("Resubmit", "다시 제출") : t("Submit", "제출")}</button>
      <span class="sub" style="margin:0">${row.type === "pdf" ? t("PDF only · ≤ 5 MB", "PDF만 · 5 MB 이하")
        : t("Resubmission allowed; the latest one counts.", "다시 제출 가능 — 마지막 제출이 반영돼요.")}</span>
    </div>
    <p class="sub boxerr" style="min-height:16px;margin:6px 0 0;color:var(--warn)"></p>`;
}
async function initSubmitBoxes(st) {
  const boxes = $$(".subbox");
  if (!boxes.length) return;
  if (!st) st = await siteSession();
  if (st.mode === "mirror") {
    const live = await liveClassURL();
    boxes.forEach((b) => { b.innerHTML = `<div class="mybox-in" style="background:var(--page);border:1px dashed var(--accent);border-radius:10px;padding:12px 14px;margin:14px 0 4px">
      ${live ? `<a class="btn primary" href="${esc(live)}${esc(location.pathname)}${esc(location.search)}">${t("Submit on the live class site →", "수업용 주소에서 제출하기 →")}</a>`
             : `<span class="sub" style="margin:0">${t("Submission opens on the live class address (pinned on Home).", "제출은 수업용 주소에서 열려요 (홈 고정 공지 참고).")}</span>`}</div>`; });
    return;
  }
  if (st.mode === "anon") {
    const login = "/portal/login.html?next=" + encodeURIComponent(location.pathname + location.search);
    boxes.forEach((b) => { b.innerHTML = `<div class="mybox-in" style="background:var(--page);border:1px dashed var(--accent);border-radius:10px;padding:12px 14px;margin:14px 0 4px">
      <a class="btn primary" href="${login}">${t("Sign in to submit", "로그인하고 제출하기")}</a>
      <span class="sub" style="margin:0"> ${esc(b.dataset.label || "")}</span></div>`; });
    return;
  }
  if (st.me.role === "pi") { boxes.forEach((b) => { b.innerHTML = ""; }); return; }
  for (const b of boxes) {
    const aid = b.dataset.aid, label = b.dataset.label || aid;
    const row = (st.me.assignments || []).find((a) => a.id === aid);
    if (!row || row.type === "score") { b.innerHTML = ""; continue; }
    let mine = null;
    if (row.type === "text") {
      try { mine = await (await fetch(`/api/mysub?aid=${aid}`)).json(); } catch {}
    } else if (row.submitted_at) mine = { at: row.submitted_at, late: row.late };
    const graded = row.score !== null && row.score !== undefined;
    const withdraw = (mine && mine.at && !graded)
      ? `<button class="btn box-del" type="button" style="margin-top:8px">${t("Delete my submission", "내 제출 삭제")}</button>` : "";
    b.innerHTML = `<div class="mybox-in" style="background:var(--page);border:1px dashed var(--accent);border-radius:10px;padding:12px 14px;margin:14px 0 4px">${submitBoxHTML(row, mine, label)}${withdraw}</div>`;
    const delBtn = b.querySelector(".box-del");
    if (delBtn) delBtn.addEventListener("click", async () => {
      if (!confirm(t("Delete your submission?", "제출물을 삭제할까요?"))) return;
      const fd = new FormData(); fd.append("aid", aid);
      try {
        const r = await fetch("/api/unsubmit", { method: "POST", headers: XHDR, body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.detail || "delete failed");
        location.reload();
      } catch (e2) { b.querySelector(".boxerr").textContent = e2.message; }
    });
    b.querySelector("button.primary, .btn.primary").addEventListener("click", async () => {
      const err = b.querySelector(".boxerr");
      const fd = new FormData(); fd.append("aid", aid);
      if (row.type === "text") {
        const txt = b.querySelector("textarea").value.trim();
        if (!txt) { err.textContent = t("Write something first.", "내용을 먼저 적어 주세요."); return; }
        fd.append("text", txt);
      } else {
        const f = b.querySelector('input[type="file"]').files[0];
        if (!f) { err.textContent = t("Choose a PDF first.", "PDF 파일을 먼저 선택해 주세요."); return; }
        if (f.size > 5 * 1024 * 1024) { err.textContent = t("Over the 5 MB limit.", "5 MB를 넘어요."); return; }
        fd.append("file", f, f.name);
      }
      try {
        const r = await fetch("/api/submit", { method: "POST", headers: XHDR, body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.detail || "submit failed");
        location.reload();
      } catch (e2) { err.textContent = e2.message; }
    });
  }
}
document.addEventListener("DOMContentLoaded", async () => {
  document.body.dataset.lang = LANG.get();
  injectNav();
  injectFooter();
  if (!gatePassed() && !EMBEDDED) showGate();
  if (EMBEDDED) document.addEventListener("click", (e) => {
    const a = e.target.closest ? e.target.closest("a[href]") : null;
    if (a && /portal\/|trycloudflare\.com/.test(a.href)) a.target = "_top";
  }, true);
  const st = await navSession();
  initSubmitBoxes(st);
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
