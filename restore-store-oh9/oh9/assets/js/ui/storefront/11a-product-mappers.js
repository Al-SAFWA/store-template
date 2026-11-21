// @ts-check
/* app.js → Product page: repository row → storefront product (pure)
   Extracted verbatim from loadProductByHandle() in 11-product-page.js: no DOM, no network, unit-testable.
   Remote rows win over the local product; presentation-only fields (options, collections) always stay local. */

/** A non-empty array. */
const filled = (value) => Array.isArray(value) && value.length > 0;

/** First non-nullish value, as a number (0 when everything is missing). */
function firstNumber(...values) {
  const found = values.find((value) => value !== null && value !== undefined);
  return Number(found ?? 0);
}

/** First non-nullish value, unchanged. */
function firstDefined(...values) {
  return values.find((value) => value !== null && value !== undefined);
}

/** Remote specs win only when the row actually carries some. */
function pickSpecs(remote, local) {
  if (remote && Object.keys(remote).length) return remote;
  return local || {};
}

/** Remote images win only when the row actually carries some. */
function pickImages(remote, local) {
  if (filled(remote)) return remote;
  return local || [];
}

/** Primary image: the first remote image, else the local one. */
function pickImage(remote, local) {
  if (filled(remote)) return remote[0];
  return local;
}

/**
 * Variants of a remote product row, falling back to the local variants when the RPC returns none.
 * @param {any} row Remote `restore_products` row.
 * @param {any} local Locally hydrated product (may be null).
 */
export function mapRepoVariants(row, local) {
  if (!Array.isArray(row.restore_product_variants)) return local?.variants || [];
  const known = new Map((local?.variants || []).map((v) => [String(v.id), v]));
  const ordered = row.restore_product_variants
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  return ordered.map((v) => {
    const axes = known.get(String(v.id)) || {};
    return {
      // o1/o2/title come from the hydrated catalog (domain mapper) — the page matches the shopper's choice on them
      title: axes.title || [v.color, v.storage].filter(Boolean).join(" / "),
      o1: "o1" in axes ? axes.o1 : (v.color ?? v.storage ?? null),
      o2: "o1" in axes ? (axes.o2 ?? null) : v.color ? (v.storage ?? null) : null,
      id: v.id,
      sku: v.sku,
      color: v.color,
      storage: v.storage,
      price: Math.max(0, Number(row.price || 0) + Number(v.price_delta || 0)),
      stock: Number(v.stock || 0),
      available: Number(v.stock || 0) > 0
    };
  });
}

/**
 * Merges a remote row over the local product, keeping local-only presentation fields (options, collections…).
 * @param {any} row Remote `restore_products` row.
 * @param {any} local Locally hydrated product (may be null).
 */
/** Choice rows derived from variant rows when the hydrated catalog has none (product not in local state yet). */
function optionsFromVariants(variants, base) {
  const uniq = (list) => [...new Set(list.filter(Boolean))];
  const colors = uniq([...(base.colors || []).map((c) => c.name), ...variants.map((v) => v.color)]);
  const storages = uniq(variants.map((v) => v.storage));
  const options = [];
  if (colors.length) options.push({ name: "Color", values: colors });
  if (storages.length) options.push({ name: base.optionName || "Storage", values: storages });
  return options;
}

export function mapRepoProduct(row, local) {
  const base = local || {};
  const variants = mapRepoVariants(row, local);
  return {
    ...base,
    handle: row.handle,
    title: row.title || base.title,
    brand: row.brand || base.brand,
    price: firstNumber(row.price, base.price),
    compareAt: firstDefined(row.compare_at, base.compareAt),
    stock: firstNumber(row.stock, base.stock),
    condition: row.condition || base.condition,
    specs: pickSpecs(row.specs, base.specs),
    images: pickImages(row.images, base.images),
    image: pickImage(row.images, base.image),
    variants,
    options: base.options?.length ? base.options : optionsFromVariants(variants, base),
    collections: base.collections || [],
    description: base.description || row.title,
    active: row.active !== false,
    _source: "restore_products"
  };
}
