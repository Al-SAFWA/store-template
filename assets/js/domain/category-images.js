// @ts-check
/** Real photos for category cards and a fallback when a product image 404s. */

import { resolveCollectionHandle } from "./collection-aliases.js";

export const FALLBACK_PHOTO = "assets/img/cats/phones.jpg";

export const CATEGORY_PHOTOS = {
  "special-offers": "assets/img/cats/offers.jpg",
  "restore-anniversary": "assets/img/cats/offers.jpg",
  anniversary: "assets/img/cats/offers.jpg",
  phones: "assets/img/cats/phones.jpg",
  "refurbished-iphones": "assets/img/cats/phones.jpg",
  android: "assets/img/cats/android.jpg",
  "used-samsung": "assets/img/cats/android.jpg",
  laptops: "assets/img/cats/laptops.jpg",
  "laptops-used-refurbished": "assets/img/cats/laptops.jpg",
  macbooks: "assets/img/cats/macbooks.jpg",
  "refurbished-macbooks": "assets/img/cats/macbooks.jpg",
  tablets: "assets/img/cats/tablets.jpg",
  ipads: "assets/img/cats/tablets.jpg",
  watches: "assets/img/cats/watches.jpg",
  "apple-watches": "assets/img/cats/watches.jpg",
  audio: "assets/img/cats/audio.jpg",
  chargers: "assets/img/cats/chargers.jpg",
  "chargers-power-banks-cables": "assets/img/cats/chargers.jpg",
  gaming: "assets/img/cats/gaming.jpg",
  accessories: "assets/img/cats/accessories.jpg",
  "cases-screen-protectors": "assets/img/cats/accessories.jpg"
};

const PROMO_PHOTOS = {
  "assets/img/restore/promo-iphone.svg": "assets/img/cats/phones.jpg",
  "assets/img/restore/promo-samsung.svg": "assets/img/cats/android.jpg",
  "assets/img/restore/promo-laptops.svg": "assets/img/cats/laptops.jpg"
};

const TYPE_HANDLE = {
  Smartphone: "phones",
  Laptop: "laptops",
  Macbook: "macbooks",
  Tablets: "tablets",
  Watch: "watches",
  Audio: "audio",
  Gaming: "gaming"
};

const DEAD_HOST = /cdn\.shopify|shopifycdn|myshopify|\.restore\.mr|restore\.mr\//i;
const KEPT = /^(data:image\/|blob:|assets\/img\/cats\/)/i;
const SUPABASE = /supabase\.co\/storage/i;

/** Merchant upload or a photo we ship. Everything else (old CDN, SVG placeholders) is dropped. */
export function isKeptCategoryImage(url) {
  const value = String(url || "").trim();
  if (!value || DEAD_HOST.test(value) || /\.svg(\?|$)/i.test(value)) return false;
  return KEPT.test(value) || SUPABASE.test(value);
}

export function isBrokenProductImage(url) {
  const value = String(url || "").trim();
  return !value || DEAD_HOST.test(value);
}

/** Drop empty, banned-CDN, SVG placeholders, and anything we do not ship. */
export function pickCategoryImage(...urls) {
  for (const url of urls) {
    if (isKeptCategoryImage(url)) return String(url).trim();
  }
  return "";
}

/** @param {string} handle */
export function categoryPhoto(handle) {
  const raw = String(handle || "").trim();
  return CATEGORY_PHOTOS[raw] || CATEGORY_PHOTOS[resolveCollectionHandle(raw)] || "";
}

/** Best on-disk photo for a product when its own URL is dead. */
export function displayImage(product) {
  const urls = [product?.image, ...(product?.images || [])];
  for (const url of urls) {
    if (url && !isBrokenProductImage(url)) return url;
  }
  for (const handle of product?.collections || []) {
    const photo = categoryPhoto(handle);
    if (photo) return photo;
  }
  return categoryPhoto(TYPE_HANDLE[product?.type] || "") || FALLBACK_PHOTO;
}

function stampHandleImage(item) {
  if (!item || isKeptCategoryImage(item.image)) return;
  item.image = categoryPhoto(item.handle) || item.image || FALLBACK_PHOTO;
}

/** Fill empty/dead collection and product images on hydrate so every card has a photo. */
export function stampCatalogImages(state) {
  if (!state) return state;
  (state.collections || []).forEach(stampHandleImage);
  (state.theme?.categories || []).forEach(stampHandleImage);
  (state.products || []).forEach((product) => {
    if (isBrokenProductImage(product.image)) product.image = displayImage(product);
  });
  (state.settings?.homeSections || []).forEach((section) => {
    if (PROMO_PHOTOS[section.promo]) section.promo = PROMO_PHOTOS[section.promo];
  });
  return state;
}
