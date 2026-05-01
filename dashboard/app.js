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
          ${actionFoot(w.id, w.url, "view")}
        </div>
      </article>`);
  }
  if (!grid.children.length) grid.innerHTML = `<p class="kv">Nothing matches.</p>`;
  bindCardActions(grid);
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
