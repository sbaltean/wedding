"use strict";

const MAX_RESULTS = 12;

const els = {
  input: document.getElementById("q"),
  results: document.getElementById("results"),
};

let guests = [];

/** Lowercase + strip Romanian/other diacritics for forgiving matching. */
function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks left by NFD (ă â î ș ț …)
    .replace(/\s+/g, " ")
    .trim();
}

/** Escape user text before injecting into innerHTML. */
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/** Highlight the matched query tokens inside a guest name. */
function highlight(name, tokens) {
  let safe = escapeHtml(name);
  for (const t of tokens) {
    if (!t) continue;
    // match the raw token case-insensitively, accent-aware via normalized compare
    const re = new RegExp(`(${escapeRegExp(t)})`, "gi");
    safe = safe.replace(re, "<mark>$1</mark>");
  }
  return safe;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tableMarkup(table) {
  if (!table || table <= 0) {
    return `<span class="card__table-num tba">în curând<br><small>TBA</small></span>`;
  }
  return `<span class="card__table-num">${table}</span>`;
}

/** Where the table sits in the room (RO + EN), from window.TABLE_LOCATIONS. */
function locationMarkup(table) {
  const loc = (window.TABLE_LOCATIONS || {})[table];
  if (!loc) return "";
  return `
    <p class="card__loc">
      <span class="card__loc-pin" aria-hidden="true">📍</span>
      <span>${escapeHtml(loc.ro)}<span class="card__loc-en">${escapeHtml(loc.en)}</span></span>
    </p>`;
}

function render(query) {
  const q = normalize(query);
  els.results.innerHTML = "";

  if (!q) return;

  const tokens = q.split(" ").filter(Boolean);

  const matches = guests
    .filter((g) => tokens.every((t) => g._norm.includes(t)))
    .slice(0, MAX_RESULTS);

  if (matches.length === 0) {
    els.results.innerHTML = `
      <div class="msg">
        <p class="msg__big">Nu am găsit numele</p>
        <p>Încearcă doar prenumele sau numele de familie.<br>
        Dacă tot nu apare, întreabă un membru al echipei. 💛</p>
        <p class="msg__en">No match — try just your first or last name, or ask a member of staff.</p>
      </div>`;
    return;
  }

  // Highlight using the original (accented) tokens the user typed.
  const rawTokens = query.toLowerCase().split(/\s+/).filter(Boolean);

  const html = matches.map((g) => `
    <article class="card">
      <div class="card__main">
        <div class="card__name">${highlight(g.name, rawTokens)}</div>
        ${locationMarkup(g.table)}
      </div>
      <div class="card__table">
        <span class="card__table-label">Masa · Table</span>
        ${tableMarkup(g.table)}
      </div>
    </article>`).join("");

  els.results.innerHTML = html;
}

async function loadGuests() {
  // Preferred: data embedded via guests.js (works over file:// and https).
  if (Array.isArray(window.WEDDING_GUESTS)) {
    return window.WEDDING_GUESTS;
  }
  // Fallback: fetch the JSON (requires being served over http/https).
  const res = await fetch("guests.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function init() {
  try {
    const data = await loadGuests();
    guests = data.map((g) => ({ ...g, _norm: normalize(g.name) }));

    // Optional deep link: index.html?q=name prefills the search.
    const preset = new URLSearchParams(location.search).get("q");
    if (preset) {
      els.input.value = preset;
      render(preset);
    }
    els.input.focus();
  } catch (err) {
    els.results.innerHTML = `
      <div class="msg">
        <p class="msg__big">Lista nu s-a putut încărca</p>
        <p>Reîncarcă pagina sau verifică conexiunea.</p>
        <p class="msg__en">Could not load the guest list — please reload the page.</p>
      </div>`;
    console.error(err);
  }
}

let raf = 0;
els.input.addEventListener("input", (e) => {
  cancelAnimationFrame(raf);
  const v = e.target.value;
  raf = requestAnimationFrame(() => render(v));
});

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

init();
