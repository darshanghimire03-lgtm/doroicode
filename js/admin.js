import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove, push } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { ENV } from "/env.js";
import { mountLayout } from "/js/layout.js";
import { logoImg } from "/js/img.js";

const app = getApps().length ? getApp() : initializeApp(ENV.firebase);
const db = getDatabase(app);

await mountLayout();

const LINK_COUNT = 8;
const MAX_HOURS = 10;

const matchList = document.getElementById("matchList");
const matchSearch = document.getElementById("matchSearch");
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

function liveEnd(m) {
  const h = Number(m.durationHours);
  return h > 0 ? m.startTime + h * 3600000 : Infinity;
}

function matchState(m, now) {
  if (now < m.startTime) return "notstarted";
  if (m.ended !== true && now < liveEnd(m)) return "live";
  return "finished";
}

function stateLabel(s) {
  if (s === "live") return "LIVE";
  if (s === "notstarted") return "NOT STARTED";
  return "MATCH FINISHED";
}

function durationText(m) {
  const h = Number(m.durationHours);
  if (h > 0) return "Auto finish after " + h + (h === 1 ? " hour" : " hours");
  return "Finishes only when you click Finish";
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

function findTeamByName(name) {
  const key = String(name || "").trim().toLowerCase();
  if (!key) return null;
  const hit = sortedTeams().find(([, t]) => String(t.name || "").trim().toLowerCase() === key);
  return hit ? { id: hit[0], team: hit[1] } : null;
}

function teamUsedElsewhere(teamId, exceptMatchId) {
  return Object.entries(matchesData).some(([mid, m]) => mid !== exceptMatchId && m && (m.team1 === teamId || m.team2 === teamId));
}

function renderMatches() {
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
    const finishBtn = s === "finished"
      ? `<button class="btn" type="button" data-act="reopen-match" data-id="${esc(id)}">Reopen</button>`
      : `<button class="btn" type="button" data-act="finish-match" data-id="${esc(id)}">Finish match</button>`;
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
        <div class="card-sub">${esc(durationText(m))}</div>
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

matchSearch.addEventListener("input", renderMatches);

function teamBlock(n, id) {
  const t = id ? teamsData[id] : null;
  const name = t && t.name ? t.name : "";
  const url = t && t.logourl ? t.logourl : "";
  return `
    <div class="team-block">
      <div class="logo-edit">
        <div class="logo-box big" id="logoPrev${n}">${logoImg(url, name ? name.charAt(0).toUpperCase() : "?", false)}</div>
        <div class="field">
          <label for="fFile${n}">Team ${n} photo</label>
          <input id="fFile${n}" type="file" accept="image/*">
        </div>
      </div>
      <div class="field">
        <label for="fName${n}">Team ${n} name</label>
        <input id="fName${n}" name="name${n}" type="text" list="teamNames" value="${esc(name)}" autocomplete="off">
      </div>
      <input type="hidden" id="fLogo${n}" name="logo${n}" value="${esc(url)}">
    </div>
  `;
}

function hourOptions(selected) {
  const opts = [`<option value="0"${selected === 0 ? " selected" : ""}>0 - No auto finish (manual only)</option>`];
  for (let h = 1; h <= MAX_HOURS; h++) {
    opts.push(`<option value="${h}"${selected === h ? " selected" : ""}>${h} ${h === 1 ? "hour" : "hours"}</option>`);
  }
  return opts.join("");
}

function openMatchForm(id) {
  const m = id ? matchesData[id] : null;
  const start = m && typeof m.startTime === "number" ? m.startTime : Math.ceil(Date.now() / 900000) * 900000;
  const hours = m && Number(m.durationHours) > 0 ? Math.min(MAX_HOURS, Math.floor(Number(m.durationHours))) : 0;
  let linkInputs = "";
  for (let i = 1; i <= LINK_COUNT; i++) {
    const v = m && m.links && m.links["link" + i] ? m.links["link" + i] : "";
    linkInputs += `<input class="search" type="text" name="link${i}" placeholder="Stream ${i} (embed URL, .m3u8 or .mpd|key)" value="${esc(v)}" autocomplete="off">`;
  }
  const datalist = sortedTeams().map(([, t]) => `<option value="${esc(t.name || "")}"></option>`).join("");
  openModal(`
    <h2>${id ? "Edit match" : "Add match"}</h2>
    <form id="matchForm" data-id="${esc(id || "")}">
      <div class="field">
        <label for="fTitle">Title (optional)</label>
        <input id="fTitle" name="title" type="text" value="${esc(m && m.title ? m.title : "")}" autocomplete="off">
      </div>
      ${teamBlock(1, m ? m.team1 : "")}
      ${teamBlock(2, m ? m.team2 : "")}
      <datalist id="teamNames">${datalist}</datalist>
      <div class="field-row">
        <div class="field">
          <label for="fStart">Start time</label>
          <input id="fStart" name="start" type="datetime-local" value="${esc(toLocalInput(start))}">
        </div>
        <div class="field">
          <label for="fHours">Match duration (hours)</label>
          <select id="fHours" name="hours">${hourOptions(hours)}</select>
        </div>
      </div>
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

function previewLetter(n) {
  const input = document.getElementById("fName" + n);
  const v = input ? input.value.trim() : "";
  return v ? v.charAt(0).toUpperCase() : "?";
}

modalCard.addEventListener("change", async (e) => {
  const id = e.target.id || "";

  if (id.indexOf("fFile") === 0) {
    const n = id.slice(5);
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
      document.getElementById("fLogo" + n).value = data.url;
      document.getElementById("logoPrev" + n).innerHTML = logoImg(data.url, previewLetter(n), false);
      showToast("Team " + n + " photo uploaded");
    } catch (err) {
      setErr(err && err.message ? err.message : "Upload failed");
    }
    if (btn) btn.disabled = false;
    return;
  }

  if (id.indexOf("fName") === 0) {
    const n = id.slice(5);
    const hit = findTeamByName(e.target.value);
    const logoInput = document.getElementById("fLogo" + n);
    const prev = document.getElementById("logoPrev" + n);
    if (!logoInput || !prev) return;
    if (hit && hit.team.logourl && !logoInput.value) logoInput.value = hit.team.logourl;
    prev.innerHTML = logoImg(logoInput.value, previewLetter(n), false);
  }
});

async function resolveTeam(name, logo, currentId, matchId) {
  const hit = findTeamByName(name);
  if (hit) {
    if (logo && hit.team.logourl !== logo) await update(ref(db, "teams/" + hit.id), { logourl: logo });
    return hit.id;
  }
  if (currentId && teamsData[currentId] && !teamUsedElsewhere(currentId, matchId)) {
    await update(ref(db, "teams/" + currentId), { name, logourl: logo || null });
    return currentId;
  }
  const r = push(ref(db, "teams"));
  await set(r, { name, logourl: logo || null });
  return r.key;
}

async function pruneTeams(ids, matchId, keep) {
  for (const tid of ids) {
    if (!tid || keep.indexOf(tid) !== -1 || !teamsData[tid]) continue;
    if (teamUsedElsewhere(tid, matchId)) continue;
    await remove(ref(db, "teams/" + tid)).catch(() => {});
  }
}

modalCard.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  if (form.id !== "matchForm") return;
  const id = form.getAttribute("data-id");
  setErr("");

  const fd = new FormData(form);
  const name1 = String(fd.get("name1") || "").trim();
  const name2 = String(fd.get("name2") || "").trim();
  const logo1 = String(fd.get("logo1") || "").trim();
  const logo2 = String(fd.get("logo2") || "").trim();
  const startTime = new Date(fd.get("start")).getTime();
  const hours = parseInt(fd.get("hours"), 10);
  if (!name1 || !name2) return setErr("Enter both team names");
  if (name1.toLowerCase() === name2.toLowerCase()) return setErr("Teams must be different");
  if (!Number.isFinite(startTime)) return setErr("Enter a valid start time");
  if (!Number.isFinite(hours) || hours < 0 || hours > MAX_HOURS) return setErr("Duration must be 0 to " + MAX_HOURS + " hours");

  const links = {};
  for (let i = 1; i <= LINK_COUNT; i++) {
    const v = String(fd.get("link" + i) || "").trim();
    if (v) links["link" + i] = v;
  }
  const title = String(fd.get("title") || "").trim();
  const old = id ? matchesData[id] : null;

  setSaving(true);
  try {
    const team1 = await resolveTeam(name1, logo1, old ? old.team1 : "", id);
    const team2 = await resolveTeam(name2, logo2, old ? old.team2 : "", id);
    const data = {
      title: title || null,
      team1,
      team2,
      startTime,
      durationHours: hours > 0 ? hours : null,
      links: Object.keys(links).length ? links : null
    };
    if (id) {
      await update(ref(db, "matches/" + id), data);
      if (old) await pruneTeams([old.team1, old.team2], id, [team1, team2]);
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
});

async function run(promise, okText) {
  try {
    await promise;
    showToast(okText);
  } catch (err) {
    showToast(err && err.message ? err.message : "Action failed");
  }
}

async function deleteMatch(id) {
  const m = matchesData[id];
  await remove(ref(db, "matches/" + id));
  if (m) await pruneTeams([m.team1, m.team2], id, []);
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.getAttribute("data-act");
  const id = btn.getAttribute("data-id");

  if (act === "edit-match") openMatchForm(id);
  else if (act === "finish-match") {
    if (confirm("Finish this match now?")) run(update(ref(db, "matches/" + id), { ended: true }), "Match finished");
  } else if (act === "reopen-match") {
    run(update(ref(db, "matches/" + id), { ended: null, durationHours: null }), "Match reopened");
  } else if (act === "delete-match") {
    if (confirm("Delete this match permanently?")) run(deleteMatch(id), "Match deleted");
  }
});

document.getElementById("addMatch").addEventListener("click", () => openMatchForm(""));

function onError(err) {
  console.error("[NPLcode admin]", err);
  const text = (err && ((err.code ? err.code + ": " : "") + (err.message || err))) || "Unknown error";
  matchList.innerHTML = '<div class="empty">Could not load data.<br><small style="opacity:.7;word-break:break-word">' + esc(text) + "</small></div>";
}

onValue(ref(db, "teams"), (snap) => {
  teamsData = snap.val() || {};
  teamsLoaded = true;
  if (!modalOpen) renderMatches();
}, onError);

onValue(ref(db, "matches"), (snap) => {
  matchesData = snap.val() || {};
  matchesLoaded = true;
  if (!modalOpen) renderMatches();
}, onError);

setInterval(() => {
  if (matchesLoaded && !modalOpen) renderMatches();
}, 30000);