// Watch Watch — minimal dashboard logic.
// Storage is pluggable: localStorage by default, Pantry.cloud if config.js sets a PANTRY_ID.

const CONFIG = window.WATCH_WATCH_CONFIG || { PANTRY_ID: "", BASKET: "watch-watch", STORAGE_BACKEND: "auto" };

// ---------- storage ----------
const Storage = (() => {
  const usingPantry = !!CONFIG.PANTRY_ID && CONFIG.STORAGE_BACKEND !== "local";
  const pantryUrl = `https://getpantry.cloud/apiv1/pantry/${CONFIG.PANTRY_ID}/basket/${CONFIG.BASKET}`;
  const localKey = `watch-watch:${CONFIG.BASKET}`;
  const empty = () => ({ users: {}, votes: {}, version: 1 });

  async function load() {
    if (usingPantry) {
      try {
        const r = await fetch(pantryUrl, { cache: "no-store" });
        if (r.ok) return await r.json();
        if (r.status === 400) return empty();
      } catch (e) {}
    }
    try { return JSON.parse(localStorage.getItem(localKey)) || empty(); }
    catch { return empty(); }
  }
  async function save(state) {
    localStorage.setItem(localKey, JSON.stringify(state));
    if (usingPantry) {
      try {
        await fetch(pantryUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
      } catch (e) { console.warn("Pantry sync failed; saved locally", e); }
    }
  }
  return { load, save, usingPantry };
})();

// ---------- private locations (AES-GCM via Web Crypto) ----------
const PASS_KEY = "watch-watch:pass";
const PRIVATE = {
  pass: sessionStorage.getItem(PASS_KEY) || "",
  cache: new Map(), // id -> plaintext
  unlocked: false,
  bundle: null,    // { algo, iterations, entries: { id: cipher } }
};

async function loadPrivateBundle() {
  if (PRIVATE.bundle) return PRIVATE.bundle;
  try {
    const r = await fetch("./locations.enc.json", { cache: "no-store" });
    if (!r.ok) return null;
    PRIVATE.bundle = await r.json();
    return PRIVATE.bundle;
  } catch { return null; }
}

function privateCipherFor(id) {
  return PRIVATE.bundle?.entries?.[id] || null;
}

function b64decode(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase, salt, iterations) {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function decryptCipher(cipher, passphrase) {
  if (!cipher || !passphrase) return null;
  try {
    const [saltB64, ivB64, ctB64] = cipher.split(".");
    const salt = b64decode(saltB64);
    const iv = b64decode(ivB64);
    const ct = b64decode(ctB64);
    const iter = PRIVATE.bundle?.iterations || 250000;
    const key = await deriveKey(passphrase, salt, iter);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

const OWNER_KEY = "watch-watch:owner";
const isOwner = () => {
  const params = new URLSearchParams(location.search);
  if (params.has("owner")) {
    localStorage.setItem(OWNER_KEY, "1");
    history.replaceState({}, "", location.pathname + location.hash);
    return true;
  }
  return localStorage.getItem(OWNER_KEY) === "1";
};

const lockBtn = document.getElementById("lock-toggle");
if (isOwner()) lockBtn.classList.remove("hidden");

async function tryUnlock(passphrase) {
  await loadPrivateBundle();
  const entries = PRIVATE.bundle?.entries || {};
  const sampleId = Object.keys(entries)[0];
  if (!sampleId) {
    // no entries yet — accept the passphrase optimistically
    PRIVATE.pass = passphrase;
    PRIVATE.unlocked = true;
    sessionStorage.setItem(PASS_KEY, passphrase);
    return true;
  }
  const result = await decryptCipher(entries[sampleId], passphrase);
  if (result == null) return false;
  PRIVATE.pass = passphrase;
  PRIVATE.unlocked = true;
  sessionStorage.setItem(PASS_KEY, passphrase);
  PRIVATE.cache.set(sampleId, result);
  return true;
}

async function unlockFlow() {
  if (PRIVATE.unlocked) {
    PRIVATE.pass = "";
    PRIVATE.unlocked = false;
    PRIVATE.cache.clear();
    sessionStorage.removeItem(PASS_KEY);
    lockBtn.textContent = "🔒";
    lockBtn.classList.remove("unlocked");
    renderAll();
    return;
  }
  const pass = window.prompt("Passphrase to unlock private locations:");
  if (!pass) return;
  const ok = await tryUnlock(pass);
  if (ok) {
    lockBtn.textContent = "🔓";
    lockBtn.classList.add("unlocked");
    renderAll();
  } else {
    alert("Wrong passphrase, or no private notes yet.");
  }
}
lockBtn.addEventListener("click", unlockFlow);

async function privateBlock(id) {
  if (!isOwner()) return "";
  const cipher = privateCipherFor(id);
  if (!cipher) return "";
  if (!PRIVATE.unlocked) {
    return `<p class="private-block locked">🔒 unlock to view</p>`;
  }
  if (!PRIVATE.cache.has(id)) {
    const pt = await decryptCipher(cipher, PRIVATE.pass);
    if (pt == null) return `<p class="private-block locked">🔒 unable to decrypt</p>`;
    PRIVATE.cache.set(id, pt);
  }
  const text = PRIVATE.cache.get(id).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  return `<p class="private-block">${text}</p>`;
}

// ---------- nickname ----------
const NICK_KEY = "watch-watch:nick";
let me = localStorage.getItem(NICK_KEY) || "";
const nickInput = document.getElementById("nick-input");
const nickSave = document.getElementById("nick-save");
const syncStatus = document.getElementById("sync-status");
nickInput.value = me;
syncStatus.textContent = Storage.usingPantry ? "synced" : "local";
syncStatus.classList.toggle("synced", Storage.usingPantry);

async function saveNick() {
  const v = nickInput.value.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
  if (!v) { nickInput.focus(); return; }
  me = v;
  localStorage.setItem(NICK_KEY, me);
  nickInput.value = me;
  if (!state.users[me]) state.users[me] = { nickname: me, bookmarks: [], joined: new Date().toISOString().slice(0, 10) };
  await Storage.save(state);
  renderAll();
}
nickSave.addEventListener("click", saveNick);
nickInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveNick(); });

// ---------- main ----------
let data, state;

(async function main() {
  data = await (await fetch("./data.json", { cache: "no-store" })).json();
  state = await Storage.load();
  if (!state.users) state.users = {};
  if (!state.votes) state.votes = {};

  document.getElementById("updated").textContent = `updated ${data.updated}`;

  // tab switching
  const tabs = document.querySelectorAll("nav.tabs .tab");
  const panels = document.querySelectorAll(".panel");
  tabs.forEach((t) =>
    t.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.toggle("active", x === t));
      panels.forEach((p) => p.classList.toggle("hidden", p.id !== `panel-${t.dataset.tab}`));
    })
  );

  buildStoreCityFilter();
  document.getElementById("search").addEventListener("input", renderAll);

  // owners eagerly load encrypted bundle so locked placeholders can show
  if (isOwner()) {
    await loadPrivateBundle();
    if (PRIVATE.pass) {
      const ok = await tryUnlock(PRIVATE.pass);
      if (ok) {
        lockBtn.textContent = "🔓";
        lockBtn.classList.add("unlocked");
      } else {
        sessionStorage.removeItem(PASS_KEY);
        PRIVATE.pass = "";
      }
    }
  }

  renderAll();
})();

// ---------- helpers ----------
function $(id) { return document.getElementById(id); }
function q() { return $("search").value.trim().toLowerCase(); }

function formatPrice(w) {
  if (w.price_label) return w.price_label;
  if (w.price_usd != null) return `$${w.price_usd.toLocaleString()}`;
  if (w.price_usd_low != null && w.price_usd_high != null)
    return `$${w.price_usd_low.toLocaleString()}–${w.price_usd_high.toLocaleString()}`;
  if (w.price_jpy != null) return `¥${w.price_jpy.toLocaleString()}`;
  return "—";
}

function getVotes(id) { return state.votes[id] || (state.votes[id] = { up: [], down: [] }); }
function bookmarkers(id) { return Object.values(state.users).filter(u => (u.bookmarks || []).includes(id)); }
function isBookmarked(id) { return me && (state.users[me]?.bookmarks || []).includes(id); }
function myVote(id) {
  const v = getVotes(id);
  if (v.up.includes(me)) return 1;
  if (v.down.includes(me)) return -1;
  return 0;
}
function score(id) {
  const v = getVotes(id);
  return (v.up?.length || 0) - (v.down?.length || 0);
}

async function toggleBookmark(id) {
  if (!me) { nickInput.focus(); return; }
  const u = state.users[me] || (state.users[me] = { nickname: me, bookmarks: [], joined: new Date().toISOString().slice(0, 10) });
  u.bookmarks = u.bookmarks || [];
  const i = u.bookmarks.indexOf(id);
  if (i >= 0) u.bookmarks.splice(i, 1); else u.bookmarks.push(id);
  await Storage.save(state);
  renderAll();
}

async function vote(id, dir) {
  if (!me) { nickInput.focus(); return; }
  const v = getVotes(id);
  v.up = v.up.filter(n => n !== me);
  v.down = v.down.filter(n => n !== me);
  if (dir === 1) v.up.push(me);
  else if (dir === -1) v.down.push(me);
  await Storage.save(state);
  renderAll();
}

function actionFoot(id, ctaHref, ctaLabel) {
  const sc = score(id);
  const v = myVote(id);
  const bm = isBookmarked(id);
  const others = bookmarkers(id).filter(u => u.nickname !== me).slice(0, 3);
  const chips = others.length
    ? `<span class="who-chips">${others.map(u => `<span class="who-chip" title="${u.nickname} bookmarked">${u.nickname}</span>`).join("")}</span>`
    : "";
  return `
    <div class="foot">
      <div class="actions">
        <button class="action star ${bm ? "on" : ""}" data-act="bookmark" data-id="${id}" aria-label="${bm ? "Remove bookmark" : "Bookmark"}">${bm ? "★" : "☆"}</button>
        <button class="action vote up ${v === 1 ? "on" : ""}" data-act="up" data-id="${id}" aria-label="Upvote">▲</button>
        <span class="score ${sc > 0 ? "pos" : sc < 0 ? "neg" : ""}">${sc || ""}</span>
        <button class="action vote down ${v === -1 ? "on" : ""}" data-act="down" data-id="${id}" aria-label="Downvote">▼</button>
        ${chips}
      </div>
      ${ctaHref ? `<span class="cta"><a href="${ctaHref}" target="_blank" rel="noopener">${ctaLabel || "open"} ↗</a></span>` : ""}
    </div>`;
}

function bindCardActions(root) {
  root.querySelectorAll(".action").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      if (btn.dataset.act === "bookmark") toggleBookmark(id);
      else if (btn.dataset.act === "up") vote(id, myVote(id) === 1 ? 0 : 1);
      else if (btn.dataset.act === "down") vote(id, myVote(id) === -1 ? 0 : -1);
    });
  });
}

function matchesSearch(...fields) {
  const Q = q();
  if (!Q) return true;
  return fields.filter(Boolean).join(" ").toLowerCase().includes(Q);
}

// ---------- renderers ----------
function renderAll() {
  renderFavorites();
  renderDrops();
  renderBrands();
  renderStores();
  renderCities();
  renderSellers();
  renderSurveys();
  renderPlay();
  renderFriends();
}

// Favorites: status pill, price, note, action foot. Image when present.
function renderFavorites() {
  const grid = $("grid-favorites");
  grid.innerHTML = "";
  const list = [...data.favorites].sort((a, b) => {
    const sa = score(a.id), sb = score(b.id);
    if (sb !== sa) return sb - sa;
    return (b.fit || 0) - (a.fit || 0);
  });
  for (const w of list) {
    if (!matchesSearch(w.brand, w.model, (w.tags || []).join(" "), w.dial)) continue;
    const img = w.image
      ? `<a class="img" href="${w.url}" target="_blank" rel="noopener"><img loading="lazy" alt="${w.brand} ${w.model}" src="${w.image}"/></a>`
      : "";
    const statusClass = w.status === "own-target" || w.status === "lottery" ? "accent"
      : w.status === "available" ? "good"
      : w.status === "salon-only" ? "accent" : "dim";
    grid.insertAdjacentHTML("beforeend", `
      <article class="card${w.image ? " with-image" : ""}" data-id="${w.id}">
        ${img}
        <div class="body">
          <h2>${w.model}</h2>
          <p class="sub">${w.brand} · ${w.size_mm}mm</p>
          <p class="price">${formatPrice(w)}</p>
          <div class="pills">
            <span class="pill ${statusClass}">${w.status.replace("-", " ")}</span>
            ${w.fit != null ? `<span class="pill dim">fit ${w.fit}</span>` : ""}
          </div>
          ${w.note ? `<p class="note">${w.note}</p>` : ""}
          ${isOwner() && privateCipherFor(w.id) ? `<div class="private-slot" data-id="${w.id}">${PRIVATE.unlocked ? '' : '<p class="private-block locked">🔒 unlock to view</p>'}</div>` : ""}
          ${actionFoot(w.id, w.url, "view")}
        </div>
      </article>`);
  }
  if (!grid.children.length) grid.innerHTML = `<p class="kv">Nothing matches.</p>`;
  bindCardActions(grid);
  hydratePrivateSlots(grid);
}

async function hydratePrivateSlots(root) {
  if (!PRIVATE.unlocked) return;
  const slots = root.querySelectorAll(".private-slot");
  for (const slot of slots) {
    slot.innerHTML = await privateBlock(slot.dataset.id);
  }
}

// Drops: title, brand, window, refs, action foot
function renderDrops() {
  const grid = $("grid-drops");
  if (!grid) return;
  grid.innerHTML = "";
  const drops = (data.drops || []).slice().sort((a, b) => {
    const aS = a.starts_iso ? Date.parse(a.starts_iso) : Infinity;
    const bS = b.starts_iso ? Date.parse(b.starts_iso) : Infinity;
    return aS - bS;
  });
  const now = Date.now();
  for (const d of drops) {
    if (!matchesSearch(d.title, d.brand, d.note)) continue;
    const start = d.starts_iso ? Date.parse(d.starts_iso) : null;
    const end = d.ends_iso ? Date.parse(d.ends_iso) : null;
    const isOpen = start && end && start <= now && now <= end;
    const isUpcoming = start && start > now;
    const statusLabel = isOpen ? "open now" : isUpcoming ? `in ${Math.max(0, Math.ceil((start - now) / 86400000))}d` : "ongoing";
    const statusClass = isOpen ? "good" : isUpcoming ? "accent" : "dim";
    const id = `drop:${d.id}`;
    grid.insertAdjacentHTML("beforeend", `
      <article class="card" data-id="${id}">
        <div class="body">
          <h2>${d.title}</h2>
          <p class="sub">${d.brand} · ${d.type.replace("-", " ")}</p>
          <p class="price">${d.tz_label || ""}</p>
          <div class="pills">
            <span class="pill ${statusClass}">${statusLabel}</span>
          </div>
          ${d.note ? `<p class="note">${d.note}</p>` : ""}
          ${actionFoot(id, d.url, isOpen ? "apply" : "open")}
        </div>
      </article>`);
  }
  if (!grid.children.length) grid.innerHTML = `<p class="kv">No drops match.</p>`;
  bindCardActions(grid);
}

// Brands: name, tier pill, cities, range, note, stockists. No filters.
function renderBrands() {
  const grid = $("grid-brands");
  grid.innerHTML = "";
  const list = [...data.brands].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  for (const b of list) {
    if (!matchesSearch(b.name, (b.tags || []).join(" "), b.note, b.style)) continue;
    const id = `brand:${b.name}`;
    const stockists = (b.stockists || []).slice(0, 3).map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.name}</a>`).join(" · ");
    grid.insertAdjacentHTML("beforeend", `
      <article class="card" data-id="${id}">
        <div class="body">
          <h2>${b.name}</h2>
          <p class="sub">${(b.cities || []).join(" · ")}${b.founded ? ` · est. ${b.founded}` : ""}</p>
          <p class="price">${b.price_range || ""}</p>
          <div class="pills">
            <span class="pill accent">Tier ${b.tier}</span>
          </div>
          ${b.note ? `<p class="note">${b.note}</p>` : ""}
          ${stockists ? `<p class="kv">Through: ${stockists}</p>` : ""}
          ${actionFoot(id, b.url, "site")}
        </div>
      </article>`);
  }
  bindCardActions(grid);
}

// Stores: city chips at top, then grid. Tap a chip to filter.
let activeStoreCity = "";
function buildStoreCityFilter() {
  const wrap = $("store-cities");
  const cities = [...new Set(data.stores.map(s => s.city))].sort((a, b) => {
    const order = ["Tokyo", "Kobe", "Kyoto", "Osaka", "Hong Kong", "New York", "London"];
    return order.indexOf(a) - order.indexOf(b);
  });
  wrap.innerHTML = `<button class="chip-btn active" data-city="">all</button>` +
    cities.map(c => `<button class="chip-btn" data-city="${c}">${c}</button>`).join("");
  wrap.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeStoreCity = btn.dataset.city;
      wrap.querySelectorAll(".chip-btn").forEach(b => b.classList.toggle("active", b === btn));
      renderStores();
    });
  });
}

function renderStores() {
  const grid = $("grid-stores");
  grid.innerHTML = "";
  const list = [...data.stores].sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
  for (const s of list) {
    if (activeStoreCity && s.city !== activeStoreCity) continue;
    if (!matchesSearch(s.name, s.city, s.neighborhood, (s.brands || []).join(" "), (s.tags || []).join(" "), s.note)) continue;
    const id = `store:${s.city}:${s.name}`;
    const mapsHref = s.address ? `https://www.google.com/maps/search/${encodeURIComponent(s.name + " " + s.address)}` : null;
    const brands = (s.brands || []).slice(0, 4).map(b => `<span class="pill dim">${b}</span>`).join("");
    const typePill = s.type === "brand-salon" || s.type === "atelier" ? "accent" : "dim";
    grid.insertAdjacentHTML("beforeend", `
      <article class="card" data-id="${id}">
        <div class="body">
          <h2>${s.name}</h2>
          <p class="sub">${s.city}${s.neighborhood ? " · " + s.neighborhood : ""}</p>
          <div class="pills">
            <span class="pill ${typePill}">${s.type.replace("-", " ")}</span>
            ${brands}
          </div>
          ${s.hours ? `<p class="kv">${s.hours}</p>` : ""}
          ${s.appointment ? `<p class="kv">By: ${s.appointment}</p>` : ""}
          ${s.note ? `<p class="note">${s.note}</p>` : ""}
          ${actionFoot(id, s.url || mapsHref, s.url ? "site" : "map")}
        </div>
      </article>`);
  }
  if (!grid.children.length) grid.innerHTML = `<p class="kv">No stores match.</p>`;
  bindCardActions(grid);
}

// Cities: each card lists every store in that city (compact)
function renderCities() {
  const grid = $("grid-cities");
  grid.innerHTML = "";
  for (const c of data.cities) {
    if (!matchesSearch(c.name, c.country, (c.tags || []).join(" "), c.note)) continue;
    const stores = data.stores.filter(s => s.city === c.name);
    const items = stores.map(s => `<li>${s.name} <span class="kv">· ${s.type.replace("-", " ")}</span></li>`).join("");
    const id = `city:${c.name}`;
    grid.insertAdjacentHTML("beforeend", `
      <article class="card" data-id="${id}">
        <div class="body">
          <h2>${c.name}</h2>
          <p class="sub">${c.country}${c.neighborhoods ? " · " + c.neighborhoods.slice(0, 3).join(", ") : ""}</p>
          ${c.note ? `<p class="note">${c.note}</p>` : ""}
          <p class="kv">${stores.length} store${stores.length === 1 ? "" : "s"}</p>
          <ul class="kv" style="margin:0;padding-left:18px">${items}</ul>
          ${actionFoot(id, null, null)}
        </div>
      </article>`);
  }
  bindCardActions(grid);
}

// Sellers: name, type pill, best for, link.
function renderSellers() {
  const grid = $("grid-sellers");
  grid.innerHTML = "";
  for (const s of data.sellers) {
    if (!matchesSearch(s.name, (s.tags || []).join(" "), s.note, s.best_for)) continue;
    const id = `seller:${s.name}`;
    grid.insertAdjacentHTML("beforeend", `
      <article class="card" data-id="${id}">
        <div class="body">
          <h2>${s.name}</h2>
          <p class="sub">${s.based_in || ""}</p>
          <div class="pills">
            <span class="pill accent">${s.type}</span>
          </div>
          ${s.best_for ? `<p class="note">${s.best_for}</p>` : ""}
          ${actionFoot(id, s.url, "visit")}
        </div>
      </article>`);
  }
  bindCardActions(grid);
}

// ---------- Survey: upvote-with-name list ----------
async function toggleUpvote(watchId) {
  if (!me) { nickInput.focus(); return; }
  state.surveyUpvotes = state.surveyUpvotes || {};
  const list = state.surveyUpvotes[watchId] = state.surveyUpvotes[watchId] || [];
  const i = list.indexOf(me);
  if (i >= 0) list.splice(i, 1); else list.push(me);
  await Storage.save(state);
  renderSurveys();
}

function upvotesFor(watchId) {
  return state.surveyUpvotes?.[watchId] || [];
}

function renderSurveys() {
  const grid = $("grid-surveys");
  if (!grid) return;
  const Q = q();
  // Survey scope: watches under $3K
  const inScope = (w) => (w.price_usd ?? w.price_usd_low ?? Infinity) <= 3000;
  const list = data.favorites
    .filter(inScope)
    .sort((a, b) => upvotesFor(b.id).length - upvotesFor(a.id).length);
  grid.innerHTML = `
    <div class="survey-intro">
      <h2>Friends' picks · under $3,000</h2>
      <p class="sub">Click any watches you'd vote for. Your name attaches publicly — flag the ones you'd actually wear or gift.</p>
    </div>
  `;
  const rows = list.map(w => {
    if (Q && !`${w.brand} ${w.model} ${(w.tags||[]).join(' ')}`.toLowerCase().includes(Q)) return "";
    const ups = upvotesFor(w.id);
    const mine = me && ups.includes(me);
    return `
      <button class="upvote-row ${mine ? 'mine' : ''}" data-id="${w.id}">
        <span class="upbtn">${mine ? '★' : '☆'}</span>
        <span class="count">${ups.length || ''}</span>
        <span class="label">
          <span class="model">${w.model}</span>
          <span class="brand">${w.brand} · ${w.size_mm}mm · ${w.price_label || formatPrice(w)}</span>
        </span>
        <span class="names">${ups.map(n => `<span class="name-chip">${n}</span>`).join('')}</span>
      </button>`;
  }).join("");
  grid.insertAdjacentHTML("beforeend", `<div class="upvote-list">${rows}</div>`);
  grid.querySelectorAll(".upvote-row").forEach(btn => {
    btn.addEventListener("click", () => toggleUpvote(btn.dataset.id));
  });
}

// ---------- Play (guess the watch) ----------
const PLAY_KEY = "watch-watch:play";
let playState = JSON.parse(localStorage.getItem(PLAY_KEY) || "null") || { round: null };

function newRound() {
  const pool = (data.favorites || []).filter(w => priceBucket(w) !== "unknown");
  if (!pool.length) return null;
  const lastId = playState.round?.watchId;
  const candidates = pool.length > 1 ? pool.filter(w => w.id !== lastId) : pool;
  const watch = candidates[Math.floor(Math.random() * candidates.length)];
  return { watchId: watch.id, guesses: {}, revealed: false };
}

function priceBucket(w) {
  const p = w.price_usd ?? w.price_usd_low ?? null;
  if (p == null) return "unknown";
  if (p < 2000) return "<$2k";
  if (p < 5000) return "$2-5k";
  if (p < 10000) return "$5-10k";
  if (p < 25000) return "$10-25k";
  return "$25k+";
}

function caseBucket(w) {
  if (w.size_mm < 35) return "34mm";
  if (w.size_mm <= 37) return "35-37mm";
  return "38mm+";
}

function dialMaterial(w) {
  const t = ((w.tags || []).join(" ") + " " + (w.dial || "")).toLowerCase();
  if (/urushi|lacquer/.test(t)) return "urushi/lacquer";
  if (/guilloch/.test(t)) return "guilloche";
  if (/meteorite/.test(t)) return "meteorite";
  if (/lapis/.test(t)) return "lapis lazuli";
  if (/argentium|german silver|sterling/.test(t)) return "silver";
  if (/sector/.test(t)) return "sector";
  if (/sunburst/.test(t)) return "sunburst";
  return "other";
}

function productionTier(w) {
  const text = ((w.tags || []).join(" ") + " " + (w.note || "")).toLowerCase();
  const m = text.match(/(\d+)\s*(?:pieces|pcs|pc\b)/);
  if (m) {
    const n = +m[1];
    if (n < 50) return "<50";
    if (n < 200) return "50-200";
    if (n < 500) return "200-500";
    if (n < 2000) return "500-2000";
    return "2000+";
  }
  // fallback heuristics
  if (/atelier|tourbillon|in-house|dream/.test(text)) return "<50";
  return "200-500";
}

const Q_DEFS = [
  { key: "country",      label: "Country",         pts: 1, opts: ["Japan", "Switzerland", "Germany", "UK", "USA", "Other"] },
  { key: "city",         label: "City made",       pts: 2, opts: ["Tokyo", "Akita", "Geneva", "Glashütte", "Other"] },
  { key: "brand",        label: "Brand",           pts: 5, opts: null },
  { key: "retailBucket", label: "Retail bucket",   pts: 3, opts: ["<$2k", "$2-5k", "$5-10k", "$10-25k", "$25k+"] },
  { key: "caseBucket",   label: "Case size",       pts: 1, opts: ["34mm", "35-37mm", "38mm+"] },
  { key: "dialMaterial", label: "Dial material",   pts: 3, opts: ["urushi/lacquer", "guilloche", "silver", "meteorite", "lapis lazuli", "sector", "sunburst", "other"] },
  { key: "production",   label: "Production tier", pts: 2, opts: ["<50", "50-200", "200-500", "500-2000", "2000+"] },
];

function correctAnswers(w) {
  return {
    country: w.country || "Other",
    city: ["Tokyo", "Akita", "Geneva", "Glashütte"].includes(w.made_in) ? w.made_in : "Other",
    brand: w.brand,
    retailBucket: priceBucket(w),
    caseBucket: caseBucket(w),
    dialMaterial: dialMaterial(w),
    production: productionTier(w),
  };
}

function savePlay() { localStorage.setItem(PLAY_KEY, JSON.stringify(playState)); }

async function submitGuess() {
  const r = playState.round;
  if (!r) return;
  const w = data.favorites.find(x => x.id === r.watchId);
  if (!w) return;
  const truth = correctAnswers(w);
  let pts = 0;
  r.results = {};
  for (const def of Q_DEFS) {
    const ok = (r.guesses[def.key] || "") === truth[def.key];
    r.results[def.key] = { ok, correct: truth[def.key], guess: r.guesses[def.key] || "—", pts: ok ? def.pts : 0 };
    if (ok) pts += def.pts;
  }
  r.revealed = true;
  r.points = pts;

  if (me) {
    state.scores = state.scores || {};
    state.scores[me] = state.scores[me] || { lifetime: 0, rounds: 0, lastPlayed: null };
    state.scores[me].lifetime += pts;
    state.scores[me].rounds += 1;
    state.scores[me].lastPlayed = new Date().toISOString().slice(0, 10);
    await Storage.save(state);
  }
  savePlay();
  renderPlay();
}

function nextRound() {
  playState.round = newRound();
  savePlay();
  renderPlay();
}

function renderPlay() {
  const stage = $("play-stage");
  const lb = $("grid-leaderboard");
  if (!stage) return;
  if (!playState.round) playState.round = newRound();

  const r = playState.round;
  const w = data.favorites.find(x => x.id === r.watchId);
  if (!w) { stage.innerHTML = `<p class="kv">No catalog yet.</p>`; return; }

  const brands = [...new Set(data.favorites.map(x => x.brand))].sort();
  const hasImg = !!w.image;
  r.guesses = r.guesses || {};

  const questionFields = Q_DEFS.map(def => {
    const opts = def.opts || brands;
    const cur = r.guesses[def.key] || "";
    return `
      <label>${def.label} <span class="q-pts">+${def.pts}</span>
        <select data-q="${def.key}">
          <option value="">pick…</option>
          ${opts.map(o => `<option value="${o}" ${cur === o ? "selected" : ""}>${o}</option>`).join("")}
        </select>
      </label>`;
  }).join("");

  stage.className = "play-stage" + (hasImg ? " with-image" : "");
  stage.innerHTML = `
    ${hasImg ? `<img class="silhouette ${r.revealed ? "" : "hidden-img"}" src="${w.image}" alt="mystery watch"/>` : ""}
    <div class="clue">
      <h3>Offhand</h3>
      <p class="sub">a game to explore the unknown · 7 questions per round</p>
      <p class="clue-line"><b>Strap:</b> ${w.strap || "—"}</p>
      <p class="clue-line"><b>Dial:</b> ${w.dial || "—"}</p>
      ${(() => {
        const safe = (w.tags || []).filter(t => {
          const s = t.toLowerCase();
          if (/\d+\s*(pcs|pieces)/.test(s)) return false;
          if (s.includes("hajime") || s.includes("aoyama") || s.includes("armoury")) return false;
          if (s.includes(w.brand.split(" ")[0].toLowerCase())) return false;
          return true;
        }).slice(0, 3);
        return safe.length ? `<div class="pills">${safe.map(t => `<span class="pill dim">${t}</span>`).join("")}</div>` : "";
      })()}
      ${r.revealed ? renderReveal(w, r) : `
        <form class="play-form" onsubmit="return false">
          ${questionFields}
          <div class="play-buttons">
            <button id="g-submit">Submit</button>
            <button id="g-skip" class="secondary">Skip</button>
          </div>
          <p class="survey-meta">${me ? `Playing as ${me} · max ${Q_DEFS.reduce((s, d) => s + d.pts, 0)} pts/round` : "Set a nickname to track your score."}</p>
        </form>
      `}
    </div>`;

  if (!r.revealed) {
    stage.querySelectorAll("select[data-q]").forEach(sel => {
      sel.addEventListener("change", e => {
        r.guesses[sel.dataset.q] = e.target.value;
        savePlay();
      });
    });
    stage.querySelector("#g-submit").addEventListener("click", submitGuess);
    stage.querySelector("#g-skip").addEventListener("click", nextRound);
  } else {
    stage.querySelector("#g-next")?.addEventListener("click", nextRound);
  }

  // leaderboard
  const scores = Object.entries(state.scores || {}).map(([nick, s]) => ({ nick, ...s }));
  scores.sort((a, b) => (b.lifetime || 0) - (a.lifetime || 0));
  lb.innerHTML = "";
  if (!scores.length) {
    lb.innerHTML = `<p class="kv">No scores yet — play a round.</p>`;
    return;
  }
  for (const s of scores) {
    lb.insertAdjacentHTML("beforeend", `
      <article class="card">
        <div class="body">
          <h2>${s.nick}${s.nick === me ? " · you" : ""}</h2>
          <p class="sub">${s.rounds} round${s.rounds === 1 ? "" : "s"} · last played ${s.lastPlayed || "—"}</p>
          <p class="price">${s.lifetime || 0} pts</p>
        </div>
      </article>`);
  }
}

function renderReveal(w, r) {
  const rows = Q_DEFS.map(def => {
    const res = r.results?.[def.key] || { ok: false, correct: "—", guess: "—", pts: 0 };
    return `
      <div class="reveal-row">
        <span class="rl">${def.label}</span>
        <span class="rg">${res.guess}</span>
        <span class="rc">${res.ok ? `<span class="pts">+${def.pts}</span>` : `<span class="rwrong">${res.correct}</span>`}</span>
      </div>`;
  }).join("");
  return `
    <div class="reveal">
      <h4>${w.brand} — ${w.model}</h4>
      <p class="clue-line">${w.country}${w.made_in ? " · " + w.made_in : ""} · ${w.price_label || formatPrice(w)}</p>
      <div class="reveal-grid">${rows}</div>
      <p class="clue-line" style="margin-top:8px"><b>+${r.points} pts</b> this round</p>
      ${w.note ? `<p class="clue-line" style="color:var(--muted)">${w.note}</p>` : ""}
      <div class="play-buttons" style="margin-top:8px">
        <button id="g-next">Next round</button>
      </div>
    </div>`;
}

// Friends: each card = a person and their stars
function renderFriends() {
  const grid = $("grid-friends");
  grid.innerHTML = "";
  const users = Object.values(state.users);
  if (!users.length) {
    grid.innerHTML = `<p class="kv">No nicknames yet — set yours up top.</p>`;
    return;
  }
  for (const u of users) {
    const items = (u.bookmarks || []).map(id => {
      const w = data.favorites.find(x => x.id === id);
      if (w) return `<li><a href="${w.url}" target="_blank" rel="noopener">${w.brand} — ${w.model}</a></li>`;
      const m = id.match(/^(brand|city|seller|store|drop):(.+)$/);
      if (m) return `<li><span class="kv">${m[1]}</span> ${m[2]}</li>`;
      return `<li>${id}</li>`;
    }).join("");
    grid.insertAdjacentHTML("beforeend", `
      <article class="card">
        <div class="body">
          <h2>${u.nickname}</h2>
          <p class="sub">${(u.bookmarks || []).length} bookmark${(u.bookmarks || []).length === 1 ? "" : "s"}${u.nickname === me ? " · you" : ""}</p>
          <ul class="kv" style="margin:8px 0 0; padding-left:18px">${items || "<li>nothing yet</li>"}</ul>
        </div>
      </article>`);
  }
}
