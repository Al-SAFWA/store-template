// @ts-check
/* app.js → Global events
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js).
   The document click listener is a lookup table built in 15a-click-handlers.js; the SEO helpers live in
   15b-seo.js. This module keeps the remaining listeners (change/keydown/scroll/restore:*) and the consent gate. */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  document.addEventListener("click", (e) => ctx.dispatchClick(ctx.clickHandlers, e));
  Object.assign(ctx, { consentState, setConsent, showConsentBanner, injectPixels });

  document.addEventListener("change", (event) => {
    const spec = /** @type {any} */ (event.target).closest("[data-spec]");
    if (spec) {
      ctx.PDP.specs[spec.dataset.spec] = spec.value;
      ctx.toast(ctx.R.lang === "ar" ? "تم حفظ خيار الطلب" : "Option enregistrée");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      ctx.closeSearch();
      ctx.closeCart();
      ctx.closeMenu();
    }
  });

  window.addEventListener(
    "scroll",
    () => {
      document.querySelector(".site-header")?.classList.toggle("scrolled", window.scrollY > 160);
    },
    { passive: true }
  );

  // Content changed (publish, remote sync, other tab…): repaint IN PLACE. The storefront never reloads itself any
  // more — a full reload was the engine of every reload loop (demo1, 1.8.4 → 1.8.9) and it also killed in-flight
  // order submissions. The checkout page and any focused field are left untouched; they pick up the new content
  // on the next navigation.
  let repaintTimer = 0;
  window.addEventListener("restore:changed", (event) => {
    if (document.body?.dataset.page === "dashboard") return;
    const source = /** @type {CustomEvent} */ (event).detail?.source || "?";
    if (document.body?.dataset.page === "checkout") return;
    if (document.querySelector("input:focus, textarea:focus, select:focus")) return;
    clearTimeout(repaintTimer);
    repaintTimer = window.setTimeout(() => {
      console.info(`Restore: content updated in place (source=${source})`);
      try {
        ctx.renderHeader();
        ctx.renderFooter();
        ctx.renderPageContent();
      } catch (error) {
        console.warn("Restore: in-place repaint failed", error);
      }
    }, 300);
  });

  window.addEventListener("restore:customer", () => {
    ctx.renderCustomerAccount();
    const page = document.body?.dataset.page;
    if (page === "wishlist") ctx.renderWishlist();
    if (page === "account") ctx.renderAccount();
  });

  window.addEventListener("restore:orders", () => {
    if (document.body?.dataset.page === "account") ctx.renderAccount();
  });

  window.addEventListener("restore:reviews", () => {
    if (document.body?.dataset.page !== "product" || !ctx.PDP.p) return;
    const section = document.querySelector("#product-extra .product-reviews");
    if (!section) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = ctx.renderProductReviews(ctx.PDP.p);
    const next = wrapper.firstElementChild;
    if (next) {
      section.replaceWith(next);
      ctx.hydrateIcons(next);
      ctx.observeReveals();
    }
  });

  /* Analytics pixels load ONLY after explicit consent (restore_consent_v1 = "granted").
     Third-party pixel loaders cannot use Subresource Integrity (vendors rotate the files), so consent is the control. */
  const CONSENT_KEY = "restore_consent_v1";
  function consentState() {
    try {
      return localStorage.getItem(CONSENT_KEY) || "";
    } catch {
      return "";
    }
  }
  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* private mode */
    }
    document.getElementById("consent-banner")?.remove();
    if (value === "granted") injectPixels();
  }
  function showConsentBanner() {
    if (document.getElementById("consent-banner")) return;
    const ar = ctx.R.lang === "ar";
    const box = document.createElement("div");
    box.id = "consent-banner";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-live", "polite");
    box.className = "consent-banner";
    box.innerHTML = `<span class="u-grow u-min-200">${ctx.esc(ar ? "نستخدم أدوات قياس (Meta/TikTok/Google) لتحسين المتجر. هل توافق؟" : "Nous utilisons des outils de mesure (Meta/TikTok/Google) pour améliorer la boutique. Acceptez-vous ?")}</span>
      <button type="button" class="btn btn-sm btn-soft" data-consent="denied">${ctx.esc(ar ? "رفض" : "Refuser")}</button>
      <button type="button" class="btn btn-sm btn-primary" data-consent="granted">${ctx.esc(ar ? "موافق" : "Accepter")}</button>`;
    box.addEventListener("click", (e) => {
      const b = /** @type {any} */ (e.target).closest("[data-consent]");
      if (b) setConsent(b.dataset.consent);
    });
    document.body.appendChild(box);
  }
  function injectPixels() {
    const pixels = ctx.SET.pixels || {};
    if (!pixels.meta && !pixels.tiktok && !pixels.ga) return;
    if (document.querySelector("script[data-restore-pixels]")) return;
    const consent = consentState();
    if (consent !== "granted") {
      if (!consent) showConsentBanner();
      return;
    }
    const script = document.createElement("script");
    script.src = "assets/js/pixels.js";
    script.defer = true;
    script.dataset.restorePixels = "true";
    if (pixels.meta)
      script.dataset.meta = String(pixels.meta)
        .replace(/[^A-Za-z0-9_.-]/g, "")
        .slice(0, 80);
    if (pixels.tiktok)
      script.dataset.tiktok = String(pixels.tiktok)
        .replace(/[^A-Za-z0-9_.-]/g, "")
        .slice(0, 80);
    if (pixels.ga)
      script.dataset.ga = String(pixels.ga)
        .replace(/[^A-Za-z0-9_.-]/g, "")
        .slice(0, 80);
    document.head.appendChild(script);
  }
}
