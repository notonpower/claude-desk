// DEADLINE — minimal assignment deadline tracker
// State persisted in localStorage. No build step, no dependencies.

const STORE_KEY = "deadline.tasks.v1";
const COLORS = {
  violet: "#8b7bff", cyan: "#3fd9d4", lime: "#b6f24a",
  amber: "#ffb454", rose: "#ff6b9d",
};

let tasks = load();
let filter = "active";
let pickedColor = "violet";
let editingId = null;

/* ---------- persistence ---------- */
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(tasks));
}

/* ---------- helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function timeLeft(due) {
  return new Date(due).getTime() - Date.now();
}

// Returns { num, unit } for the ring center, plus a fraction 0..1 of urgency.
function countdownDisplay(ms) {
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days >= 1) return { num: days, unit: days === 1 ? "day" : "days" };
  if (hrs >= 1) return { num: hrs, unit: hrs === 1 ? "hr" : "hrs" };
  if (mins >= 1) return { num: mins, unit: "min" };
  return { num: 0, unit: "now" };
}

// Ring fill: full at >= 7 days, empties as deadline approaches.
function ringFraction(ms) {
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  if (ms <= 0) return 0;
  return Math.max(0, Math.min(1, ms / WEEK));
}

function formatDue(due) {
  const d = new Date(due);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${p(d.getDate())} (${wd}) ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------- rendering ---------- */
function render() {
  updateClock();
  const list = $("#task-list");
  const now = Date.now();

  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return new Date(a.due) - new Date(b.due);
  });

  const visible = sorted.filter((t) => {
    if (filter === "active") return !t.done;
    if (filter === "done") return t.done;
    return true;
  });

  // summary counts
  const active = tasks.filter((t) => !t.done);
  $("#count-active").textContent = active.length;
  $("#count-urgent").textContent = active.filter(
    (t) => { const ms = timeLeft(t.due); return ms > 0 && ms <= 86400000; }
  ).length;
  $("#count-done").textContent = tasks.filter((t) => t.done).length;

  list.innerHTML = "";
  $("#empty").hidden = visible.length !== 0;

  for (const t of visible) {
    list.appendChild(taskEl(t, now));
  }
}

function taskEl(t, now) {
  const ms = timeLeft(t.due);
  const overdue = ms <= 0 && !t.done;
  const color = COLORS[t.color] || COLORS.violet;
  const { num, unit } = countdownDisplay(ms);
  const frac = ringFraction(ms);

  const li = document.createElement("li");
  li.className = "task" + (overdue ? " is-overdue" : "") + (t.done ? " is-done" : "");
  li.style.setProperty("--c", color);
  li.dataset.id = t.id;

  // ring geometry
  const R = 25, C = 2 * Math.PI * R;
  const offset = C * (1 - frac);
  const ringNum = overdue ? "!" : num;
  const ringUnit = overdue ? "over" : unit;

  li.innerHTML = `
    <div class="ring">
      <svg width="58" height="58" viewBox="0 0 58 58">
        <circle class="track" cx="29" cy="29" r="${R}" fill="none" stroke-width="4"/>
        <circle class="prog" cx="29" cy="29" r="${R}" fill="none" stroke-width="4"
          stroke-dasharray="${C}" stroke-dashoffset="${overdue ? C : offset}"/>
      </svg>
      <div class="ring-label">
        <span class="ring-num">${ringNum}</span>
        <span class="ring-unit">${ringUnit}</span>
      </div>
    </div>
    <div class="task-body">
      ${t.subject ? `<span class="task-subject">${esc(t.subject)}</span>` : ""}
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-due">${formatDue(t.due)}</div>
    </div>
    <button class="task-check" aria-label="完了切り替え">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
    </button>
    <button class="task-del" aria-label="削除">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
    </button>
  `;

  // toggle done
  li.querySelector(".task-check").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDone(t.id);
  });

  // delete
  li.querySelector(".task-del").addEventListener("click", (e) => {
    e.stopPropagation();
    removeTask(t.id);
  });

  // tap body to edit
  li.querySelector(".task-body").addEventListener("click", () => openSheet(t.id));

  attachSwipe(li);
  return li;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- swipe to reveal delete ---------- */
function attachSwipe(li) {
  let startX = 0, dx = 0, swiping = false;
  li.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX; dx = 0; swiping = true;
  }, { passive: true });
  li.addEventListener("touchmove", (e) => {
    if (!swiping) return;
    dx = e.touches[0].clientX - startX;
  }, { passive: true });
  li.addEventListener("touchend", () => {
    if (!swiping) return;
    swiping = false;
    if (dx < -45) {
      document.querySelectorAll(".task.show-del").forEach((el) => { if (el !== li) el.classList.remove("show-del"); });
      li.classList.add("show-del");
    } else if (dx > 20) {
      li.classList.remove("show-del");
    }
  });
}

/* ---------- mutations ---------- */
function toggleDone(id) {
  const t = tasks.find((x) => x.id === id);
  if (t) { t.done = !t.done; save(); render(); }
}
function removeTask(id) {
  tasks = tasks.filter((x) => x.id !== id);
  save(); render();
}

/* ---------- sheet ---------- */
function openSheet(id = null) {
  editingId = id;
  const isEdit = !!id;
  $("#sheet-title").textContent = isEdit ? "課題を編集" : "新しい課題";
  $("#save-btn").textContent = isEdit ? "保存する" : "追加する";

  if (isEdit) {
    const t = tasks.find((x) => x.id === id);
    const d = new Date(t.due);
    const p = (n) => String(n).padStart(2, "0");
    $("#f-title").value = t.title;
    $("#f-subject").value = t.subject || "";
    $("#f-date").value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    $("#f-time").value = `${p(d.getHours())}:${p(d.getMinutes())}`;
    setColor(t.color || "violet");
  } else {
    $("#task-form").reset();
    $("#f-time").value = "23:59";
    // default date = today
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    $("#f-date").value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    setColor("violet");
  }

  $("#backdrop").hidden = false;
  $("#sheet").hidden = false;
  document.querySelectorAll(".task.show-del").forEach((el) => el.classList.remove("show-del"));
  setTimeout(() => $("#f-title").focus(), 250);
}

function closeSheet() {
  $("#backdrop").hidden = true;
  $("#sheet").hidden = true;
  editingId = null;
}

function setColor(c) {
  pickedColor = c;
  document.querySelectorAll(".swatch").forEach((s) =>
    s.classList.toggle("active", s.dataset.color === c));
}

/* ---------- clock ---------- */
function updateClock() {
  const d = new Date();
  const wd = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()];
  const p = (n) => String(n).padStart(2, "0");
  $("#today").textContent = `${wd} ${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/* ---------- events ---------- */
$("#fab").addEventListener("click", () => openSheet());
$("#cancel-btn").addEventListener("click", closeSheet);
$("#backdrop").addEventListener("click", closeSheet);

$("#color-pick").addEventListener("click", (e) => {
  const sw = e.target.closest(".swatch");
  if (sw) setColor(sw.dataset.color);
});

$("#filters").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  filter = chip.dataset.filter;
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
  render();
});

$("#task-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $("#f-title").value.trim();
  const subject = $("#f-subject").value.trim();
  const date = $("#f-date").value;
  const time = $("#f-time").value;
  if (!title || !date || !time) return;
  const due = new Date(`${date}T${time}`).toISOString();

  if (editingId) {
    const t = tasks.find((x) => x.id === editingId);
    Object.assign(t, { title, subject, due, color: pickedColor });
  } else {
    tasks.push({ id: uid(), title, subject, due, color: pickedColor, done: false });
  }
  save();
  closeSheet();
  render();
});

// dismiss swipe state when tapping elsewhere
document.addEventListener("click", (e) => {
  if (!e.target.closest(".task")) {
    document.querySelectorAll(".task.show-del").forEach((el) => el.classList.remove("show-del"));
  }
});

// live re-render so countdown rings stay current
setInterval(render, 60000);

render();

/* ---------- PWA service worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
