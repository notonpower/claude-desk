// DEADLINE — editorial, motion-rich assignment deadline tracker
const STORE_KEY = "deadline.tasks.v1";
const SUBJ_KEY = "deadline.subjects.v1";
const THEME_KEY = "deadline.theme";
const SORT_KEY = "deadline.sort";
const COLOR_NAMES = ["violet", "cyan", "lime", "amber", "rose"];
const PRIO_W = { high: 2, normal: 1, low: 0 };
const PRIO_LABEL = { low: "低", normal: "中", high: "高" };
const REP_LABEL = { daily: "毎日", weekly: "毎週", biweekly: "隔週", monthly: "毎月" };
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

let tasks = load();
let filter = "active";
let sortMode = localStorage.getItem(SORT_KEY) || "due"; // "due" | "priority"
let pickedColor = "violet";
let pickedPrio = "normal";
let pickedRepeat = "none";
let editingId = null;
let heroId = null;

/* ---------- persistence ---------- */
function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; } }
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(tasks)); schedulePush(); }
function loadSubjects() { try { return JSON.parse(localStorage.getItem(SUBJ_KEY)) || []; } catch { return []; } }
function pushSubject(s) {
  if (!s) return;
  let arr = loadSubjects().filter((x) => x !== s);
  arr.unshift(s);
  localStorage.setItem(SUBJ_KEY, JSON.stringify(arr.slice(0, 8)));
  schedulePush();
}

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const left = (due) => new Date(due).getTime() - Date.now();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const vtName = (id) => "t-" + id.replace(/[^a-z0-9]/gi, "");
const p2 = (n) => String(n).padStart(2, "0");
const prio = (t) => t.priority || "normal";
const rep = (t) => t.repeat || "none";

function nextDue(iso, repeat) {
  const d = new Date(iso);
  const advance = () => {
    if (repeat === "daily") d.setDate(d.getDate() + 1);
    else if (repeat === "weekly") d.setDate(d.getDate() + 7);
    else if (repeat === "biweekly") d.setDate(d.getDate() + 14);
    else if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  };
  let guard = 0;
  do { advance(); guard++; } while (d.getTime() <= Date.now() && guard < 1000);
  return d.toISOString();
}

let toastTimer = null;
function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}
const accentVar = (name) => "var(--" + (COLOR_NAMES.includes(name) ? name : "violet") + ")";
const accentHex = (name) => getComputedStyle(document.documentElement).getPropertyValue("--" + (COLOR_NAMES.includes(name) ? name : "violet")).trim() || "#9b8cff";

function breakdown(ms) {
  const a = Math.abs(ms);
  return { d: Math.floor(a / 86400000), h: Math.floor((a % 86400000) / 3600000), m: Math.floor((a % 3600000) / 60000), s: Math.floor((a % 60000) / 1000) };
}
function relText(ms) {
  const { d, h, m, s } = breakdown(ms);
  if (ms <= 0) { if (d >= 1) return `${d}日 超過`; if (h >= 1) return `${h}時間 超過`; return `${m}分 超過`; }
  if (d >= 1) return `残り ${d}日 ${h}時間`;
  return `まもなく ${p2(h)}:${p2(m)}:${p2(s)}`;
}
function dueText(due) {
  const d = new Date(due);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}.${p2(d.getDate())} ${wd} · ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
function barPct(ms) { return ms <= 0 ? 0 : Math.max(2, Math.min(100, (ms / WINDOW_MS) * 100)); }
function prioHTML(level) {
  return `<span class="prio p-${level}"><span class="bars"><i></i><i></i><i></i></span>${PRIO_LABEL[level] || "中"}</span>`;
}

function sortTasks(arr) {
  return [...arr].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (sortMode === "priority") {
      const pd = PRIO_W[prio(b)] - PRIO_W[prio(a)];
      if (pd) return pd;
    }
    return new Date(a.due) - new Date(b.due);
  });
}

function pickHeroId() {
  const active = tasks.filter((t) => !t.done);
  if (!active.length) return null;
  const up = active.filter((t) => left(t.due) > 0).sort((a, b) => left(a.due) - left(b.due));
  const over = active.filter((t) => left(t.due) <= 0).sort((a, b) => left(b.due) - left(a.due));
  return (up[0] || over[0]).id;
}

/* ---------- render ---------- */
function render() {
  const run = () => paint();
  if (document.startViewTransition && !reduceMotion()) document.startViewTransition(run);
  else run();
}

function paint() {
  heroId = pickHeroId();
  paintHero();

  const visible = sortTasks(tasks)
    .filter((t) => (filter === "active" ? !t.done : filter === "done" ? t.done : true))
    .filter((t) => t.id !== heroId);

  const list = $("#list");
  list.innerHTML = "";

  if (!visible.length) {
    const note = filter === "done" ? "完了した課題はまだない" : heroId ? "次の締切はこの上の1件だけ" : "ここに課題が並ぶ";
    const li = document.createElement("li");
    li.className = "task";
    li.style.borderBottom = "none";
    li.innerHTML = `<div class="t-main" style="cursor:default"><div class="t-title" style="font-weight:600;color:var(--ink-dim)">${note}</div><div class="t-due">下のボタンから追加しよう</div></div>`;
    list.appendChild(li);
    return;
  }

  visible.forEach((t, i) => list.appendChild(rowEl(t, i)));
  tick();
}

function rowEl(t, i) {
  const li = document.createElement("li");
  li.className = "task";
  li.dataset.id = t.id;
  li.style.setProperty("--c", accentVar(t.color));
  li.style.setProperty("--i", i);
  li.style.viewTransitionName = vtName(t.id);

  li.innerHTML = `
    <button class="t-check" aria-label="完了">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
    </button>
    <div class="t-main">
      <div class="t-top">
        <span class="t-top-l"><span class="t-idx">${p2(i + 1)}</span>${t.subject ? `<span class="t-subject">${esc(t.subject)}</span>` : ""}</span>
        ${prioHTML(prio(t))}
      </div>
      <div class="t-title">${esc(t.title)}</div>
      <div class="t-count"></div>
      <div class="t-track"><span class="t-bar"></span></div>
      <div class="t-foot">
        <div class="t-foot-l">
          <span class="t-due">${dueText(t.due)}</span>
          ${rep(t) !== "none" ? `<span class="t-repeat">↻ ${REP_LABEL[rep(t)]}</span>` : ""}
        </div>
        <button class="t-cal" aria-label="カレンダーに登録">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>
        </button>
      </div>
    </div>
    <button class="t-del" aria-label="削除">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
    </button>`;

  li.querySelector(".t-check").addEventListener("click", (e) => { e.stopPropagation(); onCheck(t.id, e.currentTarget); });
  li.querySelector(".t-del").addEventListener("click", (e) => { e.stopPropagation(); removeTask(t.id); });
  li.querySelector(".t-cal").addEventListener("click", (e) => { e.stopPropagation(); downloadICS(t); });
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
  if (!heroId) {
    hero.className = "hero empty";
    hero.dataset.id = "";
    hero.innerHTML = `
      <span class="hero-kicker"><span class="pip"></span>ALL CLEAR</span>
      <div class="hero-empty-big">締め切りはゼロ。</div>
      <div class="hero-empty-sub">深呼吸して、次の一歩を決めよう。</div>`;
    return;
  }
  const t = tasks.find((x) => x.id === heroId);
  const isOver = left(t.due) <= 0;
  hero.className = "hero" + (isOver ? " over" : "");
  hero.style.setProperty("--c", accentVar(t.color));
  hero.dataset.id = t.id;
  hero.innerHTML = `
    <span class="hero-kicker"><span class="pip"></span>${isOver ? "OVERDUE" : "NEXT DEADLINE"}</span>
    <div class="hero-count" id="hero-count"></div>
    <div class="hero-title" id="hero-title">${esc(t.title)}</div>
    <div class="hero-meta"><span class="dot"></span>${t.subject ? esc(t.subject) + " · " : ""}${dueText(t.due)}${rep(t) !== "none" ? ` · ↻ ${REP_LABEL[rep(t)]}` : ""}${prioHTML(prio(t))}</div>
    <div class="hero-actions">
      <button class="hero-done" id="hero-done">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
        完了にする
      </button>
      <button class="hero-icon" id="hero-cal" aria-label="カレンダーに登録">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>
      </button>
      <button class="hero-icon" id="hero-edit" aria-label="編集">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
      </button>
    </div>`;
  renderHeroCount(left(t.due));
  $("#hero-done").addEventListener("click", (e) => onCheck(t.id, e.currentTarget));
  $("#hero-cal").addEventListener("click", () => downloadICS(t));
  $("#hero-edit").addEventListener("click", () => openSheet(t.id));
  $("#hero-title").addEventListener("click", () => openSheet(t.id));
}
function renderHeroCount(ms) {
  const el = $("#hero-count");
  if (!el) return;
  const { d, h, m, s } = breakdown(ms);
  const g = (n, lab) => `<div class="hc-group"><span class="hc-num">${p2(n)}</span><span class="hc-lab">${lab}</span></div>`;
  el.innerHTML = g(d, "日") + g(h, "時") + g(m, "分") + g(s, "秒");
}

/* ---------- live tick ---------- */
function tick() {
  const hero = $("#hero");
  if (hero && hero.dataset.id) {
    const t = tasks.find((x) => x.id === hero.dataset.id && !x.done);
    if (t) renderHeroCount(left(t.due));
  }
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

/* ---------- celebration ---------- */
function celebrate(x, y, color) {
  if (reduceMotion()) return;
  if (navigator.vibrate) navigator.vibrate(30);
  const palette = [color, "var-ink", "#ff3d2e"].map((c) => (c === "var-ink" ? getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() : c));
  for (let i = 0; i < 22; i++) {
    const s = document.createElement("span");
    s.className = "spark";
    s.style.left = x + "px"; s.style.top = y + "px";
    s.style.background = palette[i % palette.length];
    if (i % 2) s.style.borderRadius = "50%";
    document.body.appendChild(s);
    const ang = Math.random() * Math.PI * 2;
    const dist = 45 + Math.random() * 85;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 20;
    s.animate(
      [
        { transform: "translate(-50%,-50%) scale(1) rotate(0)", opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(0) rotate(${Math.random() * 360}deg)`, opacity: 0 },
      ],
      { duration: 650 + Math.random() * 350, easing: "cubic-bezier(0.16,1,0.3,1)" }
    ).onfinish = () => s.remove();
  }
}

function onCheck(id, btn) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  const willComplete = !t.done;
  if (willComplete) {
    const r = btn.getBoundingClientRect();
    celebrate(r.left + r.width / 2, r.top + r.height / 2, accentHex(t.color));
    btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
  }
  t.done = !t.done;

  // recurring: spawn the next occurrence once, when first completed
  if (willComplete && rep(t) !== "none" && !t.spawned) {
    t.spawned = true;
    tasks.push({
      id: uid(),
      title: t.title,
      subject: t.subject,
      due: nextDue(t.due, rep(t)),
      color: t.color,
      priority: t.priority || "normal",
      repeat: t.repeat,
      done: false,
      spawned: false,
    });
    toast(`次回ぶんを作成しました（${REP_LABEL[rep(t)]}）`);
  }

  save();
  render();
}

/* ---------- swipe ---------- */
function attachSwipe(li) {
  let x0 = 0, dx = 0, on = false;
  li.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; dx = 0; on = true; }, { passive: true });
  li.addEventListener("touchmove", (e) => { if (on) dx = e.touches[0].clientX - x0; }, { passive: true });
  li.addEventListener("touchend", () => {
    if (!on) return; on = false;
    if (dx < -45) { document.querySelectorAll(".task.peek").forEach((el) => { if (el !== li) el.classList.remove("peek"); }); li.classList.add("peek"); }
    else if (dx > 25) li.classList.remove("peek");
  });
}

/* ---------- mutations ---------- */
function removeTask(id) { tasks = tasks.filter((x) => x.id !== id); save(); render(); }

/* ---------- calendar (.ics) ---------- */
function icsDate(d) {
  return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + "T" + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds()) + "Z";
}
function icsEsc(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
function downloadICS(t) {
  const start = new Date(t.due);
  const end = new Date(start.getTime() + 30 * 60000);
  const summary = (t.subject ? "[" + t.subject + "] " : "") + t.title;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DEADLINE//JP//", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:" + t.id + "@deadline",
    "DTSTAMP:" + icsDate(new Date()),
    "DTSTART:" + icsDate(start),
    "DTEND:" + icsDate(end),
    "SUMMARY:" + icsEsc("⏰ " + summary),
    "DESCRIPTION:" + icsEsc("課題の締め切り（DEADLINE）"),
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc("締め切り24時間前"), "TRIGGER:-PT24H", "END:VALARM",
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc("締め切り1時間前"), "TRIGGER:-PT1H", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (t.title || "deadline").replace(/[\\/:*?"<>|]/g, "_") + ".ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ---------- sheet ---------- */
function buildSubjectChips() {
  const wrap = $("#subject-quick");
  const recents = loadSubjects();
  if (!recents.length) { wrap.hidden = true; wrap.innerHTML = ""; return; }
  wrap.hidden = false;
  wrap.innerHTML = recents.map((s) => `<button type="button" class="q">${esc(s)}</button>`).join("");
}
function setColor(c) { pickedColor = c; document.querySelectorAll(".sw").forEach((s) => s.classList.toggle("on", s.dataset.color === c)); }
function setPrio(p) { pickedPrio = p; document.querySelectorAll("#prio-seg button").forEach((b) => b.classList.toggle("on", b.dataset.prio === p)); }
function setRepeat(r) { pickedRepeat = r; document.querySelectorAll("#repeat-seg .q").forEach((b) => b.classList.toggle("on", b.dataset.rep === r)); }
function markOne(container, btn) { container.querySelectorAll(".q").forEach((q) => q.classList.toggle("on", q === btn)); }
function quickDate(when) {
  const d = new Date();
  if (when === "tomorrow") d.setDate(d.getDate() + 1);
  else if (when === "nextweek") d.setDate(d.getDate() + 7);
  else if (when === "weekend") d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

function openSheet(id = null) {
  editingId = id;
  $("#sheet-title").textContent = id ? "課題を編集" : "新しい課題";
  $("#save-btn").textContent = id ? "保存" : "刻む";
  $("#del-btn").hidden = !id;
  $("#cal-btn").hidden = !id;
  buildSubjectChips();
  document.querySelectorAll(".q.on").forEach((q) => q.classList.remove("on"));

  if (id) {
    const t = tasks.find((x) => x.id === id);
    const d = new Date(t.due);
    $("#f-title").value = t.title;
    $("#f-subject").value = t.subject || "";
    $("#f-date").value = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    $("#f-time").value = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
    setColor(t.color || "violet");
    setPrio(prio(t));
    setRepeat(rep(t));
  } else {
    $("#form").reset();
    $("#f-time").value = "23:59";
    const d = new Date();
    $("#f-date").value = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    setColor("violet");
    setPrio("normal");
    setRepeat("none");
  }

  $("#backdrop").hidden = false;
  $("#sheet").hidden = false;
  $("#sheet").scrollTop = 0;
  document.querySelectorAll(".task.peek").forEach((el) => el.classList.remove("peek"));
}
function closeSheet() { $("#backdrop").hidden = true; $("#sheet").hidden = true; editingId = null; }

/* ---------- theme ---------- */
const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", theme === "light" ? "#f3f0e8" : "#0b0b0d");
  $("#theme").innerHTML = theme === "light" ? MOON : SUN; // icon shows what you'll switch TO
}
function currentTheme() { return document.documentElement.getAttribute("data-theme") || "dark"; }

/* ---------- clock + wordmark ---------- */
function updateClock() {
  const d = new Date();
  const wd = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()];
  $("#clock").innerHTML = `${wd} ${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}<br>${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}
function buildMark() {
  const word = "DEADLINE";
  $("#mark").innerHTML = [...word].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join("") + `<span class="deg" style="--i:${word.length}">°</span>`;
}
function updateSortLabel() { $("#sort-label").textContent = sortMode === "priority" ? "優先度順" : "締切順"; }

/* ---------- events ---------- */
$("#add").addEventListener("click", () => openSheet());
$("#cancel-btn").addEventListener("click", closeSheet);
$("#backdrop").addEventListener("click", closeSheet);
$("#del-btn").addEventListener("click", () => { if (editingId) { removeTask(editingId); closeSheet(); } });
$("#cal-btn").addEventListener("click", () => { const t = tasks.find((x) => x.id === editingId); if (t) downloadICS(t); });
$("#swatches").addEventListener("click", (e) => { const sw = e.target.closest(".sw"); if (sw) setColor(sw.dataset.color); });
$("#prio-seg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setPrio(b.dataset.prio); });
$("#repeat-seg").addEventListener("click", (e) => { const b = e.target.closest(".q"); if (b) setRepeat(b.dataset.rep); });

$("#title-quick").addEventListener("click", (e) => { const b = e.target.closest(".q"); if (!b) return; $("#f-title").value = b.dataset.fill; markOne($("#title-quick"), b); });
$("#subject-quick").addEventListener("click", (e) => { const b = e.target.closest(".q"); if (!b) return; $("#f-subject").value = b.textContent; markOne($("#subject-quick"), b); });
$("#date-quick").addEventListener("click", (e) => { const b = e.target.closest(".q"); if (!b) return; $("#f-date").value = quickDate(b.dataset.when); markOne($("#date-quick"), b); });

$("#toggles").addEventListener("click", (e) => {
  const b = e.target.closest(".tg"); if (!b) return;
  filter = b.dataset.filter;
  document.querySelectorAll(".tg").forEach((x) => x.classList.toggle("on", x === b));
  render();
});

$("#sort-btn").addEventListener("click", () => {
  sortMode = sortMode === "due" ? "priority" : "due";
  localStorage.setItem(SORT_KEY, sortMode);
  updateSortLabel();
  render();
});

$("#theme").addEventListener("click", () => applyTheme(currentTheme() === "light" ? "dark" : "light"));
$("#account").addEventListener("click", openAuth);
$("#auth-backdrop").addEventListener("click", closeAuth);

$("#form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $("#f-title").value.trim();
  const subject = $("#f-subject").value.trim();
  const date = $("#f-date").value, time = $("#f-time").value;
  if (!title || !date || !time) return;
  const due = new Date(`${date}T${time}`).toISOString();
  if (editingId) Object.assign(tasks.find((x) => x.id === editingId), { title, subject, due, color: pickedColor, priority: pickedPrio, repeat: pickedRepeat });
  else tasks.push({ id: uid(), title, subject, due, color: pickedColor, priority: pickedPrio, repeat: pickedRepeat, done: false, spawned: false });
  pushSubject(subject);
  save(); closeSheet(); render();
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".task")) document.querySelectorAll(".task.peek").forEach((el) => el.classList.remove("peek"));
});

/* ---------- cloud sync + auth (Firebase, optional) ---------- */
const cloud = { enabled: false, auth: null, db: null, fns: {}, providers: {}, user: null, ref: null, unsub: null, applying: false, pushTimer: null };

const ICON_PERSON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
const ICON_GOOGLE = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.5 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.9a5 5 0 0 1-2.18 3.3v2.74h3.52c2.06-1.9 3.26-4.7 3.26-7.88z"/><path fill="#34A853" d="M12 23c2.95 0 5.43-.98 7.24-2.66l-3.52-2.74c-.98.66-2.24 1.05-3.72 1.05-2.86 0-5.28-1.93-6.14-4.53H2.22v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.86 14.12a6.6 6.6 0 0 1 0-4.22V7.06H2.22a11 11 0 0 0 0 9.9l3.64-2.84z"/><path fill="#EA4335" d="M12 5.35c1.6 0 3.05.55 4.18 1.63l3.13-3.13A11 11 0 0 0 12 1 11 11 0 0 0 2.22 7.06l3.64 2.84C6.72 7.3 9.14 5.35 12 5.35z"/></svg>';
const ICON_APPLE = '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M16.36 12.78c.02 2.5 2.18 3.32 2.2 3.33-.02.06-.34 1.18-1.13 2.34-.68 1-1.39 2-2.51 2.02-1.1.02-1.45-.65-2.71-.65-1.25 0-1.64.63-2.68.67-1.08.04-1.9-1.08-2.59-2.08-1.4-2.03-2.47-5.74-1.03-8.25.71-1.24 1.99-2.03 3.38-2.05 1.06-.02 2.06.71 2.71.71.65 0 1.87-.88 3.15-.75.54.02 2.05.22 3.02 1.64-.08.05-1.8 1.05-1.78 3.05M14.3 4.6c.57-.69.96-1.65.85-2.6-.83.03-1.83.55-2.42 1.24-.53.61-1 1.59-.87 2.52.92.07 1.87-.47 2.44-1.16"/></svg>';

function avatarBig(u) {
  return u.photoURL ? `<img src="${esc(u.photoURL)}" alt="">` : `<span class="ac-letter-big">${esc((u.displayName || u.email || "?").slice(0, 1).toUpperCase())}</span>`;
}
function updateAccountButton() {
  const btn = $("#account");
  if (cloud.enabled && cloud.user) {
    const u = cloud.user;
    btn.innerHTML = u.photoURL ? `<img src="${esc(u.photoURL)}" alt="">` : `<span class="ac-letter">${esc((u.displayName || u.email || "?").slice(0, 1).toUpperCase())}</span>`;
    btn.classList.add("authed");
  } else {
    btn.innerHTML = ICON_PERSON;
    btn.classList.remove("authed");
  }
}

function renderAuth() {
  const body = $("#auth-body");
  if (!cloud.enabled) {
    body.innerHTML = `<h2 class="sheet-title">クラウド同期</h2>
      <p class="auth-note">複数の端末で同期するには Firebase の設定が必要です。<br><code>firebase-config.js</code> に設定値を貼り付けてください。手順は README を参照してください。</p>
      <button class="btn ghost" id="auth-close" style="width:100%">閉じる</button>`;
  } else if (cloud.user) {
    const u = cloud.user;
    body.innerHTML = `<h2 class="sheet-title">アカウント</h2>
      <div class="profile"><div class="avatar">${avatarBig(u)}</div>
        <div class="profile-info"><div class="pname">${esc(u.displayName || "ユーザー")}</div><div class="pmail">${esc(u.email || "")}</div></div></div>
      <div class="sync-state">☁ 複数端末で同期中</div>
      <button class="btn ghost" id="auth-signout" style="width:100%">ログアウト</button>`;
  } else {
    body.innerHTML = `<h2 class="sheet-title">ログイン</h2>
      <p class="auth-note">ログインすると、スマホとPCなど複数の端末で課題が同期されます。</p>
      <button class="btn provider google" id="login-google">${ICON_GOOGLE}<span>Googleでログイン</span></button>
      <button class="btn provider apple" id="login-apple">${ICON_APPLE}<span>Appleでログイン</span></button>
      <button class="btn ghost" id="auth-close" style="width:100%;margin-top:6px">ローカルのまま使う</button>`;
  }
  const close = $("#auth-close"); if (close) close.addEventListener("click", closeAuth);
  const g = $("#login-google"); if (g) g.addEventListener("click", () => login("google"));
  const a = $("#login-apple"); if (a) a.addEventListener("click", () => login("apple"));
  const out = $("#auth-signout"); if (out) out.addEventListener("click", () => { logout(); closeAuth(); });
}
function openAuth() { renderAuth(); $("#auth-backdrop").hidden = false; $("#auth-sheet").hidden = false; $("#auth-sheet").scrollTop = 0; }
function closeAuth() { $("#auth-backdrop").hidden = true; $("#auth-sheet").hidden = true; }

function login(which) {
  if (!cloud.enabled) return;
  const p = cloud.providers[which];
  if (!p) return;
  cloud.fns.signInWithRedirect(cloud.auth, p).catch((e) => { console.warn("login", e); toast("ログインに失敗しました"); });
}
function logout() { if (cloud.enabled && cloud.auth) cloud.fns.signOut(cloud.auth).catch(() => {}); }

function mergeById(a, b) {
  const m = new Map();
  (a || []).forEach((t) => m.set(t.id, t));
  (b || []).forEach((t) => m.set(t.id, t)); // cloud wins on id conflicts
  return [...m.values()];
}

async function onAuthChange(user) {
  cloud.user = user;
  updateAccountButton();
  if (cloud.unsub) { cloud.unsub(); cloud.unsub = null; }
  if (!user) { renderAuth(); return; }
  const { doc, getDoc, setDoc, onSnapshot } = cloud.fns;
  cloud.ref = doc(cloud.db, "users", user.uid);
  try {
    const snap = await getDoc(cloud.ref);
    const remote = snap.exists() ? snap.data() : null;
    tasks = mergeById(tasks, remote && remote.tasks);
    const subs = [...new Set([...((remote && remote.subjects) || []), ...loadSubjects()])].slice(0, 8);
    localStorage.setItem(STORE_KEY, JSON.stringify(tasks));
    localStorage.setItem(SUBJ_KEY, JSON.stringify(subs));
    await setDoc(cloud.ref, { tasks, subjects: subs, updatedAt: Date.now() });
    render();
    cloud.unsub = onSnapshot(cloud.ref, (ds) => {
      if (!ds.exists()) return;
      const d = ds.data();
      cloud.applying = true;
      tasks = d.tasks || [];
      localStorage.setItem(STORE_KEY, JSON.stringify(tasks));
      if (d.subjects) localStorage.setItem(SUBJ_KEY, JSON.stringify(d.subjects));
      cloud.applying = false;
      render();
    });
    toast("同期を開始しました");
  } catch (e) { console.warn("sync init", e); toast("同期に失敗しました"); }
  renderAuth();
}

function schedulePush() {
  if (!cloud.enabled || !cloud.user || cloud.applying) return;
  clearTimeout(cloud.pushTimer);
  cloud.pushTimer = setTimeout(() => {
    cloud.fns.setDoc(cloud.ref, { tasks, subjects: loadSubjects(), updatedAt: Date.now() }).catch((e) => console.warn("push", e));
  }, 600);
}

async function initFirebase() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) { updateAccountButton(); return; }
  try {
    const base = "https://www.gstatic.com/firebasejs/10.12.0/";
    const [appMod, authMod, fsMod] = await Promise.all([
      import(base + "firebase-app.js"),
      import(base + "firebase-auth.js"),
      import(base + "firebase-firestore.js"),
    ]);
    const app = appMod.initializeApp(cfg);
    cloud.auth = authMod.getAuth(app);
    cloud.db = fsMod.getFirestore(app);
    cloud.fns = { ...authMod, ...fsMod };
    cloud.providers.google = new authMod.GoogleAuthProvider();
    const apple = new authMod.OAuthProvider("apple.com");
    apple.addScope("email"); apple.addScope("name");
    cloud.providers.apple = apple;
    cloud.enabled = true;
    try { await authMod.getRedirectResult(cloud.auth); } catch (e) { console.warn("redirect result", e); }
    authMod.onAuthStateChanged(cloud.auth, onAuthChange);
  } catch (e) {
    console.warn("Firebase unavailable; running local-only.", e);
    cloud.enabled = false;
  }
  updateAccountButton();
}

/* ---------- boot ---------- */
applyTheme(currentTheme());
buildMark();
updateClock();
updateSortLabel();
updateAccountButton();
render();
initFirebase();
setInterval(() => { updateClock(); tick(); }, 1000);

/* ---------- service worker (auto-update) ---------- */
if ("serviceWorker" in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloaded) return; reloaded = true; location.reload(); });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      reg.update();
      if (reg.waiting) reg.waiting.postMessage("skip-waiting");
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing; if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) sw.postMessage("skip-waiting");
        });
      });
    }).catch(() => {});
  });
}
