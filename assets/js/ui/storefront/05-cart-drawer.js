// @ts-check
/* app.js → Cart drawer
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

import { displayImage, FALLBACK_PHOTO } from "../../domain/category-images.js";

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { mountCart, openCart, closeCart, renderCart });
  function trackHTML() {
    return `<div class="cart-track" id="cart-track">
        <h4>${ctx.esc(ctx.t("trackOrder"))}</h4>
        <div class="field"><label for="acc-phone">${ctx.esc(ctx.t("phone"))}</label><input id="acc-phone" inputmode="tel" placeholder="46 00 00 00" dir="ltr" autocomplete="tel"></div>
        <p class="track-or" aria-hidden="true">${ctx.esc(ctx.t("trackOr"))}</p>
        <div class="field"><label for="acc-order">${ctx.esc(ctx.t("orderId"))}</label><input id="acc-order" placeholder="RS-261022-A1B2" dir="ltr"></div>
        <button class="btn btn-primary btn-block" type="button" id="acc-track">${ctx.esc(ctx.t("trackOrder"))}</button>
        <div id="acc-result"></div>
      </div>`;
  }

  function bindCartTrack() {
    const read = (id) => /** @type {HTMLInputElement | null} */ (document.getElementById(id))?.value || "";
    const findOrder = () => {
      const code = read("acc-order").trim().toUpperCase();
      const phone = read("acc-phone").replace(/\D/g, "").slice(-8);
      const box = document.getElementById("acc-result");
      if (!box) return;
      if (!phone && !code) {
        box.innerHTML = `<div class="account-result error">${ctx.esc(ctx.t("needPhoneOrOrder"))}</div>`;
        return;
      }
      const orders = ctx.R.getOrders();
      const found =
        (phone &&
          orders.find((order) =>
            String(order.customer?.phone || "")
              .replace(/\D/g, "")
              .endsWith(phone)
          )) ||
        (code && orders.find((order) => order.id.toUpperCase() === code));
      if (!found) {
        box.innerHTML = `<div class="account-result error">${ctx.esc(ctx.t("orderNotFound"))}</div>`;
        return;
      }
      const status = ctx.R.statusMeta(found.status);
      box.innerHTML = `<div class="account-result"><div class="result-head"><strong>${ctx.esc(found.id)}</strong><span class="status-pill u-status-text" data-sv="status:${ctx.esc(status.color)}">${ctx.esc(ctx.L(status.label))}</span></div><p>${ctx.esc(found.customer?.name || "")} · ${ctx.money(found.total)}</p><ul>${(found.items || []).map((item) => `<li>${ctx.esc(item.title)} × ${item.qty}</li>`).join("")}</ul></div>`;
    };
    document.getElementById("acc-track")?.addEventListener("click", findOrder);
    const onEnter = (event) => {
      if (event.key === "Enter") findOrder();
    };
    document.getElementById("acc-phone")?.addEventListener("keydown", onEnter);
    document.getElementById("acc-order")?.addEventListener("keydown", onEnter);
  }

  function mountCart() {
    if (document.getElementById("cart-drawer")) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="overlay" id="cart-overlay"></div>
      <aside class="drawer" id="cart-drawer" aria-label="${ctx.esc(ctx.t("cart"))}" aria-hidden="true">
        <div class="drawer-head">
          <h3>${ctx.esc(ctx.t("cart"))} <span id="cart-title-count"></span></h3>
          <button class="drawer-close" type="button" data-close-cart aria-label="${ctx.esc(ctx.t("close"))}">${ctx.ICON.close}</button>
        </div>
        ${trackHTML()}
        <div class="drawer-body" id="cart-body"></div>
        <div class="drawer-foot" id="cart-foot"></div>
      </aside>`;
    document.body.appendChild(wrap);
    document.getElementById("cart-overlay").addEventListener("click", closeCart);
    wrap.querySelector("[data-close-cart]").addEventListener("click", closeCart);
    bindCartTrack();
  }

  function openCart() {
    mountCart();
    renderCart();
    document.getElementById("cart-overlay").classList.add("open");
    const d = document.getElementById("cart-drawer");
    d.classList.add("open");
    d.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

  function closeCart() {
    document.getElementById("cart-overlay")?.classList.remove("open");
    const d = document.getElementById("cart-drawer");
    if (d) {
      d.classList.remove("open");
      d.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("no-scroll");
  }

  function renderCart() {
    if (!document.getElementById("cart-drawer")) return;
    const items = ctx.cartDetails();
    const body = document.getElementById("cart-body");
    const foot = document.getElementById("cart-foot");
    const count = items.reduce((n, it) => n + it.qty, 0);
    const titleCount = document.getElementById("cart-title-count");
    if (titleCount) titleCount.textContent = count ? `(${count})` : "";
    if (!items.length) {
      body.innerHTML = `<div class="cart-empty">${ctx.ICON.bag}<p>${ctx.esc(ctx.t("emptyCart"))}</p><a class="btn btn-primary u-mt-16" href="collection.html?handle=all">${ctx.esc(ctx.t("shopNow"))}</a></div>`;
      foot.innerHTML = "";
      return;
    }
    body.innerHTML = items
      .map(
        (it) => `
      <div class="cart-item">
        <a class="cart-item-img" href="product.html?handle=${encodeURIComponent(it.handle)}"><img src="${displayImage(it.product)}" alt="${ctx.esc(it.product.title)}" width="72" height="72" decoding="async" data-fb="${FALLBACK_PHOTO}"></a>
        <div>
          <a class="cart-item-title" href="product.html?handle=${encodeURIComponent(it.handle)}">${ctx.esc(it.product.title)}</a>
          <div class="cart-item-var">${ctx.esc(ctx.variantLabel(it.variant) || "")}</div>
          ${it.specs && Object.keys(it.specs).length ? `<div class="cart-item-specs">${ctx.esc(ctx.specsText(it.specs))}</div>` : ""}
          <div class="qty">
            <button type="button" data-cart-dec="${ctx.esc(it.variant.id)}" data-handle="${ctx.esc(it.handle)}" aria-label="-">−</button>
            <span>${it.qty}</span>
            <button type="button" data-cart-inc="${ctx.esc(it.variant.id)}" data-handle="${ctx.esc(it.handle)}" aria-label="+">+</button>
          </div>
        </div>
        <div class="cart-item-right">
          <div class="cart-item-price">${ctx.money(it.line)}</div>
          <button class="cart-remove" type="button" data-cart-remove="${ctx.esc(it.variant.id)}" data-handle="${ctx.esc(it.handle)}" aria-label="${ctx.esc(ctx.t("close"))}">${ctx.ICON.trash}</button>
        </div>
      </div>`
      )
      .join("");
    foot.innerHTML = `
      <div class="cart-sub"><span>${ctx.esc(ctx.t("subtotal"))}</span><span>${ctx.money(ctx.cartSubtotal())}</span></div>
      <div class="cart-note">${ctx.esc(ctx.t("shippingCalc"))}</div>
      <a class="btn btn-primary btn-block" href="checkout.html">${ctx.esc(ctx.t("checkout"))}</a>`;
  }
}
