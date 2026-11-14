// @ts-check
/* dashboard.js → Boot
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { boot });
  function boot() {
    if (!ctx.session) {
      ctx.renderLogin();
      return;
    }
    if (ctx.session.mustChange) {
      ctx.renderPasswordChange();
      return;
    }
    ctx.renderShell();
    startOrderPolling();
    if (ctx.R.remote) {
      ctx.R.loadRemoteState()
        .then((updated) => {
          if (updated && !ctx.dirty) {
            ctx.model = ctx.clone(ctx.R.state);
            ctx.renderRoute();
          }
        })
        .catch(() => {});
    }
  }
  /** Orders are written by customers' phones straight into Supabase; the merchant's browser must PULL them.
      Without this the dashboard only ever showed orders placed from the same browser (found on the first live sale). */
  function startOrderPolling() {
    if (!ctx.R.remote || typeof ctx.R.refreshOrders !== "function") return;
    const INTERVAL_MS = 30_000;
    const pull = () => {
      if (document.hidden) return;
      ctx.R.refreshOrders()
        .then(() => {
          // saveOrders() broadcasts restore:orders → badge, toast and sound; the list itself re-renders here,
          // but never over an open dialog or unsaved edits.
          if (ctx.route === "orders" && !ctx.dirty && !document.body.classList.contains("no-scroll")) ctx.renderRoute();
        })
        .catch(() => {});
    };
    pull();
    setInterval(pull, INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) pull();
    });
  }
  boot();
}
