// DEADLINE — editorial, motion-rich assignment deadline tracker
// No build, no deps. State in localStorage.

const STORE_KEY = "deadline.tasks.v1";
const COLORS = { violet: "#9b8cff", cyan: "#4ad0c8", lime: "#bfe04a", amber: "#f0a73c", rose: "#f2719b" };
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // bar drains over 14 days

let tasks = load();
let filter = "active";
let pickedColor = "violet";
let editingId = null;

/* ---------- persistence ---------- */
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(tasks)); }

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const left = (due) => new Date(due).getTime() - Date.now();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const vtName = (id) => "t-" + id.replace(/[^a-z0-9]/gi, "");
const p2 = (n) => String(n).padStart(2, "0");

function breakdown(ms) {
  const a = Math.abs(ms);
  const d = Math.floor(a / 86400000);
  const h = Math.floor((a % 86400000) / 3600000);
  const m = Math.floor((a % 3600000) / 60000);
  const s = Math.floor((a % 60000) / 1000);
  return { d, h, m, s };
}

// compact relative text for a row, e.g. "残り 3日 4時間" / "まもなく 02:14:09" / "1日 超過"
function relText(ms) {
  const { d, h, m, s } = breakdown(ms);
  if (ms <= 0) {
    if (d >= 1) return `${d}日 超過`;
    if (h >= 1) return `${h}時間 超過`;
    return `${m}分 超過`;
  }
  if (d >= 1) return `残り ${d}日 ${h}時間`;
  return `まもなく ${p2(h)}:${p2(m)}:${p2(s)}`;
}

function dueText(due) {
  const d = new Date(due);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}.${p2(d.getDate())} ${wd} · ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

function barPct(ms) {
  if (ms <= 0) return 0;
  return Math.max(2, Math.min(100, (ms / WINDOW_MS) * 100));
}

function sortTasks(arr) {
  return [...arr].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return new Date(a.due) - new Date(b.due);
  });
}

/* ---------- full render (data / filter changes) ---------- */
function render() {
  const run = () => paint();
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(run);
  } else { run(); }
}

function paint() {
  paintHero();

  const sorted = sortTasks(tasks);
  const visible = sorted.filter((t) =>
    filter === "active" ? !t.done : filter === "done" ? t.done : true);

  $("#list-label").textContent =
    filter === "done" ? "DONE" : filter === "all" ? "ALL" : "UPCOMING";

  const list = $("#list");
  list.innerHTML = "";

  if (!visible.length) {
    const li = document.createElement("li");
    li.className = "task";
    li.style.borderBottom = "none";
    li.innerHTML = `<div class="t-main" style="cursor:default"><div class="t-title" style="font-weight:600;color:var(--ink-dim)">${
      filter === "done" ? "完了した課題はまだない" : "ここに課題が並ぶ"
    }</div><div class="t-due">下のボタンから追加しよう</div></div>`;
    list.appendChild(li);
    return;
  }

  visible.forEach((t, i) => list.appendChild(rowEl(t, i)));
  tick(); // sync live values immediately
}

function rowEl(t, i) {
  const color = COLORS[t.color] || COLORS.violet;
  const li = document.createElement("li");
  li.className = "task";
  li.dataset.id = t.id;
  li.style.setProperty("--c", color);
  li.style.setProperty("--i", i);
  li.style.viewTransitionName = vtName(t.id);

  li.innerHTML = `
    <button class="t-check" aria-label="完了">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
    </button>
    <div class="t-main">
      <div class="t-top">
        <span class="t-idx">${p2(i + 1)}</span>
        ${t.subject ? `<span class="t-subject">${esc(t.subject)}</span>` : ""}
      </div>
      <div class="t-title">${esc(t.title)}</div>
      <div class="t-count"></div>
      <div class="t-track"><span class="t-bar"></span></div>
      <div class="t-due">${dueText(t.due)}</div>
    </div>
    <button class="t-del" aria-label="削除">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
    </button>`;

  li.querySelector(".t-check").addEventListener("click", (e) => { e.stopPropagation(); toggleDone(t.id); });
  li.querySelector(".t-del").addEventListener("click", (e) => { e.stopPropagation(); removeTask(t.id); });
  li.querySelector(".t-main").addEventListener("click", () => {
    if (li.classList.contains("peek")) { li.classList.remove("peek"); return; }
    openSheet(t.id);
  });
  attachSwipe(li);
  return li;
}

/* ---------- hero ---------- */
function paintHero() {
  const hero = $("#hero");
  const active = tasks.filter((t) => !t.done);
  if (!active.length) {
    hero.className = "hero empty";
    hero.innerHTML = `
      <span class="hero-kicker"><span class="pip"></span>ALL CLEAR</span>
      <div class="hero-empty-big">締め切りはゼロ。</div>
      <div class="hero-empty-sub">深呼吸して、次の一歩を決めよう。</div>`;
    return;
  }
  // soonest upcoming; if none upcoming, the most overdue (closest to 0 from below)
  const upcoming = active.filter((t) => left(t.due) > 0).sort((a, b) => left(a.due) - left(b.due));
  const overdue = active.filter((t) => left(t.due) <= 0).sort((a, b) => left(b.due) - left(a.due));
  const t = upcoming[0] || overdue[0];
  const color = COLORS[t.color] || COLORS.violet;
  const isOver = left(t.due) <= 0;

  hero.className = "hero" + (isOver ? " over" : "");
  hero.style.setProperty("--c", color);
  hero.dataset.id = t.id;
  hero.innerHTML = `
    <span class="hero-kicker"><span class="pip"></span>${isOver ? "OVERDUE" : "NEXT DEADLINE"}</span>
    <div class="hero-count" id="hero-count"></div>
    <div class="hero-title">${esc(t.title)}</div>
    <div class="hero-meta"><span class="dot"></span>${t.subject ? esc(t.subject) + " · " : ""}${dueText(t.due)}</div>`;
  renderHeroCount(left(t.due));
}

function renderHeroCount(ms) {
  const el = $("#hero-count");
  if (!el) return;
  const { d, h, m, s } = breakdown(ms);
  const g = (n, lab) => `<div class="hc-group"><span class="hc-num">${p2(n)}</span><span class="hc-lab">${lab}</span></div>`;
  const colon = `<span class="hc-colon">:</span>`;
  el.innerHTML = g(d, "日") + colon + g(h, "時") + colon + g(m, "分") + colon + g(s, "秒");
}

/* ---------- live tick (no rebuild) ---------- */
function tick() {
  // hero
  const hero = $("#hero");
  if (hero && hero.dataset.id) {
    const t = tasks.find((x) => x.id === hero.dataset.id && !x.done);
    if (t) renderHeroCount(left(t.due));
  }
  // rows
  document.querySelectorAll(".task[data-id]").forEach((li) => {
    const t = tasks.find((x) => x.id === li.dataset.id);
    if (!t) return;
    const ms = left(t.due);
    const cnt = li.querySelector(".t-count");
    const bar = li.querySelector(".t-bar");
    if (cnt) cnt.textContent = t.done ? "完了" : relText(ms);
    if (bar) bar.style.width = t.done ? "100%" : barPct(ms) + "%";
    li.classList.toggle("over", !t.done && ms <= 0);
    li.classList.toggle("urgent", !t.done && ms > 0 && ms <= 86400000);
    li.classList.toggle("done", !!t.done);
  });
}

/* ---------- swipe ---------- */
function attachSwipe(li) {
  let x0 = 0, dx = 0, on = false;
  li.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; dx = 0; on = true; }, { passive: true });
  li.addEventListener("touchmove", (e) => { if (on) dx = e.touches[0].clientX - x0; }, { passive: true });
  li.addEventListener("touchend", () => {
    if (!on) return; on = false;
    if (dx < -45) {
      document.querySelectorAll(".task.peek").forEach((el) => { if (el !== li) el.classList.remove("peek"); });
      li.classList.add("peek");
    } else if (dx > 25) { li.classList.remove("peek"); }
  });
}

/* ---------- mutations ---------- */
function toggleDone(id) { const t = tasks.find((x) => x.id === id); if (t) { t.done = !t.done; save(); render(); } }
function removeTask(id) { tasks = tasks.filter((x) => x.id !== id); save(); render(); }

/* ---------- sheet ---------- */
function openSheet(id = null) {
  editingId = id;
  $("#sheet-title").textContent = id ? "課題を編集" : "新しい課題";
  $("#save-btn").textContent = id ? "保存" : "刻む";
  $("#del-btn").hidden = !id;

  if (id) {
    const t = tasks.find((x) => x.id === id);
    const d = new Date(t.due);
    $("#f-title").value = t.title;
    $("#f-subject").value = t.subject || "";
    $("#f-date").value = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    $("#f-time").value = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
    setColor(t.color || "violet");
  } else {
    $("#form").reset();
    $("#f-time").value = "23:59";
    const d = new Date();
    $("#f-date").value = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    setColor("violet");
  }

  $("#backdrop").hidden = false;
  $("#sheet").hidden = false;
  document.querySelectorAll(".task.peek").forEach((el) => el.classList.remove("peek"));
  setTimeout(() => $("#f-title").focus(), 280);
}
function closeSheet() { $("#backdrop").hidden = true; $("#sheet").hidden = true; editingId = null; }
function setColor(c) { pickedColor = c; document.querySelectorAll(".sw").forEach((s) => s.classList.toggle("on", s.dataset.color === c)); }

/* ---------- clock ---------- */
function updateClock() {
  const d = new Date();
  const wd = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()];
  $("#clock").innerHTML = `${wd} ${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}<br>${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

/* ---------- wordmark letters ---------- */
function buildMark() {
  const word = "DEADLINE";
  const mark = $("#mark");
  mark.innerHTML = [...word].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join("") + `<span class="deg" style="--i:${word.length}">°</span>`;
}

/* ---------- events ---------- */
$("#add").addEventListener("click", () => openSheet());
$("#cancel-btn").addEventListener("click", closeSheet);
$("#backdrop").addEventListener("click", closeSheet);
$("#del-btn").addEventListener("click", () => { if (editingId) { removeTask(editingId); closeSheet(); } });

$("#swatches").addEventListener("click", (e) => { const sw = e.target.closest(".sw"); if (sw) setColor(sw.dataset.color); });

$("#toggles").addEventListener("click", (e) => {
  const b = e.target.closest(".tg"); if (!b) return;
  filter = b.dataset.filter;
  document.querySelectorAll(".tg").forEach((x) => x.classList.toggle("on", x === b));
  render();
});

$("#form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $("#f-title").value.trim();
  const subject = $("#f-subject").value.trim();
  const date = $("#f-date").value, time = $("#f-time").value;
  if (!title || !date || !time) return;
  const due = new Date(`${date}T${time}`).toISOString();
  if (editingId) {
    Object.assign(tasks.find((x) => x.id === editingId), { title, subject, due, color: pickedColor });
  } else {
    tasks.push({ id: uid(), title, subject, due, color: pickedColor, done: false });
  }
  save(); closeSheet(); render();
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".task")) document.querySelectorAll(".task.peek").forEach((el) => el.classList.remove("peek"));
});

/* ---------- boot ---------- */
buildMark();
updateClock();
render();
setInterval(() => { updateClock(); tick(); }, 1000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
