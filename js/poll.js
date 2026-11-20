import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getDatabase, ref, onValue, update, increment } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { ENV } from "/env.js";

const app = getApps().length ? getApp() : initializeApp(ENV.firebase);
const db = getDatabase(app);

const STYLE_ID = "npl-poll-style";
const CSS = `
.poll{background:linear-gradient(180deg,var(--surface-2),var(--surface));border:1px solid var(--line);border-radius:22px;padding:16px;margin-bottom:22px}
.poll-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.poll-title{font-weight:800;font-size:1rem;display:flex;align-items:center;gap:8px}
.poll-title:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--primary)}
.poll-total{font-size:.8rem;font-weight:700;color:var(--muted)}
.poll-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.poll-opt{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 8px 12px;border-radius:18px;background:var(--bg);border:1px solid var(--line);color:var(--text);font-family:inherit;cursor:pointer;min-width:0;transition:transform .15s ease,border-color .15s ease}
.poll-opt:active:not(:disabled){transform:scale(.97)}
.poll-opt:disabled{cursor:default}
.poll-opt.mine{border-color:var(--primary);box-shadow:0 0 0 1px rgba(163,230,53,.25)}
.poll-logo{width:64px;height:64px;border-radius:18px;background:var(--surface);border:1px solid var(--line);overflow:hidden;display:flex;align-items:center;justify-content:center;color:var(--primary);font-weight:800;font-size:1.5rem}
.poll-logo img{width:100%;height:100%;object-fit:cover;display:block}
.poll-name{font-size:.9rem;font-weight:800;text-align:center;max-width:100%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
.poll-pct{font-size:1.6rem;font-weight:900;color:var(--primary);line-height:1}
.poll-count{font-size:.75rem;color:var(--muted);font-weight:600}
.poll-bar{width:100%;height:6px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
.poll-fill{height:100%;background:var(--primary);border-radius:99px;transition:width .5s ease}
.poll-pick{font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:5px 12px;border-radius:999px;background:var(--primary);color:#0C0F0D}
.poll-pick.idle{background:transparent;color:var(--primary);border:1px solid rgba(163,230,53,.4)}
.poll-note{margin-top:12px;font-size:.78rem;color:var(--muted);text-align:center;font-weight:600}
.poll-note.err{color:#F87171}
`;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function storageKey(id) {
  return "npl_poll_" + id;
}

function readVote(id) {
  try {
    const v = localStorage.getItem(storageKey(id));
    return v === "a" || v === "b" ? v : null;
  } catch (err) {
    return null;
  }
}

function saveVote(id, side) {
  try {
    localStorage.setItem(storageKey(id), side);
  } catch (err) {}
}

function clearVote(id) {
  try {
    localStorage.removeItem(storageKey(id));
  } catch (err) {}
}

function toCount(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function logoHtml(t) {
  const letter = esc(t.name ? t.name.charAt(0).toUpperCase() : "?");
  if (t.logourl && /^https?:\/\//i.test(String(t.logourl).trim())) {
    return `<img src="${esc(String(t.logourl).trim())}" alt="" referrerpolicy="no-referrer" data-i="${letter}" onerror="this.replaceWith(document.createTextNode(this.dataset.i))">`;
  }
  return letter;
}

export function createPoll(matchId) {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const state = {
    a: 0,
    b: 0,
    voted: readVote(matchId),
    teams: null,
    closed: false,
    error: "",
    el: null,
    last: ""
  };

  function optionHtml(side) {
    const t = state.teams[side];
    const total = state.a + state.b;
    const votes = state[side];
    const pctA = total ? Math.round((state.a / total) * 100) : 0;
    const pct = side === "a" ? pctA : total ? 100 - pctA : 0;
    const mine = state.voted === side;
    const locked = !!state.voted || state.closed;
    let pick = "";
    if (mine) pick = '<span class="poll-pick">Your pick</span>';
    else if (!locked) pick = '<span class="poll-pick idle">Vote</span>';
    return `
      <button class="poll-opt ${mine ? "mine" : ""}" type="button" data-side="${side}" ${locked ? "disabled" : ""} aria-label="Vote for ${esc(t.name)}">
        <div class="poll-logo">${logoHtml(t)}</div>
        <div class="poll-name">${esc(t.name)}</div>
        <div class="poll-pct">${pct}%</div>
        <div class="poll-bar"><div class="poll-fill" style="width:${pct}%"></div></div>
        <div class="poll-count">${votes} ${votes === 1 ? "vote" : "votes"}</div>
        ${pick}
      </button>
    `;
  }

  function html() {
    const total = state.a + state.b;
    let note = "Tap a team to vote";
    if (state.closed && !state.voted) note = "Poll closed";
    else if (state.voted) note = "Thanks for voting";
    return `
      <section class="poll">
        <div class="poll-head">
          <div class="poll-title">Who will win?</div>
          <div class="poll-total">${total} ${total === 1 ? "user" : "users"} voted</div>
        </div>
        <div class="poll-opts">${optionHtml("a")}${optionHtml("b")}</div>
        <div class="poll-note ${state.error ? "err" : ""}">${esc(state.error || note)}</div>
      </section>
    `;
  }

  function paint() {
    if (!state.el || !state.teams) return;
    const h = html();
    if (h === state.last && state.el.firstChild) return;
    state.last = h;
    state.el.innerHTML = h;
  }

  function vote(side) {
    if (state.voted || state.closed) return;
    state.voted = side;
    state.error = "";
    saveVote(matchId, side);
    paint();
    update(ref(db, "polls/" + matchId), { [side]: increment(1) }).catch((err) => {
      state.voted = null;
      state.error = "Could not save your vote. Try again.";
      clearVote(matchId);
      console.warn("[NPLcode] Poll needs Firebase rules for 'polls/{matchId}' (read + write).", err && err.message ? err.message : err);
      paint();
    });
  }

  onValue(ref(db, "polls/" + matchId), (snap) => {
    const v = snap.val() || {};
    state.a = toCount(v.a);
    state.b = toCount(v.b);
    paint();
  }, () => {
    state.error = "Could not load poll results.";
    paint();
  });

  return {
    attach(el) {
      if (state.el && state.el !== el) {
        state.el.removeEventListener("click", onClick);
      }
      state.el = el;
      if (el) {
        el.removeEventListener("click", onClick);
        el.addEventListener("click", onClick);
      }
      paint();
    },
    setTeams(t1, t2, closed) {
      state.teams = {
        a: { name: t1 && t1.name ? t1.name : "TBD", logourl: t1 && t1.logourl ? t1.logourl : "" },
        b: { name: t2 && t2.name ? t2.name : "TBD", logourl: t2 && t2.logourl ? t2.logourl : "" }
      };
      state.closed = !!closed;
      paint();
    }
  };

  function onClick(e) {
    const btn = e.target.closest("[data-side]");
    if (btn) vote(btn.getAttribute("data-side"));
  }
}