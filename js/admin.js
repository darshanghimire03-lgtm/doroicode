import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove, push } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { ENV } from "/env.js";
import { mountLayout } from "/js/layout.js";
import { logoImg } from "/js/img.js";

const app = getApps().length ? getApp() : initializeApp(ENV.firebase);
const db = getDatabase(app);

await mountLayout();

const LINK_COUNT = 8;
const LIVE_MS = (4 * 60 + 30) * 60 * 1000;

const tabsEl = document.getElementById("tabs");
const matchesPane = document.getElementById("matchesPane");
const teamsPane = document.getElementById("teamsPane");
const matchList = document.getElementById("matchList");
const teamList = document.getElementById("teamList");
const matchSearch = document.getElementById("matchSearch");
const teamSearch = document.getElementById("teamSearch");
const modal = document.getElementById("modal");
const modalCard = document.getElementById("modalCard");
const toastEl = document.getElementById("toast");

let teamsData = {};
let matchesData = {};
let teamsLoaded = false;
let matchesLoaded = false;
let toastTimer = null;
let modalOpen = false;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}

function teamName(id) {
  const t = teamsData[id];
  return t && t.name ? t.name : "TBD";
}

function logoHtml(id, big) {
  const t = teamsData[id];
  const letter = t && t.name ? t.name.charAt(0).toUpperCase() : "?";
  const inner = t && t.logourl ? logoImg(t.logourl, letter, true) : esc(letter);
  return `<div class="logo-box${big ? " big" : ""}">${inner}</div>`;
}

function matchState(m, now) {
  if (now < m.startTime) return "notstarted";
  if (m.ended !== true && now < m.startTime + LIVE_MS) return "live";
  return "finished";
}

function stateLabel(s) {
  if (s === "live") return "LIVE";
  if (s === "notstarted") return "NOT STARTED";
  return "MATCH FINISHED";
}

function formatDateTime(ms) {
  return new Date(ms).toLocaleString([], { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toLocalInput(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
}

function linkCount(m) {
  let n = 0;
  for (let i = 1; i <= LINK_COUNT; i++) {
    if (m.links && m.links["link" + i]) n++;
  }
  return n;
}

function sortedTeams() {
  return Object.entries(teamsData)
    .filter(([, t]) => t)
    .sort((a, b) => String(a[1].name || "").localeCompare(String(b[1].name || "")));
}

function renderMatches() {
  document.getElementById("cMatches").textContent = Object.keys(matchesData).length;
  if (!matchesLoaded) return;
  const q = matchSearch.value.trim().toLowerCase();
  const now = Date.now();
  const items = Object.entries(matchesData)
    .filter(([, m]) => m && typeof m.startTime === "number")
    .filter(([, m]) => {
      if (!q) return true;
      const hay = (String(m.title || "") + " " + teamName(m.team1) + " " + teamName(m.team2)).toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => b[1].startTime - a[1].startTime);

  if (!items.length) {
    matchList.innerHTML = '<div class="empty">No matches found</div>';
    return;
  }

  matchList.innerHTML = items.map(([id, m]) => {
    const s = matchState(m, now);
    const title = m.title ? esc(m.title) : esc(teamName(m.team1) + " vs " + teamName(m.team2));
    const finishBtn = m.ended === true
      ? `<button class="btn" type="button" data-act="reopen-match" data-id="${esc(id)}">Reopen</button>`
      : `<button class="btn" type="button" data-act="finish-match" data-id="${esc(id)}">Mark finished</button>`;
    return `
      <div class="card">
        <div class="card-top">
          <div class="card-title">${title}</div>
          <span class="pill ${s}">${stateLabel(s)}</span>
        </div>
        <div class="vs-row">
          <div class="mini-team">${logoHtml(m.team1)}<span>${esc(teamName(m.team1))}</span></div>
          <div class="vs-chip">VS</div>
          <div class="mini-team">${logoHtml(m.team2)}<span>${esc(teamName(m.team2))}</span></div>
        </div>
        <div class="card-sub">${esc(formatDateTime(m.startTime))} &middot; ${linkCount(m)} link(s)</div>
        <div class="card-sub">ID: ${esc(id)}</div>
        <div class="actions">
          <button class="btn primary" type="button" data-act="edit-match" data-id="${esc(id)}">Edit</button>
          ${finishBtn}
          <a class="btn" href="/match/${encodeURIComponent(id)}" target="_blank" rel="noopener">Open</a>
          <button class="btn danger" type="button" data-act="delete-match" data-id="${esc(id)}">Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderTeams() {
  document.getElementById("cTeams").textContent = Object.keys(teamsData).length;
  if (!teamsLoaded) return;
  const q = teamSearch.value.trim().toLowerCase();
  const items = sortedTeams().filter(([, t]) => !q || String(t.name || "").toLowerCase().includes(q));

  if (!items.length) {
    teamList.innerHTML = '<div class="empty">No teams found</div>';
    return;
  }

  teamList.innerHTML = items.map(([id, t]) => {
    const used = Object.values(matchesData).filter((m) => m && (m.team1 === id || m.team2 === id)).length;
    return `
      <div class="card team-card">
        ${logoHtml(id, true)}
        <div class="team-info">
          <div class="card-title">${esc(t.name || "Unnamed")}</div>
          <div class="card-sub">${used} match(es)</div>
          <div class="card-sub">ID: ${esc(id)}</div>
        </div>
        <div class="actions">
          <button class="btn primary" type="button" data-act="edit-team" data-id="${esc(id)}">Edit</button>
          <button class="btn danger" type="button" data-act="delete-team" data-id="${esc(id)}">Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderAll() {
  renderMatches();
  renderTeams();
}

function openModal(html) {
  modalCard.innerHTML = html;
  modal.hidden = false;
  modalOpen = true;
  modalCard.scrollTop = 0;
}

function closeModal() {
  modal.hidden = true;
  modalOpen = false;
  modalCard.innerHTML = "";
}

modal.addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOpen) closeModal();
});

tabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tab]");
  if (!btn) return;
  const tab = btn.getAttribute("data-tab");
  tabsEl.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === btn));
  matchesPane.hidden = tab !== "matches";
  teamsPane.hidden = tab !== "teams";
});

matchSearch.addEventListener("input", renderMatches);
teamSearch.addEventListener("input", renderTeams);

function teamOptions(selected) {
  const opts = ['<option value="">Select team</option>'];
  sortedTeams().forEach(([id, t]) => {
    opts.push(`<option value="${esc(id)}"${id === selected ? " selected" : ""}>${esc(t.name || "Unnamed")}</option>`);
  });
  return opts.join("");
}

function openMatchForm(id) {
  const m = id ? matchesData[id] : null;
  const start = m && typeof m.startTime === "number" ? m.startTime : Math.ceil(Date.now() / 900000) * 900000;
  let linkInputs = "";
  for (let i = 1; i <= LINK_COUNT; i++) {
    const v = m && m.links && m.links["link" + i] ? m.links["link" + i] : "";
    linkInputs += `<input class="search" type="text" name="link${i}" placeholder="Stream ${i} (embed URL, .m3u8 or .mpd|key)" value="${esc(v)}" autocomplete="off">`;
  }
  openModal(`
    <h2>${id ? "Edit match" : "Add match"}</h2>
    <form id="matchForm" data-id="${esc(id || "")}">
      <div class="field">
        <label for="fTitle">Title (optional)</label>
        <input id="fTitle" name="title" type="text" value="${esc(m && m.title ? m.title : "")}" autocomplete="off">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="fTeam1">Team 1</label>
          <select id="fTeam1" name="team1">${teamOptions(m ? m.team1 : "")}</select>
        </div>
        <div class="field">
          <label for="fTeam2">Team 2</label>
          <select id="fTeam2" name="team2">${teamOptions(m ? m.team2 : "")}</select>
        </div>
      </div>
      <div class="field">
        <label for="fStart">Start time</label>
        <input id="fStart" name="start" type="datetime-local" value="${esc(toLocalInput(start))}">
      </div>
      <label class="check"><input type="checkbox" name="ended"${m && m.ended === true ? " checked" : ""}>Match finished</label>
      <div class="field"><label>Watch links</label></div>
      <div class="links-box">${linkInputs}</div>
      <div class="err" id="formErr"></div>
      <div class="modal-actions">
        <button class="btn" type="button" data-close>Cancel</button>
        <button class="btn primary" type="submit" id="saveBtn">Save</button>
      </div>
    </form>
  `);
}

function openTeamForm(id) {
  const t = id ? teamsData[id] : null;
  const url = t && t.logourl ? t.logourl : "";
  openModal(`
    <h2>${id ? "Edit team" : "Add team"}</h2>
    <form id="teamForm" data-id="${esc(id || "")}">
      <div class="logo-edit">
        <div class="logo-box big" id="logoPrev">${logoImg(url, t && t.name ? t.name.charAt(0).toUpperCase() : "?", false)}</div>
        <div class="field">
          <label for="fFile">Upload logo</label>
          <input id="fFile" type="file" accept="image/*">
        </div>
      </div>
      <div class="field">
        <label for="fName">Team name</label>
        <input id="fName" name="name" type="text" value="${esc(t && t.name ? t.name : "")}" autocomplete="off">
      </div>
      <div class="field">
        <label for="fLogo">Logo URL</label>
        <input id="fLogo" name="logourl" type="text" value="${esc(url)}" autocomplete="off">
      </div>
      <div class="err" id="formErr"></div>
      <div class="modal-actions">
        <button class="btn" type="button" data-close>Cancel</button>
        <button class="btn primary" type="submit" id="saveBtn">Save</button>
      </div>
    </form>
  `);
}

function setErr(text) {
  const el = document.getElementById("formErr");
  if (el) el.textContent = text || "";
}

function setSaving(on) {
  const btn = document.getElementById("saveBtn");
  if (btn) {
    btn.disabled = on;
    btn.textContent = on ? "Saving..." : "Save";
  }
}

modalCard.addEventListener("change", async (e) => {
  if (e.target.id === "fFile") {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setErr("");
    const btn = document.getElementById("saveBtn");
    if (btn) btn.disabled = true;
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data && data.error ? data.error : "Upload failed");
      document.getElementById("fLogo").value = data.url;
      document.getElementById("logoPrev").innerHTML = logoImg(data.url, "?", false);
      showToast("Logo uploaded");
    } catch (err) {
      setErr(err && err.message ? err.message : "Upload failed");
    }
    if (btn) btn.disabled = false;
  }
});

modalCard.addEventListener("input", (e) => {
  if (e.target.id === "fLogo") {
    const v = e.target.value.trim();
    const prev = document.getElementById("logoPrev");
    if (prev && v) prev.innerHTML = logoImg(v, "?", false);
  }
});

modalCard.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = form.getAttribute("data-id");
  setErr("");

  if (form.id === "matchForm") {
    const fd = new FormData(form);
    const team1 = fd.get("team1");
    const team2 = fd.get("team2");
    const startTime = new Date(fd.get("start")).getTime();
    if (!team1 || !team2) return setErr("Select both teams");
    if (team1 === team2) return setErr("Teams must be different");
    if (!Number.isFinite(startTime)) return setErr("Enter a valid start time");

    const links = {};
    for (let i = 1; i <= LINK_COUNT; i++) {
      const v = String(fd.get("link" + i) || "").trim();
      if (v) links["link" + i] = v;
    }
    const title = String(fd.get("title") || "").trim();
    const data = {
      title: title || null,
      team1,
      team2,
      startTime,
      ended: fd.get("ended") ? true : null,
      links: Object.keys(links).length ? links : null
    };

    setSaving(true);
    try {
      if (id) {
        await update(ref(db, "matches/" + id), data);
      } else {
        const r = push(ref(db, "matches"));
        await set(r, data);
      }
      closeModal();
      showToast("Match saved");
    } catch (err) {
      setSaving(false);
      setErr(err && err.message ? err.message : "Could not save");
    }
    return;
  }

  if (form.id === "teamForm") {
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const logourl = String(fd.get("logourl") || "").trim();
    if (!name) return setErr("Enter a team name");

    setSaving(true);
    try {
      if (id) {
        await update(ref(db, "teams/" + id), { name, logourl: logourl || null });
      } else {
        const r = push(ref(db, "teams"));
        await set(r, { name, logourl: logourl || null });
      }
      closeModal();
      showToast("Team saved");
    } catch (err) {
      setSaving(false);
      setErr(err && err.message ? err.message : "Could not save");
    }
  }
});

async function run(promise, okText) {
  try {
    await promise;
    showToast(okText);
  } catch (err) {
    showToast(err && err.message ? err.message : "Action failed");
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.getAttribute("data-act");
  const id = btn.getAttribute("data-id");

  if (act === "edit-match") openMatchForm(id);
  else if (act === "edit-team") openTeamForm(id);
  else if (act === "finish-match") run(update(ref(db, "matches/" + id), { ended: true }), "Match marked finished");
  else if (act === "reopen-match") run(update(ref(db, "matches/" + id), { ended: null }), "Match reopened");
  else if (act === "delete-match") {
    if (confirm("Delete this match permanently?")) run(remove(ref(db, "matches/" + id)), "Match deleted");
  } else if (act === "delete-team") {
    const used = Object.values(matchesData).filter((m) => m && (m.team1 === id || m.team2 === id)).length;
    const msg = used
      ? "This team is used in " + used + " match(es). Delete it anyway?"
      : "Delete this team permanently?";
    if (confirm(msg)) run(remove(ref(db, "teams/" + id)), "Team deleted");
  }
});

document.getElementById("addMatch").addEventListener("click", () => {
  if (!Object.keys(teamsData).length) {
    showToast("Add teams first");
    return;
  }
  openMatchForm("");
});

document.getElementById("addTeam").addEventListener("click", () => openTeamForm(""));

function onError(err) {
  console.error("[NPLcode admin]", err);
  const text = (err && ((err.code ? err.code + ": " : "") + (err.message || err))) || "Unknown error";
  const html = '<div class="empty">Could not load data.<br><small style="opacity:.7;word-break:break-word">' + esc(text) + "</small></div>";
  matchList.innerHTML = html;
  teamList.innerHTML = html;
}

onValue(ref(db, "teams"), (snap) => {
  teamsData = snap.val() || {};
  teamsLoaded = true;
  renderAll();
}, onError);

onValue(ref(db, "matches"), (snap) => {
  matchesData = snap.val() || {};
  matchesLoaded = true;
  renderAll();
}, onError);

setInterval(() => {
  if (matchesLoaded && !modalOpen) renderMatches();
}, 30000);