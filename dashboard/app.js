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
  const bm = isBookmarked(id);
  const bms = bookmarkers(id).filter(u => u.nickname !== me).slice(0, 3);
  const chips = bms.length
    ? `<span class="who-chips">${bms.map(u => `<span class="who-chip" title="${u.nickname} bookmarked">${u.nickname}</span>`).join("")}</span>`
    : "";
  return `
    <div class="foot">
      <button class="action star ${bm ? "on" : ""}" data-act="bookmark" data-id="${id}" aria-label="${bm ? "Remove bookmark" : "Bookmark"}">${bm ? "★" : "☆"}</button>
      ${chips}
      ${ctaHref ? `<a class="cta" href="${ctaHref}" target="_blank" rel="noopener">${ctaLabel || "open"} ↗</a>` : ""}
    </div>`;
}

function bindCardActions(root) {
  root.querySelectorAll(".action").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (btn.dataset.act === "bookmark") toggleBookmark(btn.dataset.id);
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
  renderMarkets();
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
    const imgSrc = w.image || `./images/${w.id}.jpg`;
    // Try .jpg → fall back to .webp → .png → .avif before giving up
    const fallback = `onerror="(function(i){const ext=i.src.match(/\\.([a-z]+)$/i)?.[1]||'';const chain={jpg:'webp',webp:'png',png:'avif'};const next=chain[ext];if(next){i.src=i.src.replace(/\\.[a-z]+$/i,'.'+next);}else{i.parentElement.style.display='none';i.parentElement.parentElement.classList.remove('with-image');}})(this)"`;
    const img = `<a class="img" href="${w.url}" target="_blank" rel="noopener"><img loading="lazy" alt="${w.brand} ${w.model}" src="${imgSrc}" ${fallback}/></a>`;
    const statusClass = w.status === "own-target" || w.status === "lottery" ? "accent"
      : w.status === "available" ? "good"
      : w.status === "salon-only" ? "accent" : "dim";
    grid.insertAdjacentHTML("beforeend", `
      <article class="card with-image" data-id="${w.id}">
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
          <p class="sub">${(b.cities || []).join(" · ")}${b.founded ? ` · est. ${b.founded}` : ""}${b.country ? " · " + b.country : ""}</p>
          <p class="price">${b.price_range || ""}</p>
          <div class="pills">
            <span class="pill accent">Tier ${b.tier}</span>
          </div>
          ${b.bio ? `<p class="bio">${b.bio}</p>` : (b.note ? `<p class="note">${b.note}</p>` : "")}
          ${stockists ? `<p class="kv">Through: ${stockists}</p>` : ""}
          ${actionFoot(id, b.url, "site")}
        </div>
      </article>`);
  }
  bindCardActions(grid);
}

function brandBio(brandName) {
  const b = (data.brands || []).find(x => x.name === brandName);
  return b?.bio || "";
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

// ---------- Play: HomeGuessr-style daily challenge ----------
const PLAY_KEY = "watch-watch:play";
const ROUNDS_PER_DAY = 5;
const PRICE_MIN = 1000;
const PRICE_MAX = 120000;

// City coordinates for the map-based location guess
const CITY_COORDS = {
  "Tokyo": [35.6762, 139.6503], "Akita": [39.7186, 140.1024],
  "Saitama": [35.8617, 139.6455], "Kyoto": [35.0116, 135.7681],
  "Kobe": [34.6901, 135.1956], "Shanghai": [31.2304, 121.4737],
  "Schaffhausen": [47.6975, 8.6346], "Geneva": [46.2044, 6.1432],
  "Môtiers": [46.9128, 6.6225], "Sainte-Croix": [46.8189, 6.5060],
  "Le Locle": [47.0581, 6.7475], "Bienne": [47.1378, 7.2469],
  "Le Sentier": [46.6233, 6.2336],
  "Glashütte": [50.8543, 13.7805], "Schramberg": [48.2289, 8.3854],
  "Dresden": [51.0504, 13.7373], "Radeberg": [51.1142, 13.9128],
  "Vienna": [48.2082, 16.3738],
  "Paris": [48.8566, 2.3522], "Brittany": [48.0000, -2.7000],
  "Prague": [50.0755, 14.4378],
  "Seoul": [37.5665, 126.9780],
  "Stockholm": [59.3293, 18.0686], "Linköping": [58.4108, 15.6214],
  "Glasgow": [55.8642, -4.2518],
  "Helsinki": [60.1699, 24.9384],
  "Norfolk": [52.6309, 1.2974], "Bristol": [51.4545, -2.5879],
  "Isle of Man": [54.2361, -4.5481],
  "Mount Joy, PA": [40.1109, -76.5025],
  "Los Angeles": [34.0522, -118.2437],
  "Moscow": [55.7558, 37.6173],
};

function coordsForWatch(w) {
  const made = w.made_in;
  if (CITY_COORDS[made]) return CITY_COORDS[made];
  // try best-effort match by prefix
  for (const k of Object.keys(CITY_COORDS)) {
    if (made && made.toLowerCase().includes(k.toLowerCase())) return CITY_COORDS[k];
  }
  return null;
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function locationPoints(km) {
  if (km == null) return 0;
  if (km <= 50) return 50;
  if (km <= 200) return 40;
  if (km <= 500) return 28;
  if (km <= 1500) return 18;
  if (km <= 5000) return 8;
  return 3; // consolation floor — at least you tried
}

// Brand-revealing words to mask in game-stage clue text.
// Includes brand names, model names, signature design words, and craft markers
// that would tip a knowledgeable player to the right brand.
const BRAND_STOPWORDS = new Set([
  "kurono", "asaoka", "hajime", "naoya", "hida", "kikuchi", "nakagawa",
  "murakumo", "ichimonji", "genmon", "masa", "pastime", "nayuta", "sohkoku",
  "nagi", "minase", "divido", "yusai", "daizoh", "makihara", "kazuo", "maeda",
  "heures", "quiet", "club", "kikuno", "masahiro", "wadokei", "otsuka", "lotec",
  "voutilainen", "vingt", "akrivia", "rexhepi", "laurent", "ferrier", "journe",
  "fpjourne", "fp", "garrick", "rgm", "shapiro", "sarpaneva", "korona", "moser",
  "endeavour", "lang", "heyne", "georg", "friedrich", "august", "anordain",
  "paulin", "fears", "brunswick", "weiss",
  "shiraai", "akane", "mori", "persimmon", "darkmist", "toki", "bunkyo",
  "hagane", "inseki", "aoyama", "sensu", "calligra", "kikutsunagimon", "kikutsunagi",
  "tsunami", "resurgence", "souverain", "souveraine",
  "edo", "kiriko",
]);

function scrubBrandWords(text) {
  if (!text) return text;
  return text.replace(/[A-Za-z']+/g, tok =>
    BRAND_STOPWORDS.has(tok.toLowerCase()) ? "▒".repeat(Math.min(tok.length, 6)) : tok
  );
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

// Mulberry32 PRNG, seeded from a date string
function seededPicker(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let s = h >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dailyWatchIds(dateStr) {
  const all = (data.favorites || []).filter(w => priceBucket(w) !== "unknown" && coordsForWatch(w));
  const primers = all.filter(w => w.category === "primer");
  const indies = all.filter(w => w.category !== "primer");
  if (!all.length) return [];
  const rng = seededPicker(dateStr);
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const out = [];
  // Round 1: primer if available
  if (primers.length) out.push(shuffle(primers)[0].id);
  // Rounds 2..N: indies
  const indiePicks = shuffle(indies).slice(0, ROUNDS_PER_DAY - out.length);
  for (const w of indiePicks) out.push(w.id);
  return out;
}

let playState = JSON.parse(localStorage.getItem(PLAY_KEY) || "null") || null;

function initPlayStateOnce() {
  // Called once after `data` is loaded.
  const today = todayISO();
  if (playState && playState.date === today && Array.isArray(playState.watches) && playState.watches.length) return;
  playState = {
    date: today,
    watches: dailyWatchIds(today),
    rounds: [],
    idx: 0,
    stage: "map",
    guessLatLng: null,
    selectedBrand: "",
    sliderPrice: 5000,
  };
  savePlay();
}

function priceFor(w) { return w.price_usd ?? w.price_usd_low ?? null; }

function pricePoints(guess, w) {
  const truth = priceFor(w);
  if (truth == null || guess == null) return 0;
  const off = Math.abs(guess - truth) / truth;
  if (off <= 0.10) return 50;
  if (off <= 0.20) return 40;
  if (off <= 0.35) return 28;
  if (off <= 0.60) return 15;
  if (off <= 1.00) return 5;
  return 0;
}

const QUIPS = {
  perfect: [
    "Hajime would weep. You're a menace.",
    "Cartier called — they'd like their oracle back.",
    "Voutilainen sends his regards.",
    "Are you a watchmaker or just very online?",
  ],
  bothGood: [
    "Quietly excellent.",
    "The kind of guess that earns a nod at the salon.",
    "Tasteful and informed. The two-piece suit of guesses.",
    "Restrained, like the watches themselves.",
  ],
  locOnly: [
    "You found the workshop. Now figure out what it costs.",
    "Right town, wrong tier.",
    "You can read a map. The price tag is harder.",
    "Geography: nailed it. Pricing: revisit.",
  ],
  priceOnly: [
    "Your pricing is elite. Your geography is in witness protection.",
    "You priced it like an insider. You located it like a tourist.",
    "Spreadsheet brain, atlas heart.",
    "If the watch is on the moon, you'll know what it costs.",
  ],
  partial: [
    "Both guesses orbiting truth. Try again.",
    "Hovering near the right answer without landing.",
    "Half-credit on both fronts — tomorrow we converge.",
    "You're in the neighborhood. Wrong street, wrong house.",
  ],
  flop: [
    "Big swing, big miss. Tomorrow's another day.",
    "The good news: there's only one direction to go.",
    "We don't talk about this round.",
    "Tactical retreat. Regroup at dawn.",
    "Even the watchmaker would have been confused by that guess.",
  ],
};

function pickQuip(bucket) {
  const arr = QUIPS[bucket] || QUIPS.flop;
  return arr[Math.floor(Math.random() * arr.length)];
}

function quipFor(locPts, pricePts) {
  const l = locPts >= 28;
  const p = pricePts >= 28;
  if (locPts === 50 && pricePts === 50) return pickQuip("perfect");
  if (l && p) return pickQuip("bothGood");
  if (l && !p) return pickQuip("locOnly");
  if (!l && p) return pickQuip("priceOnly");
  if (locPts > 5 || pricePts > 5) return pickQuip("partial");
  return pickQuip("flop");
}

function savePlay() { localStorage.setItem(PLAY_KEY, JSON.stringify(playState)); }

function startNewDayIfNeeded() {
  if (!playState) initPlayStateOnce();
  const today = todayISO();
  if (playState.date !== today) {
    playState = {
      date: today,
      watches: dailyWatchIds(today),
      rounds: [],
      idx: 0,
      stage: "map",
      guessLatLng: null,
      selectedBrand: "",
      sliderPrice: 5000,
    };
    savePlay();
  }
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

async function commitDayResultIfComplete() {
  if (!me) return;
  if (playState.rounds.length < playState.watches.length) return;
  const total = playState.rounds.reduce((s, r) => s + r.total, 0);
  state.daily = state.daily || {};
  state.daily[playState.date] = state.daily[playState.date] || {};
  state.daily[playState.date][me] = { total, rounds: playState.rounds.length };
  state.scores = state.scores || {};
  state.scores[me] = state.scores[me] || { lifetime: 0, daysPlayed: 0, lastPlayed: null };
  if (!state.scores[me].lastDay || state.scores[me].lastDay !== playState.date) {
    state.scores[me].lifetime += total;
    state.scores[me].daysPlayed += 1;
    state.scores[me].lastDay = playState.date;
    state.scores[me].lastPlayed = playState.date;
  }
  await Storage.save(state);
}

async function submitMap() {
  if (!playState.guessLatLng) return;
  playState.stage = "price";
  savePlay();
  renderPlay();
}

async function submitPrice() {
  const w = data.favorites.find(x => x.id === playState.watches[playState.idx]);
  if (!w) return;
  const truth = coordsForWatch(w);
  const km = playState.guessLatLng && truth ? haversineKm(playState.guessLatLng, truth) : null;
  const locPts = locationPoints(km);
  const pricePts = pricePoints(playState.sliderPrice, w);
  const round = {
    watchId: w.id,
    guessLatLng: playState.guessLatLng,
    actualLatLng: truth,
    locKm: km,
    locPts,
    price: playState.sliderPrice,
    pricePts,
    total: locPts + pricePts,
  };
  playState.rounds.push(round);
  playState.stage = "reveal";
  savePlay();
  renderPlay();
}

async function nextRound() {
  if (playState.idx + 1 >= playState.watches.length) {
    playState.stage = "complete";
    await commitDayResultIfComplete();
    savePlay();
    renderPlay();
    return;
  }
  playState.idx += 1;
  playState.stage = "map";
  playState.guessLatLng = null;
  playState.selectedBrand = "";
  playState.sliderPrice = 5000;
  savePlay();
  renderPlay();
}

function renderPlay() {
  const stage = $("play-stage");
  const lb = $("grid-leaderboard");
  if (!stage) return;
  startNewDayIfNeeded();

  if (!playState.watches?.length) {
    stage.innerHTML = `<p class="kv">No catalog yet.</p>`;
    return;
  }

  if (playState.stage === "complete") {
    stage.className = "play-stage";
    const total = playState.rounds.reduce((s, r) => s + r.total, 0);
    const max = playState.rounds.length * 100;
    const pct = Math.round(100 * total / max);
    const rows = playState.rounds.map((r, i) => {
      const w = data.favorites.find(x => x.id === r.watchId);
      return `
        <div class="day-row">
          <span class="rl">${i + 1}</span>
          <span class="rg">${w.brand} — ${w.model}</span>
          <span class="rc">${r.total}</span>
        </div>`;
    }).join("");
    stage.innerHTML = `
      <div class="clue">
        <p class="day-label">Daily challenge · ${playState.date}</p>
        <div class="big-pct">${pct}<span>%</span></div>
        <p class="day-sub">${total} / ${max} pts · ${playState.rounds.length} rounds</p>
        <div class="day-grid">${rows}</div>
        <p class="clue-line" style="margin-top:12px;color:var(--muted)">Come back tomorrow for a new lineup.</p>
      </div>`;
    renderLeaderboard();
    return;
  }

  const watchId = playState.watches[playState.idx];
  const w = data.favorites.find(x => x.id === watchId);
  const brands = [...new Set(data.favorites.map(x => x.brand))].sort();
  const imgSrc = w.image || `./images/${w.id}.jpg`;
  const hasImg = true; // try always; hidden via onerror if missing

  // PROGRESS BAR
  const segs = playState.watches.map((_, i) => {
    const cls = i < playState.rounds.length ? "done" : i === playState.idx ? "active" : "";
    return `<span class="seg ${cls}"></span>`;
  }).join("");

  if (playState.stage === "reveal") {
    const r = playState.rounds[playState.rounds.length - 1];
    const isLast = playState.idx + 1 >= playState.watches.length;
    const pct = Math.round(100 * r.total / 100);
    const kmStr = r.locKm == null ? "—" : r.locKm < 1 ? "<1 km" : `${Math.round(r.locKm).toLocaleString()} km`;
    const truthPrice = priceFor(w);
    const guessPrice = r.price ?? null;
    const priceOffStr = (truthPrice && guessPrice != null)
      ? `$${Math.abs(truthPrice - guessPrice).toLocaleString()} off`
      : "—";
    const celebrate = pct >= 80 ? `<span class="celebrate">${pct >= 95 ? "Insane" : "Excellent"}</span>` : "";
    const pctClass = pct >= 80 ? "high" : "";
    stage.className = "play-stage is-reveal" + (hasImg ? " with-image" : "");
    stage.innerHTML = `
      <img class="silhouette" src="${imgSrc}" alt="${w.brand} ${w.model}" onerror="(function(i){const ext=i.src.match(/\\.([a-z]+)$/i)?.[1]||'';const chain={jpg:'webp',webp:'png',png:'avif'};const next=chain[ext];if(next){i.src=i.src.replace(/\\.[a-z]+$/i,'.'+next);}else{i.style.display='none';}})(this)"/>
      <div class="clue">
        <p class="day-label">Round ${playState.idx + 1} of ${playState.watches.length}</p>
        <div class="progress">${segs}</div>
        <div class="big-pct ${pctClass}" data-target="${pct}"><span class="pct-num">0</span><span>%</span>${celebrate}</div>
        <p class="day-sub">${r.total} / 100 pts</p>
        <h4 class="reveal-watch">${w.brand} — ${w.model}</h4>
        <p class="reveal-meta">${w.made_in || ""}${w.country ? ", " + w.country : ""} · ${w.price_label || formatPrice(w)}</p>
        ${r.actualLatLng && r.guessLatLng ? `<div id="reveal-map" class="reveal-map"></div>` : ""}
        <div class="reveal-grid">
          <div class="reveal-row">
            <span class="rl">Made in</span>
            <span class="rg">${kmStr} off</span>
            <span class="rc">${r.locPts > 0 ? `<span class="pts">+${r.locPts}</span>` : `<span class="rwrong">+0</span>`}</span>
          </div>
          <div class="reveal-row">
            <span class="rl">Price</span>
            <span class="rg">$${(guessPrice ?? 0).toLocaleString()} · ${priceOffStr}</span>
            <span class="rc">${r.pricePts > 0 ? `<span class="pts">+${r.pricePts}</span>` : `<span class="rwrong">+0</span>`}</span>
          </div>
        </div>
        <p class="quip">${quipFor(r.locPts, r.pricePts)}</p>
        ${w.note ? `<p class="clue-line" style="color:var(--muted)">${w.note}</p>` : ""}
        ${brandBio(w.brand) ? `<p class="bio reveal-bio"><span class="bio-label">About ${w.brand}</span> ${brandBio(w.brand)}</p>` : ""}
        <div class="play-buttons" style="margin-top:8px">
          <button id="g-next">${isLast ? "See day result →" : "Next watch →"}</button>
        </div>
      </div>`;
    if (r.actualLatLng && r.guessLatLng) showRevealMap(r.guessLatLng, r.actualLatLng, r.locKm);
    animateScoreCounter();
    stage.querySelector("#g-next").addEventListener("click", nextRound);
    renderLeaderboard();
    return;
  }

  // STAGE: map | price
  stage.className = "play-stage" + (hasImg ? " with-image" : "");
  const stageBody = playState.stage === "map" ? renderStageMap(w) : renderStagePrice(w);
  stage.innerHTML = `
    <img class="silhouette hidden-img" src="${imgSrc}" alt="mystery watch" onerror="(function(i){const ext=i.src.match(/\\.([a-z]+)$/i)?.[1]||'';const chain={jpg:'webp',webp:'png',png:'avif'};const next=chain[ext];if(next){i.src=i.src.replace(/\\.[a-z]+$/i,'.'+next);}else{i.style.display='none';}})(this)"/>
    <div class="clue">
      <p class="day-label">Round ${playState.idx + 1} of ${playState.watches.length}</p>
      <div class="progress">${segs}</div>
      <p class="clue-line"><b>Strap:</b> ${w.strap || "—"}</p>
      <p class="clue-line"><b>Dial:</b> ${scrubBrandWords(w.dial) || "—"}</p>
      ${(() => {
        const safe = (w.tags || []).filter(t => {
          const s = t.toLowerCase();
          if (/\d+\s*(pcs|pieces|pc\b)/.test(s)) return false;
          if (s.includes("armoury")) return false;
          // any tag containing a stopword is dropped
          for (const word of s.split(/[^a-z]+/)) {
            if (word && BRAND_STOPWORDS.has(word)) return false;
          }
          return true;
        }).slice(0, 3);
        return safe.length ? `<div class="pills">${safe.map(t => `<span class="pill dim">${scrubBrandWords(t)}</span>`).join("")}</div>` : "";
      })()}
      ${stageBody}
      <p class="survey-meta">${me ? `Playing as ${me}` : "Set a nickname to save your score on the leaderboard."}</p>
    </div>`;

  if (playState.stage === "map") {
    initMap();
    stage.querySelector("#g-submit-map")?.addEventListener("click", submitMap);
    stage.querySelector("#g-skip-map")?.addEventListener("click", nextRound);
  } else if (playState.stage === "price") {
    const slider = stage.querySelector("#price-slider");
    const display = stage.querySelector("#price-display");
    slider?.addEventListener("input", e => {
      const pct = +e.target.value;
      const v = Math.round(sliderToPrice(pct));
      playState.sliderPrice = v;
      display.textContent = `$${v.toLocaleString()}`;
    });
    slider?.addEventListener("change", () => savePlay());
    stage.querySelector("#g-submit-price")?.addEventListener("click", submitPrice);
    stage.querySelector("#g-skip-price")?.addEventListener("click", nextRound);
  }

  renderLeaderboard();
}

function renderStageMap(w) {
  return `
    <p class="stage-label">Step 1 — Where is this watch made?</p>
    <div id="play-map" class="play-map"></div>
    <p class="map-hint" id="map-hint">${playState.guessLatLng ? "Pin dropped — submit or click again to move" : "Click the map to drop a pin"}</p>
    <div class="play-buttons sticky-cta">
      <button id="g-submit-map" ${playState.guessLatLng ? "" : "disabled"}>Submit location →</button>
      <button id="g-skip-map" class="secondary">Skip</button>
    </div>`;
}

function renderStageBrand(w, brands) {
  const tiles = brands.map(b => `
    <button class="brand-tile ${playState.selectedBrand === b ? "selected" : ""}" data-brand="${b}">${b}</button>
  `).join("");
  return `
    <p class="stage-label">Step 2 — Name the brand</p>
    <div class="brand-grid">${tiles}</div>
    <div class="play-buttons sticky-cta">
      <button id="g-submit-brand" ${playState.selectedBrand ? "" : "disabled"}>Submit brand →</button>
      <button id="g-skip-brand" class="secondary">Skip</button>
    </div>`;
}

let _map, _pin, _truthPin, _line;
function initMap() {
  if (!window.L) return; // Leaflet not loaded yet
  setTimeout(() => {
    const el = document.getElementById("play-map");
    if (!el || el.dataset.init === "1") {
      if (_map) _map.invalidateSize();
      return;
    }
    el.dataset.init = "1";
    _map = L.map(el, {
      worldCopyJump: true, attributionControl: false,
      zoomControl: true, minZoom: 1, maxZoom: 8,
    }).setView([30, 10], 1);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 10,
    }).addTo(_map);
    _map.on("click", (e) => {
      if (_pin) _map.removeLayer(_pin);
      _pin = L.circleMarker([e.latlng.lat, e.latlng.lng], {
        radius: 7, color: "#1a1612", fillColor: "#b85a2e", fillOpacity: 1, weight: 2,
      }).addTo(_map);
      playState.guessLatLng = [e.latlng.lat, e.latlng.lng];
      savePlay();
      const btn = document.getElementById("g-submit-map");
      if (btn) btn.disabled = false;
      const hint = document.getElementById("map-hint");
      if (hint) hint.textContent = "Pin dropped — submit or click again to move";
    });
    if (playState.guessLatLng) {
      _pin = L.circleMarker(playState.guessLatLng, {
        radius: 7, color: "#1a1612", fillColor: "#b85a2e", fillOpacity: 1, weight: 2,
      }).addTo(_map);
    }
  }, 30);
}

function animateScoreCounter() {
  const el = document.querySelector(".big-pct .pct-num");
  if (!el) return;
  const target = parseInt(el.parentElement.dataset.target, 10) || 0;
  const start = performance.now();
  const dur = 1200;
  function step(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(eased * target));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function showRevealMap(guess, truth, kmAway) {
  if (!window.L) return;
  setTimeout(() => {
    const el = document.getElementById("reveal-map");
    if (!el) return;
    const mp = L.map(el, {
      attributionControl: false, zoomControl: false,
      scrollWheelZoom: false, dragging: false, doubleClickZoom: false,
      minZoom: 1, maxZoom: 8,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
    }).addTo(mp);
    const guessIcon = L.circleMarker(guess, {
      radius: 7, color: "#1a1612", fillColor: "#b85a2e", fillOpacity: 1, weight: 2,
    }).addTo(mp);
    const truthIcon = L.circleMarker(truth, {
      radius: 8, color: "#1a1612", fillColor: "#1f4536", fillOpacity: 1, weight: 2,
    }).addTo(mp);
    L.polyline([guess, truth], { color: "#1a1612", weight: 1, dashArray: "4 4" }).addTo(mp);
    const bounds = L.latLngBounds([guess, truth]).pad(0.4);
    mp.fitBounds(bounds);
  }, 30);
}

// log scale: position 0..100 -> $500..$60K
function sliderToPrice(pct) {
  const lo = Math.log(PRICE_MIN);
  const hi = Math.log(PRICE_MAX);
  return Math.exp(lo + (hi - lo) * (pct / 100));
}
function priceToSlider(p) {
  const lo = Math.log(PRICE_MIN);
  const hi = Math.log(PRICE_MAX);
  return 100 * (Math.log(p) - lo) / (hi - lo);
}

function renderStagePrice(w) {
  const cur = playState.sliderPrice || 5000;
  return `
    <p class="stage-label">Step 2 — Guess the retail price</p>
    <div class="price-display" id="price-display">$${cur.toLocaleString()}</div>
    <input type="range" id="price-slider" min="0" max="100" step="0.1" value="${priceToSlider(cur)}" class="price-slider"/>
    <div class="price-scale"><span>$1K</span><span>$10K</span><span>$120K</span></div>
    <div class="play-buttons sticky-cta">
      <button id="g-submit-price">Submit price →</button>
      <button id="g-skip-price" class="secondary">Skip</button>
    </div>`;
}

function renderLeaderboard() {
  const lb = $("grid-leaderboard");
  if (!lb) return;
  const today = todayISO();
  const todays = state.daily?.[today] || {};
  const todayRows = Object.entries(todays).map(([nick, s]) => ({ nick, ...s, scope: "today" }));
  const lifetime = Object.entries(state.scores || {}).map(([nick, s]) => ({ nick, ...s, scope: "lifetime" }));
  todayRows.sort((a, b) => (b.total || 0) - (a.total || 0));
  lifetime.sort((a, b) => (b.lifetime || 0) - (a.lifetime || 0));

  lb.innerHTML = "";
  if (!todayRows.length && !lifetime.length) {
    lb.innerHTML = `<p class="kv">No scores yet — play a daily round.</p>`;
    return;
  }
  if (todayRows.length) {
    lb.insertAdjacentHTML("beforeend", `<div style="grid-column: 1 / -1"><h4 class="play-title" style="margin-bottom:8px">Today · ${today}</h4></div>`);
    for (const s of todayRows) {
      lb.insertAdjacentHTML("beforeend", `
        <article class="card">
          <div class="body">
            <h2>${s.nick}${s.nick === me ? " · you" : ""}</h2>
            <p class="sub">${s.rounds} rounds today</p>
            <p class="price">${s.total} pts · ${Math.round(100 * s.total / (s.rounds * 100))}%</p>
          </div>
        </article>`);
    }
  }
  if (lifetime.length) {
    lb.insertAdjacentHTML("beforeend", `<div style="grid-column: 1 / -1"><h4 class="play-title" style="margin: 20px 0 8px">All time</h4></div>`);
    for (const s of lifetime) {
      lb.insertAdjacentHTML("beforeend", `
        <article class="card">
          <div class="body">
            <h2>${s.nick}${s.nick === me ? " · you" : ""}</h2>
            <p class="sub">${s.daysPlayed || 0} day${s.daysPlayed === 1 ? "" : "s"}${s.lastPlayed ? ` · last ${s.lastPlayed}` : ""}</p>
            <p class="price">${s.lifetime || 0} pts total</p>
          </div>
        </article>`);
    }
  }
}

// ---------- Auction Markets ----------
function marketScoreFor(guess, settled) {
  if (guess == null || settled == null) return 0;
  const off = Math.abs(guess - settled) / settled;
  if (off <= 0.05) return 100;
  if (off <= 0.10) return 80;
  if (off <= 0.20) return 55;
  if (off <= 0.35) return 30;
  if (off <= 0.60) return 12;
  return 3;
}

function marketGuessesFor(marketId) {
  return state.market_guesses?.[marketId] || {};
}

async function placeMarketGuess(marketId, value) {
  if (!me) { nickInput.focus(); return; }
  const v = Number(value);
  if (!isFinite(v) || v <= 0) return;
  state.market_guesses = state.market_guesses || {};
  state.market_guesses[marketId] = state.market_guesses[marketId] || {};
  state.market_guesses[marketId][me] = Math.round(v);
  await Storage.save(state);
  renderMarkets();
  renderFriends();
}

function fmtClose(iso) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = d.getTime() - now;
  const days = Math.ceil(diff / 86400000);
  const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (diff < 0) return `closed ${dateStr}`;
  if (days <= 1) return `closes today`;
  return `closes ${dateStr} · in ${days}d`;
}

function renderMarkets() {
  const grid = $("grid-markets");
  if (!grid) return;
  const Q = q();
  const mkts = (data.markets || []).slice().sort((a, b) => {
    // open first by close date, then settled by close date desc
    const ao = a.status === "open", bo = b.status === "open";
    if (ao !== bo) return bo - ao;
    return Date.parse(a.close_iso) - Date.parse(b.close_iso);
  });
  grid.innerHTML = "";
  for (const m of mkts) {
    if (Q && !`${m.title} ${m.house} ${m.note || ""}`.toLowerCase().includes(Q)) continue;
    const watch = data.favorites.find(w => w.id === m.watch_id);
    const imgSrc = watch?.image || (watch ? `./images/${watch.id}.png` : "");
    const guesses = marketGuessesFor(m.id);
    const myGuess = me && guesses[me];
    const isOpen = m.status === "open";
    const isSettled = m.status === "settled" && m.settled_price != null;
    const friendChips = Object.entries(guesses).map(([nick, g]) => {
      if (isSettled) {
        const off = Math.abs(g - m.settled_price);
        const offPct = (off / m.settled_price * 100).toFixed(1);
        return `<span class="market-chip ${nick === me ? 'mine' : ''}">${nick}: $${g.toLocaleString()} <span class="off">${offPct}% off</span></span>`;
      }
      // open market — hide other guesses' values, just show count
      if (nick === me) {
        return `<span class="market-chip mine">${nick}: $${g.toLocaleString()}</span>`;
      }
      return `<span class="market-chip">${nick}: 🔒</span>`;
    }).join("");

    const sortedByOff = isSettled ? Object.entries(guesses).map(([n, g]) => ({ n, g, off: Math.abs(g - m.settled_price) })).sort((a, b) => a.off - b.off) : null;
    const winner = sortedByOff?.[0]?.n;
    const lb = isSettled && sortedByOff ? sortedByOff.map((row, i) => {
      const pts = marketScoreFor(row.g, m.settled_price);
      return `<div class="mkt-lb-row ${i === 0 ? 'winner' : ''}">
        <span class="mkt-lb-name">${i === 0 ? '★ ' : ''}${row.n}${row.n === me ? ' (you)' : ''}</span>
        <span class="mkt-lb-guess">$${row.g.toLocaleString()}</span>
        <span class="mkt-lb-pts">+${pts}</span>
      </div>`;
    }).join("") : "";

    grid.insertAdjacentHTML("beforeend", `
      <article class="market-card ${isSettled ? 'settled' : ''}" data-id="market:${m.id}">
        ${imgSrc ? `<a class="market-img" href="${m.house_url}" target="_blank" rel="noopener"><img loading="lazy" alt="${m.title}" src="${imgSrc}" onerror="(function(i){const ext=i.src.match(/\\.([a-z]+)$/i)?.[1]||'';const chain={jpg:'webp',webp:'png',png:'avif'};const next=chain[ext];if(next){i.src=i.src.replace(/\\.[a-z]+$/i,'.'+next);}else{i.style.display='none';}})(this)"/></a>` : ""}
        <div class="market-body">
          <div class="market-head">
            <div>
              <p class="market-house">${m.house} · Lot ${m.lot_number || "—"}</p>
              <h3 class="market-title">${m.title}</h3>
            </div>
            <span class="market-status ${m.status}">${isSettled ? "settled" : isOpen ? fmtClose(m.close_iso) : m.status}</span>
          </div>
          <p class="market-est">Estimate: ${m.estimate_currency} ${m.estimate_low.toLocaleString()}–${m.estimate_high.toLocaleString()}</p>
          ${m.note ? `<p class="market-note">${m.note}</p>` : ""}

          ${isSettled ? `
            <div class="market-settled">
              <div class="market-result">
                <span class="rl">Hammer</span>
                <span class="rg">${m.settled_currency || m.estimate_currency} ${m.settled_price.toLocaleString()}</span>
              </div>
              <div class="market-leaderboard">${lb || '<p class="kv">No friends predicted this lot.</p>'}</div>
            </div>
          ` : `
            <form class="market-bet" onsubmit="return false">
              <label class="bet-label">Your prediction <span class="kv">(${m.estimate_currency})</span>
                <div class="bet-input-row">
                  <span class="bet-prefix">$</span>
                  <input type="number" class="bet-input" data-market="${m.id}"
                         min="500" max="500000" step="100"
                         placeholder="${Math.round((m.estimate_low + m.estimate_high) / 2).toLocaleString()}"
                         value="${myGuess || ''}"/>
                  <button class="bet-submit" data-market="${m.id}">${myGuess ? "Update" : "Submit"}</button>
                </div>
              </label>
            </form>
            ${friendChips ? `<div class="market-chips">${friendChips}</div>` : ''}
          `}
        </div>
      </article>`);
  }
  if (!grid.children.length) grid.innerHTML = `<p class="kv">No markets match.</p>`;

  grid.querySelectorAll(".bet-submit").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const marketId = btn.dataset.market;
      const input = grid.querySelector(`.bet-input[data-market="${marketId}"]`);
      placeMarketGuess(marketId, input.value);
    });
  });
  grid.querySelectorAll(".bet-input").forEach(inp => {
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        placeMarketGuess(inp.dataset.market, inp.value);
      }
    });
  });
}

function lifetimeMarketScore(nick) {
  let pts = 0, plays = 0;
  for (const m of (data.markets || [])) {
    if (m.status !== "settled" || m.settled_price == null) continue;
    const g = state.market_guesses?.[m.id]?.[nick];
    if (g == null) continue;
    pts += marketScoreFor(g, m.settled_price);
    plays += 1;
  }
  return { pts, plays };
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
    const mkt = lifetimeMarketScore(u.nickname);
    const mktLine = mkt.plays > 0 ? `<p class="kv"><b>Auction wagers:</b> ${mkt.plays} settled · ${mkt.pts} pts</p>` : "";
    grid.insertAdjacentHTML("beforeend", `
      <article class="card">
        <div class="body">
          <h2>${u.nickname}</h2>
          <p class="sub">${(u.bookmarks || []).length} bookmark${(u.bookmarks || []).length === 1 ? "" : "s"}${u.nickname === me ? " · you" : ""}</p>
          ${mktLine}
          <ul class="kv" style="margin:8px 0 0; padding-left:18px">${items || "<li>nothing yet</li>"}</ul>
        </div>
      </article>`);
  }
}
