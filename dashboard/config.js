// Watch Watch — configuration.
//
// Default: bookmarks/votes save to your browser's localStorage only (single-device).
//
// To sync across friends with no accounts and no email:
//   1. Visit https://getpantry.cloud/ → enter any email → get a Pantry ID
//      (the "email" is just where the ID is sent; nothing is stored against you)
//   2. Paste the ID below as PANTRY_ID and commit/push.
//   3. Anyone visiting this dashboard then reads & writes a single shared basket.
//      Treat the Pantry ID like a clubhouse passcode — share with friends only.
//
// You can also point this at any other JSON keystore by setting STORAGE_BACKEND
// to "custom" and editing storage.js.

window.WATCH_WATCH_CONFIG = {
  PANTRY_ID: "",                // ← paste Pantry ID here to enable shared sync
  BASKET: "watch-watch",        // basket name within the pantry; rename for separate friend groups
  STORAGE_BACKEND: "auto"       // "auto" picks Pantry if PANTRY_ID is set, else local
};
