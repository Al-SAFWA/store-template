// @ts-check
/** When a product/category <img> 404s, swap in a real photo instead of the broken-image glyph. */

import { FALLBACK_PHOTO } from "../domain/category-images.js";

const SLOT =
  ".ct-thumb, .ct-pick, .ct-current, .cat-card, .card-media, .product-card, .cart-item-img, .cell-main, .search-result, .account-wish-item, .order-item-row, .hero-visual, .payment-mark, .pay-badge, .gallery, .promo";

export function bindBrokenImages() {
  if (window.__restoreImgFb) return;
  window.__restoreImgFb = true;
  document.addEventListener(
    "error",
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || img.dataset.fb === "1") return;
      const current = img.getAttribute("src") || "";
      let next = img.getAttribute("data-fb") || "";
      if (!next || next === current) {
        if (!img.closest(SLOT)) {
          img.dataset.fb = "1";
          return;
        }
        next = FALLBACK_PHOTO;
      }
      if (!next || next === current) {
        img.dataset.fb = "1";
        return;
      }
      img.dataset.fb = "1";
      img.src = next;
    },
    true
  );
}
