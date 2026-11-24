// @ts-check
/* Pure mappers between dashboard/storefront catalog objects and relational rows.
   No DOM, no fetch, no side effects — unit-tested in tests/catalog-mappers.test.mjs.

   Product object (app/dashboard shape)  <->  restore_products row (+ variants, + collection handles)
   Collection object                      <->  restore_collections row
   Coupon object                          <->  restore_coupons row
*/

const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const int = (v, d = 0) => Math.max(0, Math.round(num(v, d)));
const txt = (v) =>
  v && typeof v === "object"
    ? { ar: String(v.ar ?? ""), fr: String(v.fr ?? "") }
    : { ar: String(v ?? ""), fr: String(v ?? "") };
const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export const HANDLE_RE = /^[a-z0-9][a-z0-9-_]{1,118}$/;
/** @param {Record<string, any> | null | undefined} p @returns {string[]} error codes (empty = valid) */
export function validateProduct(p) {
  const errors = [];
  if (!p || typeof p !== "object") return ["product_required"];
  if (!HANDLE_RE.test(String(p.handle || ""))) errors.push("handle_invalid");
  if (!(txt(p.title).ar || txt(p.title).fr)) errors.push("title_required");
  if (num(p.price, -1) < 0) errors.push("price_invalid");
  if (num(p.stock, -1) < 0) errors.push("stock_invalid");
  return errors;
}
/** @param {Record<string, any> | null | undefined} c @returns {string[]} error codes (empty = valid) */
export function validateCoupon(c) {
  const errors = [];
  if (!c || typeof c !== "object") return ["coupon_required"];
  if (!/^[A-Z0-9_-]{2,40}$/.test(String(c.code || "").toUpperCase())) errors.push("code_invalid");
  if (!["percent", "fixed"].includes(c.type)) errors.push("type_invalid");
  if (num(c.value, -1) < 0 || (c.type === "percent" && num(c.value) > 100)) errors.push("value_invalid");
  return errors;
}

/* Keys that live in dedicated columns; everything else goes to `extra`. */
const PRODUCT_COLUMN_KEYS = new Set([
  "id",
  "handle",
  "title",
  "brand",
  "vendor",
  "price",
  "compare",
  "compareAt",
  "stock",
  "condition",
  "specs",
  "images",
  "image",
  "active",
  "sku",
  "sortOrder",
  "variants",
  "collections",
  "updatedAt",
  "createdAt",
  "_source"
]);

function productExtra(p, images) {
  const extra = {};
  for (const [k, v] of Object.entries(p || {})) if (!PRODUCT_COLUMN_KEYS.has(k)) extra[k] = v;
  extra.collections = arr(p.collections).map(String);
  extra.image = p.image || images[0] || "";
  return extra;
}
/** Legacy variants carry their choice only as o1/o2 (+ the option list); copy it into the color/storage columns so
 * the row stays matchable after a round trip through the tables. Non-colour axes are joined with " / ". */
function withColumnsFromAxes(v, options) {
  if ((v.color && v.storage) || !options.length || v.o1 == null) return v;
  const axes = options.map((o, i) => v["o" + (i + 1)]);
  const colorIdx = options.findIndex((o) => isColorName(o.name));
  const color = v.color || (colorIdx >= 0 ? axes[colorIdx] : null) || null;
  const storage = v.storage || axes.filter((value, i) => i !== colorIdx && value).join(" / ") || null;
  return { ...v, color, storage };
}
function variantToRow(v, i, id, basePrice, stock) {
  const delta = v.price_delta != null ? num(v.price_delta, 0) : num(v.price, basePrice) - basePrice;
  return {
    id: String(v.id || `${id}_v${i + 1}`),
    product_id: id,
    sku: v.sku ? String(v.sku) : null,
    color: v.color || v.label || null,
    storage: v.storage || null,
    price_delta: Math.round(delta),
    stock: int(v.stock ?? stock)
  };
}
/** Dashboard/storefront product → `{ row, variants, collectionHandles }` for restore_products & friends.
 * @param {Record<string, any>} p */
export function productToRow(p) {
  const images = arr(p.images).map(String).filter(Boolean);
  if (!images.length && p.image) images.push(String(p.image));
  const extra = productExtra(p, images);
  const id = String(p.id || p.handle);
  const compare = p.compare ?? p.compareAt;
  const row = {
    id,
    handle: String(p.handle),
    title: txt(p.title),
    brand: p.brand || p.vendor || null,
    price: int(p.price),
    compare_at: num(compare, 0) > 0 ? int(compare) : null,
    stock: int(p.stock),
    condition: p.condition || null,
    specs: obj(p.specs),
    images,
    active: p.active !== false,
    sku: p.sku ? String(p.sku) : null,
    sort_order: int(p.sortOrder, 0),
    extra
  };
  const variants = arr(p.variants).map((v, i) =>
    variantToRow(withColumnsFromAxes(v, arr(p.options)), i, id, row.price, row.stock)
  );
  return { row, variants, collectionHandles: extra.collections };
}

/** Inverse of productToRow. @param {Record<string, any>} row @param {Record<string, any>[]} [variants] @param {string[] | null} [collectionHandles] */
/** One `restore_product_variants` row → storefront variant (price absolute, availability from stock). */
function variantFromRow(v, base) {
  return {
    id: v.id,
    sku: v.sku || "",
    color: v.color || "",
    label: v.color || "",
    storage: v.storage || "",
    price: Math.max(0, base + num(v.price_delta, 0)),
    price_delta: num(v.price_delta, 0),
    stock: int(v.stock),
    available: int(v.stock) > 0
  };
}
const isColorName = (name) => /color|colour|couleur|لون/i.test(String(name || ""));
/** The choice buttons shown on the product page. Stored `extra.options` win; otherwise they are derived from the
 * variant rows (colour axis from `color`, second axis from `storage`) and from the colour palette, so a product
 * edited with the simple dashboard fields — or imported from a spreadsheet — always offers its choices. */
function optionsFor(product) {
  const stored = arr(product.options).filter((o) => o && o.name && arr(o.values).length);
  const uniq = (list) => [...new Set(list.filter(Boolean))];
  const colors = uniq([...arr(product.colors).map((c) => c.name), ...product.variants.map((v) => v.color)]);
  const storages = uniq(product.variants.map((v) => v.storage));
  const options = stored.slice();
  if (colors.length && !options.some((o) => isColorName(o.name))) options.unshift({ name: "Color", values: colors });
  if (storages.length && !options.some((o) => !isColorName(o.name)))
    options.push({ name: product.optionName || "Storage", values: storages });
  return options;
}
/** o1/o2/title for a variant row so the product page can match the shopper's selection. A variant without a colour
 * under a palette-only Color axis gets `null` there (= any colour). Rows whose axes were lost (early seeds stored
 * neither column) are assigned by position when the variant count equals the option grid. */
function variantAxes(v, options, index, total) {
  if (v.o1 != null) return { title: v.title || v.label || "" };
  const nonColor = options.filter((o) => !isColorName(o.name));
  const grid = nonColor.reduce((n, o) => n * o.values.length, 1);
  const parts = String(v.storage || "").split(" / ");
  const byPosition = !v.storage && grid === total && grid > 0 ? positional(nonColor, index) : null;
  let k = 0;
  const axes = options.map((o) => (isColorName(o.name) ? v.color || null : byPosition ? byPosition[k++] : parts[k++]));
  const out = { title: axes.filter(Boolean).join(" / ") || v.label || "" };
  axes.forEach((value, i) => {
    out["o" + (i + 1)] = value || null;
  });
  return out;
}
function positional(options, index) {
  const values = [];
  let rest = index;
  for (let i = options.length - 1; i >= 0; i--) {
    const n = options[i].values.length;
    values.unshift(options[i].values[rest % n]);
    rest = Math.floor(rest / n);
  }
  return values;
}

/** Stock shown everywhere: the sum of the variant rows when there are any, else the product row. */
const liveStock = (product) =>
  product.variants.length ? product.variants.reduce((sum, v) => sum + v.stock, 0) : product.stock;

export function rowToProduct(row, variants = [], collectionHandles = null) {
  const extra = obj(row.extra);
  const images = arr(row.images).map(String);
  const base = row.price | 0;
  const product = {
    ...extra,
    id: row.id,
    handle: row.handle,
    title: txt(row.title),
    vendor: extra.vendor || row.brand || "",
    brand: row.brand || extra.vendor || "",
    price: int(row.price),
    compare: row.compare_at == null ? 0 : int(row.compare_at),
    stock: int(row.stock),
    condition: row.condition || extra.condition || "",
    specs: obj(row.specs),
    images,
    image: extra.image || images[0] || "",
    active: row.active !== false,
    sku: row.sku || "",
    sortOrder: int(row.sort_order, 0),
    collections: Array.isArray(collectionHandles) ? collectionHandles.map(String) : arr(extra.collections).map(String),
    // PostgREST returns embedded rows in no guaranteed order; natural id order = the order variants were created in
    // (seed 1023 → 64 GB, 1024 → 256 GB), which the positional axis fallback relies on.
    variants: arr(variants)
      .slice()
      .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
      .map((v) => variantFromRow(v, base)),
    updatedAt: row.updated_at || null,
    _source: "restore_products"
  };
  // With variants, the sale decrements the VARIANT row (restore_create_order_v2); the parent row.stock is only the
  // initial value and never moves. Dashboard list, low-stock filter, storefront availability and reports all read
  // product.stock, so expose the live total here (demo1: 3 phones sold, list still showed 13).
  product.stock = liveStock(product);
  product.options = optionsFor(product);
  product.variants.forEach((v, i, all) => Object.assign(v, variantAxes(v, product.options, i, all.length)));
  return product;
}

export function collectionToRow(c) {
  const { id, handle, title, description, visible, sortOrder, ...rest } = c || {};
  delete rest.active;
  return {
    id: String(id || handle),
    handle: String(handle),
    title: txt(title),
    description: txt(description || ""),
    // Keep the row in the dashboard list; storefront hide lives on extra.visible.
    active: true,
    sort_order: int(sortOrder, 0),
    extra: { ...rest, visible: visible !== false }
  };
}
export function rowToCollection(row) {
  const extra = obj(row.extra);
  const hidden = extra.visible === false || row.active === false;
  return {
    ...extra,
    id: row.id,
    handle: row.handle,
    title: txt(row.title),
    description: txt(row.description),
    visible: !hidden,
    active: row.active !== false,
    sortOrder: int(row.sort_order, 0),
    _source: "restore_collections"
  };
}

export function couponToRow(c) {
  const { code, type, value, minTotal, min_total, expiresAt, expires_at, usageLimit, active, ...rest } = c || {};
  const exp = expiresAt || expires_at;
  return {
    code: String(code || "")
      .trim()
      .toUpperCase(),
    type: type === "fixed" ? "fixed" : "percent",
    value: int(value),
    min_total: int(minTotal ?? min_total, 0),
    expires_at: exp ? new Date(exp).toISOString() : null,
    usage_limit: usageLimit == null || usageLimit === "" ? null : int(usageLimit),
    active: active !== false,
    extra: rest
  };
}
export function rowToCoupon(row) {
  return {
    ...obj(row.extra),
    id: obj(row.extra).id || `coupon-${row.code}`,
    code: row.code,
    type: row.type,
    value: int(row.value),
    minTotal: int(row.min_total, 0),
    expiresAt: row.expires_at ? String(row.expires_at).slice(0, 10) : "",
    usageLimit: row.usage_limit,
    usedCount: int(row.used_count, 0),
    active: row.active !== false,
    _source: "restore_coupons"
  };
}

/* Bulk price helper (same rounding rule as the dashboard: nearest 5 MRU). */
export function bulkAdjustPrice(price, percent, direction = "up") {
  const factor = direction === "up" ? 1 + num(percent) / 100 : 1 - num(percent) / 100;
  return Math.max(0, Math.round((num(price) * factor) / 5) * 5);
}
