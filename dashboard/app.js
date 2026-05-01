// Watch Watch — single-file dashboard logic.
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
        if (r.status === 400) return empty(); // Pantry returns 400 if basket missing — first run
      } catch (e) { /* fall through to local */ }
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
const nickStatus = document.getElementById("nick-status");
const syncStatus = document.getElementById("sync-status");
nickInput.value = me;
syncStatus.textContent = Storage.usingPantry ? "synced (Pantry)" : "local-only";
syncStatus.classList.toggle("synced", Storage.usingPantry);

nickSave.addEventListener("click", async () => {
  const v = nickInput.value.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
  if (!v) { nickStatus.textContent = "type a nickname first"; return; }
  me = v;
  localStorage.setItem(NICK_KEY, me);
  nickInput.value = me;
  if (!state.users[me]) state.users[me] = { nickname: me, bookmarks: [], joined: new Date().toISOString().slice(0, 10) };
  await Storage.save(state);
  nickStatus.textContent = `hi, ${me} 👋`;
  renderAll();
});

// ---------- main ----------
let data, state;

(async function main() {
  data = await (await fetch("./data.json", { cache: "no-store" })).json();
  state = await Storage.load();
  if (!state.users) state.users = {};
  if (!state.votes) state.votes = {};

  document.getElementById("updated").textContent = `last updated: ${data.updated}`;
  document.getElementById("count").textContent =
    `${data.favorites.length} watches · ${data.brands.length} brands · ${data.sellers.length} sellers · ${data.stores.length} stores · ${data.cities.length} cities`;

  if (me) nickStatus.textContent = `hi, ${me} 👋`;

  // tab switching
  const tabs = document.querySelectorAll("nav.tabs .tab");
  const panels = document.querySelectorAll(".panel");
  tabs.forEach((t) =>
    t.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.toggle("active", x === t));
      panels.forEach((p) => p.classList.toggle("hidden", p.id !== `panel-${t.dataset.tab}`));
    })
  );

  populateCityOptions();
  bindFilterEvents();
  renderAll();
})();

// ---------- helpers ----------
function formatPrice(w) {
  if (w.price_label) return w.price_label;
  if (w.price_usd != null) return `$${w.price_usd.toLocaleString()}`;
  if (w.price_usd_low != null && w.price_usd_high != null)
    return `$${w.price_usd_low.toLocaleString()}–${w.price_usd_high.toLocaleString()}`;
  if (w.price_jpy != null) return `¥${w.price_jpy.toLocaleString()}`;
  return "price tbd";
}

function getVotes(id) { return state.votes[id] || (state.votes[id] = { up: [], down: [] }); }
function bookmarksFor(id) { return Object.values(state.users).filter(u => (u.bookmarks || []).includes(id)); }
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
  if (!ensureNick()) return;
  const u = state.users[me] || (state.users[me] = { nickname: me, bookmarks: [], joined: new Date().toISOString().slice(0, 10) });
  u.bookmarks = u.bookmarks || [];
  const i = u.bookmarks.indexOf(id);
  if (i >= 0) u.bookmarks.splice(i, 1); else u.bookmarks.push(id);
  await Storage.save(state);
  renderAll();
}

async function vote(id, dir) {
  if (!ensureNick()) return;
  const v = getVotes(id);
  v.up = v.up.filter(n => n !== me);
  v.down = v.down.filter(n => n !== me);
  if (dir === 1) v.up.push(me);
  else if (dir === -1) v.down.push(me);
  await Storage.save(state);
  renderAll();
}

function ensureNick() {
  if (!me) {
    nickStatus.textContent = "type a nickname first ↑";
    nickInput.focus();
    return false;
  }
  return true;
}

function actionBar(id) {
  const score_ = score(id);
  const v = myVote(id);
  const bm = isBookmarked(id);
  const bookmarkers = bookmarksFor(id);
  const chips = bookmarkers.length
    ? `<span class="chips">${bookmarkers.map(u => `<span class="chip" title="${u.nickname} bookmarked">${u.nickname}</span>`).join("")}</span>`
    : "";
  return `
    <div class="actions">
      <button class="action star ${bm ? "on" : ""}" data-act="bookmark" data-id="${id}" title="${bm ? "Bookmarked" : "Bookmark"}">★</button>
      <button class="action vote up ${v === 1 ? "on" : ""}" data-act="up" data-id="${id}" title="Upvote">▲</button>
      <span class="score ${score_ > 0 ? "pos" : score_ < 0 ? "neg" : ""}">${score_}</span>
      <button class="action vote down ${v === -1 ? "on" : ""}" data-act="down" data-id="${id}" title="Downvote">▼</button>
      ${chips}
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

// ---------- filters ----------
const $ = (id) => document.getElementById(id);

function populateCityOptions() {
  const brandCities = [...new Set(data.brands.flatMap(b => b.cities || []))].sort();
  for (const c of brandCities) $("f-brand-city").appendChild(new Option(c, c));
  const storeCities = [...new Set(data.stores.map(s => s.city))].sort();
  for (const c of storeCities) $("f-store-city").appendChild(new Option(c, c));
}

function bindFilterEvents() {
  ["f-status", "f-price", "f-show", "f-tier", "f-brand-city", "f-seller-type", "f-store-city", "f-store-type", "search"]
    .forEach(id => $(id).addEventListener("input", renderAll));
}

function q() { return $("search").value.trim().toLowerCase(); }

// ---------- renderers ----------
function renderAll() {
  renderFavorites();
  renderBrands();
  renderSellers();
  renderCities();
  renderStores();
  renderFriends();
}

function renderFavorites() {
  const grid = $("grid-favorites");
  const status = $("f-status").value;
  const max = $("f-price").value ? +$("f-price").value : Infinity;
  const show = $("f-show").value;
  const Q = q();

  let list = [...data.favorites];
  if (show === "bookmarked-by-me") list = list.filter(w => isBookmarked(w.id));
  if (show === "top-voted") list = list.filter(w => score(w.id) > 0);
  list.sort((a, b) => {
    const sa = score(a.id), sb = score(b.id);
    if (sb !== sa) return sb - sa;
    return (b.fit || 0) - (a.fit || 0);
  });

  grid.innerHTML = "";
  for (const w of list) {
    if (status && w.status !== status) continue;
    const lo = w.price_usd_low ?? w.price_usd ?? Infinity;
    if (lo > max) continue;
    if (Q && !`${w.brand} ${w.model} ${(w.tags || []).join(" ")} ${w.dial || ""}`.toLowerCase().includes(Q)) continue;
    grid.insertAdjacentHTML("beforeend", favoriteCard(w));
  }
  if (!grid.children.length) grid.innerHTML = `<p class="hint">No favorites match.</p>`;
  bindCardActions(grid);
}

function favoriteCard(w) {
  const tags = (w.tags || []).map(t => `<li>${t}</li>`).join("");
  const img = w.image
    ? `<a class="img" href="${w.url}" target="_blank" rel="noopener"><img loading="lazy" alt="${w.brand} ${w.model}" src="${w.image}"/></a>`
    : "";
  return `
    <article class="card${w.image ? " with-image" : ""}" data-id="${w.id}">
      ${img}
      <div class="body">
        <div class="row1">
          <h2>${w.model}</h2>
          <span class="badge ${w.status}">${w.status.replace("-", " ")}</span>
        </div>
        <p class="sub">${w.brand} · ${w.size_mm}mm · ${w.strap || "—"}</p>
        <ul class="tags">${tags}</ul>
        <div class="price-row">
          <span class="price">${formatPrice(w)}</span>
          <span class="fit">${w.fit != null ? `fit ${w.fit}/10` : ""}</span>
        </div>
        <p class="note">${w.note || ""}</p>
        ${actionBar(w.id)}
        <div class="cta">
          <a class="primary" href="${w.url}" target="_blank" rel="noopener">${w.cta_label || "View"}</a>
          <span class="src">${w.source || ""}</span>
        </div>
      </div>
    </article>`;
}

function renderBrands() {
  const grid = $("grid-brands");
  const tier = $("f-tier").value;
  const city = $("f-brand-city").value;
  const Q = q();
  grid.innerHTML = "";
  const list = [...data.brands].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  for (const b of list) {
    if (tier && String(b.tier) !== tier) continue;
    if (city && !(b.cities || []).includes(city)) continue;
    if (Q && !`${b.name} ${(b.tags || []).join(" ")} ${b.note || ""}`.toLowerCase().includes(Q)) continue;
    const id = `brand:${b.name}`;
    const tags = (b.tags || []).map(t => `<li>${t}</li>`).join("");
    const stockists = (b.stockists || []).map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.name}</a>`).join(" · ");
    grid.insertAdjacentHTML("beforeend", `
      <article class="card" data-id="${id}">
        <div class="body">
          <div class="row1">
            <h2>${b.name}</h2>
            <span class="badge tier-${b.tier}">Tier ${b.tier}</span>
          </div>
          <p class="sub">${(b.cities || []).join(" · ")}${b.founded ? ` · est. ${b.founded}` : ""}</p>
          <p class="kv"><b>Style:</b> ${b.style || "—"}</p>
          <p class="kv"><b>Range:</b> ${b.price_range || "—"}</p>
          <ul class="tags">${tags}</ul>
          <p class="note">${b.note || ""}</p>
          ${stockists ? `<p class="kv"><b>Stockists:</b> ${stockists}</p>` : ""}
          ${actionBar(id)}
          <div class="cta">
            <a class="primary" href="${b.url}" target="_blank" rel="noopener">Brand site</a>
            <span class="src">${b.handle || ""}</span>
          </div>
        </div>
      </article>`);
  }
  if (!grid.children.length) grid.innerHTML = `<p class="hint">No brands match.</p>`;
  bindCardActions(grid);
}

function renderSellers() {
  const grid = $("grid-sellers");
  const type = $("f-seller-type").value;
  const Q = q();
  grid.innerHTML = "";
  for (const s of data.sellers) {
    if (type && s.type !== type) continue;
    if (Q && !`${s.name} ${(s.tags || []).join(" ")} ${s.note || ""}`.toLowerCase().includes(Q)) continue;
    const id = `seller:${s.name}`;
    const tags = (s.tags || []).map(t => `<li>${t}</li>`).join("");
    grid.insertAdjacentHTML("beforeend", `
      <article class="card" data-id="${id}">
        <div class="body">
          <div class="row1">
            <h2>${s.name}</h2>
            <span class="badge ${s.type}">${s.type}</span>
          </div>
          <p class="sub">${s.based_in || ""}</p>
          <p class="kv"><b>Best for:</b> ${s.best_for || "—"}</p>
          <p class="kv"><b>Fees:</b> ${s.fees || "—"}</p>
          <ul class="tags">${tags}</ul>
          <p class="note">${s.note || ""}</p>
          ${actionBar(id)}
          <div class="cta">
            <a class="primary" href="${s.url}" target="_blank" rel="noopener">Visit</a>
          </div>
        </div>
      </article>`);
  }
  if (!grid.children.length) grid.innerHTML = `<p class="hint">No sellers match.</p>`;
  bindCardActions(grid);
}

function renderCities() {
  const grid = $("grid-cities");
  const Q = q();
  grid.innerHTML = "";
  for (const c of data.cities) {
    if (Q && !`${c.name} ${c.country} ${(c.tags || []).join(" ")}`.toLowerCase().includes(Q)) continue;
    const id = `city:${c.name}`;
    const stores = data.stores.filter(s => s.city === c.name);
    const storeLinks = stores.map(s => `<li>${s.name} <span style="color:var(--muted);font-size:11px">· ${s.type.replace("-", " ")}</span></li>`).join("");
    const tags = (c.tags || []).map(t => `<li>${t}</li>`).join("");
    grid.insertAdjacentHTML("beforeend", `
      <article class="card" data-id="${id}">
        <div class="body">
          <div class="row1">
            <h2>${c.name}</h2>
            <span class="badge available">${c.country}</span>
          </div>
          <p class="sub">${c.neighborhoods?.join(" · ") || ""}</p>
          <ul class="tags">${tags}</ul>
          <p class="note">${c.note || ""}</p>
          <p class="kv"><b>${stores.length} store${stores.length === 1 ? "" : "s"}:</b></p>
          <ul class="kv" style="margin:0;padding-left:18px">${storeLinks}</ul>
          ${actionBar(id)}
        </div>
      </article>`);
  }
  bindCardActions(grid);
}

function renderStores() {
  const grid = $("grid-stores");
  const city = $("f-store-city").value;
  const type = $("f-store-type").value;
  const Q = q();
  grid.innerHTML = "";
  const list = [...data.stores].sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
  for (const s of list) {
    if (city && s.city !== city) continue;
    if (type && s.type !== type) continue;
    if (Q && !`${s.name} ${s.city} ${s.neighborhood || ""} ${(s.brands || []).join(" ")} ${(s.tags || []).join(" ")}`.toLowerCase().includes(Q)) continue;
    const id = `store:${s.city}:${s.name}`;
    const tags = (s.tags || []).map(t => `<li>${t}</li>`).join("");
    const brands = (s.brands || []).map(b => `<li>${b}</li>`).join("");
    const mapsHref = s.address ? `https://www.google.com/maps/search/${encodeURIComponent(s.name + " " + s.address)}` : null;
    grid.insertAdjacentHTML("beforeend", `
      <article class="card" data-id="${id}">
        <div class="body">
          <div class="row1">
            <h2>${s.name}</h2>
            <span class="badge ${s.type}">${s.type.replace("-", " ")}</span>
          </div>
          <p class="sub">${s.city}${s.neighborhood ? " · " + s.neighborhood : ""}</p>
          <p class="kv"><b>Carries:</b></p>
          <ul class="tags">${brands}</ul>
          <p class="kv"><b>Hours:</b> ${s.hours || "—"}</p>
          <p class="kv"><b>Address:</b> ${s.address || "—"}</p>
          ${s.appointment ? `<p class="kv"><b>Appointment:</b> ${s.appointment}</p>` : ""}
          <ul class="tags">${tags}</ul>
          <p class="note">${s.note || ""}</p>
          ${actionBar(id)}
          <div class="cta">
            <a class="primary" href="${s.url || (mapsHref || "#")}" target="_blank" rel="noopener">${s.url ? "Visit site" : "Map it"}</a>
            ${mapsHref ? `<a class="src" href="${mapsHref}" target="_blank" rel="noopener">Google Maps ↗</a>` : ""}
          </div>
        </div>
      </article>`);
  }
  if (!grid.children.length) grid.innerHTML = `<p class="hint">No stores match.</p>`;
  bindCardActions(grid);
}

function renderFriends() {
  const grid = $("grid-friends");
  grid.innerHTML = "";
  const users = Object.values(state.users);
  if (!users.length) {
    grid.innerHTML = `<p class="hint">No nicknames yet — be the first. Set yours up top.</p>`;
    return;
  }
  for (const u of users) {
    const items = (u.bookmarks || []).map(id => {
      const w = data.favorites.find(x => x.id === id);
      if (w) return `<li><a href="${w.url}" target="_blank" rel="noopener">${w.brand} — ${w.model}</a> <span style="color:var(--muted);font-size:11px">(${formatPrice(w)})</span></li>`;
      // brand / city / store / seller bookmarks
      const m = id.match(/^(brand|city|seller|store):(.+)$/);
      if (m) return `<li><span style="color:var(--muted);font-size:11px">${m[1]}</span> ${m[2]}</li>`;
      return `<li>${id}</li>`;
    }).join("");
    grid.insertAdjacentHTML("beforeend", `
      <article class="card">
        <div class="body">
          <div class="row1">
            <h2>${u.nickname}</h2>
            ${u.nickname === me ? `<span class="badge own-target">you</span>` : ""}
          </div>
          <p class="sub">${(u.bookmarks || []).length} bookmark${(u.bookmarks || []).length === 1 ? "" : "s"}${u.joined ? ` · joined ${u.joined}` : ""}</p>
          <ul class="kv" style="margin:8px 0 0; padding-left:18px">${items || "<li class='hint'>no bookmarks yet</li>"}</ul>
        </div>
      </article>`);
  }
}
