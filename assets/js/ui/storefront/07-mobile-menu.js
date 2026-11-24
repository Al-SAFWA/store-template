// @ts-check
/* app.js → Mobile menu
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

import { displayImage, FALLBACK_PHOTO } from "../../domain/category-images.js";

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { mountMenu, openMenu, closeMenu, runSearch });
  function mountMenu() {
    /* Drawer removed: header nav + icons already cover the same links. */
  }
  function openMenu() {
    /* no hamburger */
  }
  function closeMenu() {
    document.body.classList.remove("no-scroll");
  }

  function runSearch(q) {
    const box = document.getElementById("search-results");
    const hint = document.getElementById("search-hint");
    if (!box) return;
    q = (q || "").trim();
    let items;
    if (q.length < 2) {
      hint.textContent = ctx.t("popular");
      const popular = [
        "iphone-13-pro-max",
        "iphone-14-pro-max",
        "galaxy-s21-plus",
        "lenovo-thinkpad-t460-core-i5-6th-gen",
        "hp-chromebook-11-g3-celeron-5th-gen",
        "galaxy-z-fold-3",
        "iphone-15-pro-max",
        "galaxy-s20-plus"
      ];
      items = popular.map((h) => ctx.BY_HANDLE.get(h)).filter((p) => p && ctx.PRODUCTS.includes(p));
    } else {
      const found = ctx.PRODUCTS.filter((p) => ctx.R.matchesQuery(p, q));
      hint.textContent = ctx.t("resultsFor", { count: found.length, q });
      items = found.slice(0, 12);
    }
    box.innerHTML = items.length
      ? items
          .map(
            (p) => `
      <a class="search-result" href="product.html?handle=${encodeURIComponent(p.handle)}">
        <img src="${displayImage(p)}" alt="${ctx.esc(p.title)}" width="64" height="64" loading="lazy" decoding="async" data-fb="${FALLBACK_PHOTO}">
        <div><div class="t">${ctx.esc(p.title)}</div><div class="p">${ctx.money(p.price)}</div></div>
      </a>`
          )
          .join("")
      : `<div class="search-empty">${ctx.esc(ctx.t("noResults"))} — ${ctx.esc(ctx.t("tryFilter"))}</div>`;
  }
}
