// @ts-check
/* state.js → Local error log (1.17)
   Keeps the last 20 uncaught errors of this browser in localStorage so a merchant (or the developer on the phone)
   can read what broke from Settings → Advanced without devtools. No network, no personal data: time, page, message. */

const KEY = "restore_errors_v1";
const MAX = 20;

/** @param {any} ctx */
export function install(ctx) {
  function readErrors() {
    try {
      const rows = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }
  function clearErrors() {
    localStorage.removeItem(KEY);
  }
  function logError(message, source = "") {
    const text = String(message || "").slice(0, 300);
    if (!text) return;
    const rows = readErrors();
    const last = rows[0];
    if (last && last.message === text && Date.now() - Date.parse(last.at) < 5000) return; // de-duplicate bursts
    rows.unshift({
      at: new Date().toISOString(),
      page: location.pathname.split("/").pop() || "index.html",
      message: text,
      source: String(source || "").slice(0, 120)
    });
    try {
      localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX)));
    } catch {
      /* storage full or disabled — the log is best-effort */
    }
  }
  const w = /** @type {any} */ (typeof window !== "undefined" ? window : null);
  if (w && !w.__restoreErrorLog) {
    w.__restoreErrorLog = true;
    window.addEventListener("error", (event) =>
      logError(event.message, event.filename ? `${event.filename.split("/").pop()}:${event.lineno}` : "")
    );
    window.addEventListener("unhandledrejection", (event) => {
      const reason = /** @type {any} */ (event).reason;
      logError(reason?.message || String(reason || "promise rejected"), "promise");
    });
  }
  Object.assign(ctx, { readErrors, clearErrors, logError });
}
