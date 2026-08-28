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

/* Nav is injected so every page stays in sync. body[data-page] marks the active item. */
const NAV = [
  ["index", "Home", "index.html"],
  ["syllabus", "Syllabus", "syllabus.html"],
  ["schedule", "Schedule", "schedule.html"],
  ["capstone", "Capstone", "capstone.html"],
  ["setup", "Setup", "setup.html"],
  ["students", "Students", "students.html"],
];
function injectNav() {
  const page = document.body.dataset.page || "";
  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.innerHTML = `<div class="in">
    <a class="brand" href="index.html">EN5425</a>
    ${NAV.map(([id, label, href]) =>
      `<a class="item${id === page ? " on" : ""}" href="${href}">${label}</a>`).join("")}
  </div>`;
  document.body.prepend(nav);
}
function injectFooter() {
  const f = document.createElement("footer");
  f.className = "site";
  f.innerHTML = `EN5425 / EV4240 · Deep Learning Applications in Environmental Big Data ·
    Fall 2026 · Prof. Hyunglok Kim · <a href="https://hydroai.net">HydroAI Lab</a>, GIST`;
  ($(".wrap") || document.body).appendChild(f);
}
document.addEventListener("DOMContentLoaded", () => { injectNav(); injectFooter(); });

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
