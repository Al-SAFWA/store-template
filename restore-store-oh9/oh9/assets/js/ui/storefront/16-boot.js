// @ts-check
/* app.js → Boot
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { boot, renderPageContent });
  /** Repaints the current page from ctx.state without a navigation (used by boot and by live content updates). */
  function renderPageContent() {
    const page = document.body.dataset.page;
    if (page === "home") ctx.renderHome();
    else if (page === "collection") ctx.renderCollection();
    else if (page === "product") ctx.renderProduct();
    else if (page === "checkout") ctx.renderCheckout();
    else if (page === "wishlist") ctx.renderWishlist();
    else if (page === "page") ctx.renderPage();
    else if (page === "account") ctx.renderAccount();
    ctx.renderCart();
    ctx.hydrateIcons();
  }
  function boot() {
    ctx.applySeo();
    ctx.renderHeader();
    ctx.renderCustomerAccount();
    ctx.renderFooter();
    ctx.mountCart();
    ctx.syncBadges();
    ctx.hydrateIcons();
    ctx.injectPixels();
    ctx.renderCustomerAccount();
    renderPageContent();
    if (ctx.SET.pwa && "serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
