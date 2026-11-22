// @ts-check
/* Legacy storefront handles (Restore-branded slugs) → the demo catalog handles in data.js.
   Kept so old bookmarks, published nav, and home sections still resolve to a real collection. */

export const COLLECTION_ALIASES = {
  "restore-anniversary": "special-offers",
  anniversary: "special-offers",
  "refurbished-iphones": "phones",
  "used-samsung": "android",
  "laptops-used-refurbished": "laptops",
  "refurbished-macbooks": "macbooks",
  ipads: "tablets",
  "apple-watches": "watches",
  "chargers-power-banks-cables": "chargers",
  "cases-screen-protectors": "accessories"
};

/** Canonical collection handle, or "all". Empty / unknown values pass through. */
export function resolveCollectionHandle(handle) {
  const raw = String(handle || "").trim();
  if (!raw) return "all";
  if (raw === "all") return "all";
  return COLLECTION_ALIASES[raw] || raw;
}

/** True when the product belongs to `handle`, including legacy Restore slugs. */
export function productInCollection(product, handle) {
  const want = resolveCollectionHandle(handle);
  if (!want || want === "all") return true;
  return (product?.collections || []).some((entry) => resolveCollectionHandle(entry) === want);
}

/** Collection handle from a storefront href, or "" when the link is not a collection page. */
export function collectionHandleFromHref(href) {
  const raw = String(href || "");
  const match = raw.match(/collection\.html\?[^#]*handle=([^&]+)/i);
  if (!match) return "";
  try {
    return resolveCollectionHandle(decodeURIComponent(match[1]));
  } catch {
    return resolveCollectionHandle(match[1]);
  }
}

/** Storefront may show a collection when it is missing (custom nav) or `visible !== false`. */
export function isCollectionVisible(collections, handle) {
  const want = resolveCollectionHandle(handle);
  if (!want || want === "all") return true;
  const row = (collections || []).find((item) => resolveCollectionHandle(item.handle) === want);
  return !row || row.visible !== false;
}

/**
 * Category-bar cards: only collections that exist in `collections` and are not hidden.
 * Hidden rows are either `visible === false` (JSON draft) or omitted entirely (tables: active=false
 * is filtered by RLS, so a missing row must not fall back to the stale `theme.categories` entry).
 */
export function visibleBarEntries(themeCategories, collections) {
  const byHandle = new Map();
  for (const collection of collections || []) {
    const handle = resolveCollectionHandle(collection.handle);
    if (!handle || handle === "all") continue;
    byHandle.set(handle, collection);
  }
  const seen = new Set();
  const out = [];
  for (const entry of themeCategories || []) {
    const handle = resolveCollectionHandle(entry.handle);
    if (!handle || handle === "all" || seen.has(handle)) continue;
    const collection = byHandle.get(handle);
    if (!collection || collection.visible === false) continue;
    seen.add(handle);
    out.push({ handle, entry, collection });
  }
  if (out.length) return out;
  for (const collection of collections || []) {
    const handle = resolveCollectionHandle(collection.handle);
    if (!handle || handle === "all" || seen.has(handle) || collection.visible === false) continue;
    seen.add(handle);
    out.push({
      handle,
      entry: { handle, label: collection.title, image: collection.image },
      collection
    });
  }
  return out;
}
