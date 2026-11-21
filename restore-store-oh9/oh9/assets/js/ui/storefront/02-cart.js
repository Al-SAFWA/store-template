// @ts-check
/* app.js → Cart
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { readCart, writeCart, cartDetails, addToCart, setQty, removeLine, maxOrderable });
  function readCart() {
    try {
      const v = JSON.parse(localStorage.getItem(ctx.CART_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(ctx.CART_KEY, JSON.stringify(items));
    ctx.syncBadges();
    ctx.renderCart();
  }

  /** Stand-in line variant for a product sold without choices (dashboard products often have none). */
  const baseVariant = (product) => ({ id: product.handle, price: product.price, stock: product.stock });

  function cartDetails() {
    return readCart()
      .map((it) => {
        const product = ctx.BY_HANDLE.get(it.handle);
        if (!product) return null;
        const variant =
          (product.variants || []).find((v) => String(v.id) === String(it.variantId)) ||
          product.variants?.[0] ||
          baseVariant(product);
        return { ...it, product, variant, line: (Number(variant?.price ?? product.price) || 0) * it.qty };
      })
      .filter(Boolean);
  }

  const cartCount = () => readCart().reduce((n, it) => n + (Number(it.qty) || 0), 0);
  const cartSubtotal = () => cartDetails().reduce((n, it) => n + it.line, 0);

  /** Units a shopper may order of one line: the variant's stock when known, else the product's, capped at MAX_QTY. */
  function maxOrderable(handle, variantId) {
    const product = ctx.BY_HANDLE.get(handle);
    if (!product) return ctx.MAX_QTY;
    const variant = (product.variants || []).find((v) => String(v.id) === String(variantId));
    const stock = variant && variant.stock != null ? Number(variant.stock) : Number(product.stock);
    return Number.isFinite(stock) && stock >= 0 ? Math.min(ctx.MAX_QTY, stock) : ctx.MAX_QTY;
  }
  function addToCart(handle, variantId, qty = 1, specs = {}) {
    const product = ctx.BY_HANDLE.get(handle);
    if (!product) return;
    const cap = maxOrderable(handle, variantId);
    const cleanSpecs = Object.fromEntries(Object.entries(specs || {}).filter(([, v]) => v != null && v !== ""));
    const key = JSON.stringify(cleanSpecs);
    const items = readCart();
    const found = items.find(
      (it) =>
        it.handle === handle && String(it.variantId) === String(variantId) && JSON.stringify(it.specs || {}) === key
    );
    const wanted = (found ? found.qty : 0) + qty;
    if (found) found.qty = Math.min(cap, wanted);
    else items.push({ handle, variantId, qty: Math.min(cap, qty), specs: cleanSpecs });
    writeCart(items);
    ctx.toast(wanted > cap ? ctx.t("onlyLeft").replace("{n}", String(cap)) : ctx.t("addedToCart"));
  }

  function setQty(variantId, handle, qty) {
    const items = readCart();
    const it = items.find((x) => x.handle === handle && String(x.variantId) === String(variantId));
    if (!it) return;
    const cap = maxOrderable(handle, variantId);
    if (qty > cap) ctx.toast(ctx.t("onlyLeft").replace("{n}", String(cap)));
    it.qty = Math.max(0, Math.min(cap, qty));
    writeCart(items.filter((x) => x.qty > 0));
  }

  function removeLine(handle, variantId) {
    writeCart(readCart().filter((x) => !(x.handle === handle && String(x.variantId) === String(variantId))));
  }
  Object.assign(ctx, { cartCount, cartSubtotal });
}
