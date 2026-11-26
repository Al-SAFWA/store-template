// @ts-check
/* app.js → Checkout markup builders (extracted verbatim from 12-checkout.js)
   Pure functions of the passed data: no DOM access, no event wiring, no side effects. Keeping the templates
   here lets 12-checkout.js stay under the complexity and size budgets, and lets tests render the markup in jsdom. */
import { whatsappDigits } from "../../domain/channels.js";
import { displayImage, FALLBACK_PHOTO } from "../../domain/category-images.js";
import { paymentIcon } from "../../domain/payments.js";

function couponPlaceholder() {
  const brand = globalThis.window && globalThis.window.BRAND;
  const prefix = brand && brand.couponPrefix;
  return `${prefix || "WELCOME"}10`;
}

/** @param {any} ctx @param {any} data */
export function checkoutPageHTML(ctx, data) {
  const { items, subtotal, cities, payments, open, defaultCity, selectedPayment } = data;
  return `
      <div class="container">
        <div class="checkout-head">
          <h1>${ctx.esc(ctx.t("checkout"))}</h1>
        </div>
        ${!open ? `<div class="store-closed-banner">${ctx.ICON.clock}<div><strong>${ctx.esc(ctx.t("closedTitle"))}</strong><span>${ctx.esc(ctx.t("storeClosed"))}</span></div></div>` : ""}
        <div class="checkout-layout">
          <form id="checkout-form" class="checkout-form" novalidate>
            <section class="checkout-block">
              <div class="field-row">
                <div class="field"><label for="co-name">${ctx.esc(ctx.t("fullName"))} *</label><input id="co-name" autocomplete="name" required><p class="field-error" id="err-co-name"></p></div>
                <div class="field"><label for="co-phone">${ctx.esc(ctx.t("phone"))} *</label><div class="phone-input"><span>+222</span><input id="co-phone" inputmode="tel" autocomplete="tel" placeholder="46 00 00 00" maxlength="14" required></div><p class="field-error" id="err-co-phone"></p></div>
              </div>
            </section>
            <section class="checkout-block">
              <div class="field"><label for="co-city">${ctx.esc(ctx.t("city"))} *</label><select id="co-city">${cities.map((city) => `<option value="${ctx.esc(city.id)}" ${city.id === defaultCity?.id ? "selected" : ""}>${ctx.esc(ctx.L(city.name))} — ${Number(city.fee) ? ctx.money(city.fee) : ctx.t("free")}</option>`).join("")}</select></div>
              <div class="field"><label for="co-address">${ctx.esc(ctx.t("address"))} *</label><input id="co-address" autocomplete="street-address" placeholder="${ctx.esc(ctx.R.lang === "ar" ? "الحي، الشارع، رقم المنزل" : "Quartier, rue, numéro")}" required><p class="field-error" id="err-co-address"></p></div>
              <p class="field-note">${ctx.ICON.truck} ${ctx.esc(ctx.L(ctx.SET.shippingNote))}</p>
            </section>
            <section class="checkout-block">
              <div class="payment-grid">
                ${payments
                  .map(
                    (
                      payment,
                      i
                    ) => `<label class="payment-card ${payment.id === "cod" ? "is-wide" : "is-tile"} ${i === 0 ? "active" : ""} u-pay-rail" data-sv="pay:${ctx.esc(payment.color)}">
                  <input type="radio" name="co-payment" value="${ctx.esc(payment.id)}" ${i === 0 ? "checked" : ""}>
                  <span class="payment-mark">${paymentIcon(payment) ? `<img src="${ctx.esc(paymentIcon(payment))}" alt="${ctx.esc(ctx.L(payment.name))}" width="56" height="56" decoding="async">` : ctx.esc(ctx.L(payment.name).slice(0, 2))}</span>
                  <span class="payment-copy"><strong>${ctx.esc(ctx.L(payment.name))}</strong><small>${ctx.esc(ctx.paymentNote(payment))}</small></span>
                  ${payment.discount ? `<span class="payment-discount">-${payment.discount}%</span>` : ""}
                </label>`
                  )
                  .join("")}
              </div>
              <div class="pay-account" id="pay-account" hidden>
                <span>${ctx.R.lang === "ar" ? "حوّل المبلغ إلى رقم" : "Virement vers le numéro"} <strong id="pay-account-name"></strong></span>
                <code id="pay-account-number" dir="ltr"></code>
                <button class="btn btn-outline btn-sm" type="button" id="pay-account-copy">${ctx.ICON.copy || ""} ${ctx.R.lang === "ar" ? "نسخ" : "Copier"}</button>
              </div>
              <div class="coupon-row">
                <div class="field"><label for="co-coupon">${ctx.esc(ctx.t("coupon"))}</label><input id="co-coupon" placeholder="${ctx.esc(couponPlaceholder())}"></div>
                <button class="btn btn-outline" type="button" id="apply-coupon">${ctx.esc(ctx.t("apply"))}</button>
              </div>
              <p class="field-note">${ctx.ICON.info} ${ctx.esc(ctx.R.lang === "ar" ? "الدفع يتم تأكيده عبر واتساب. لا يتم سحب أي مبلغ من هذا الموقع." : "Le paiement est confirmé sur WhatsApp. Aucun paiement n’est débité sur ce site.")}</p>
            </section>
          </form>
          <aside class="order-summary">
            <h2>${ctx.esc(ctx.t("orderSummary"))}</h2>
            <div class="sum-items">
              ${items
                .map(
                  (it) => `<div class="sum-item">
                <img src="${displayImage(it.product)}" alt="${ctx.esc(ctx.L(it.product.title))}" width="64" height="64" decoding="async" data-fb="${FALLBACK_PHOTO}">
                <div><div class="t">${ctx.esc(ctx.L(it.product.title))}</div><div class="p">${ctx.esc(ctx.variantLabel(it.variant))}${it.specs && Object.keys(it.specs).length ? ` · ${ctx.esc(ctx.specsText(it.specs))}` : ""} × ${it.qty}</div><strong>${ctx.money(it.line)}</strong></div>
              </div>`
                )
                .join("")}
            </div>
            <div class="sum-rows">
              <div class="sum-row"><span>${ctx.esc(ctx.t("subtotal"))}</span><span id="sum-subtotal">${ctx.money(subtotal)}</span></div>
              <div class="sum-row"><span>${ctx.esc(ctx.t("shipping"))} <small id="sum-city"></small></span><span id="sum-shipping">${ctx.money(0)}</span></div>
              <div class="sum-row discount" id="payment-row" hidden><span id="sum-payment-label">${ctx.esc(ctx.L(selectedPayment.name))} -${selectedPayment.discount || 0}%</span><span id="sum-payment">0</span></div>
              <div class="sum-row discount" id="coupon-row" hidden><span>${ctx.esc(ctx.t("coupon"))}</span><span id="sum-coupon">0</span></div>
              <div class="sum-row total"><span>${ctx.esc(ctx.t("total"))}</span><span id="sum-total">${ctx.money(subtotal)}</span></div>
            </div>
            <button class="btn btn-primary btn-block btn-whatsapp" type="button" id="place-order" ${!open ? "disabled" : ""}>${ctx.ICON.whatsapp} ${ctx.esc(!open ? ctx.t("closedTitle") : ctx.t("placeOrder"))}</button>
            ${
              whatsappDigits(ctx.SET)
                ? `<div class="summary-help">${ctx.ICON.whatsapp}<span>${ctx.esc(ctx.t("contactUs"))}: <a class="phone-ltr" href="https://wa.me/${ctx.esc(whatsappDigits(ctx.SET))}" target="_blank" rel="noopener">${ctx.esc(ctx.SET.phoneDisplay || whatsappDigits(ctx.SET))}</a></span></div>`
                : ""
            }
          </aside>
        </div>
      </div>`;
}

/** @param {any} ctx */
export function emptyCheckoutHTML(ctx) {
  return `<div class="container"><div class="empty-state"><h2>${ctx.esc(ctx.t("emptyCheckout"))}</h2><p>${ctx.esc(ctx.t("emptyCartText"))}</p><a class="btn btn-primary" href="collection.html?handle=all">${ctx.esc(ctx.t("shopNow"))}</a></div></div>`;
}

/** @param {any} ctx */
export function noPaymentHTML(ctx) {
  return `<div class="container"><div class="empty-state"><h2>${ctx.esc(ctx.t("emptyCheckout"))}</h2><p>${ctx.esc(ctx.R.lang === "ar" ? "لا توجد وسيلة دفع مفعّلة. أضفها من لوحة التحكم." : "Aucun moyen de paiement actif. Ajoutez-en depuis le tableau de bord.")}</p></div></div>`;
}

/** @param {any} ctx @param {any} data */
export function checkoutSuccessHTML(ctx, data) {
  const { order, payName, link } = data;
  return `<div class="container"><div class="checkout-success">
          <div class="ico">${ctx.ICON.check}</div>
          <span class="eyebrow">${ctx.esc(ctx.L(ctx.SET.storeName))}</span>
          <h1>${ctx.esc(ctx.t("orderReceived"))}</h1>
          <p>${ctx.esc(ctx.t("orderReceivedText"))}${order.serverValidated ? ` <small>(${ctx.esc(ctx.R.lang === "ar" ? "تم التحقق من السعر على الخادم" : "Prix validé côté serveur")})</small>` : ""}</p>
          <div class="success-order">
            <div><span>${ctx.esc(ctx.t("orderId"))}</span><strong>${ctx.esc(order.id)}</strong></div>
            <div><span>${ctx.esc(ctx.t("total"))}</span><strong>${ctx.money(order.total)}</strong></div>
            <div><span>${ctx.esc(ctx.t("payment"))}</span><strong>${ctx.esc(payName)}</strong></div>
          </div>
          <a class="btn btn-primary btn-whatsapp" id="open-whatsapp" href="${link}" target="_blank" rel="noopener">${ctx.ICON.whatsapp} ${ctx.esc(ctx.t("openWhatsApp"))}</a>
          <a class="btn btn-outline" href="collection.html?handle=all">${ctx.esc(ctx.t("backToShop"))}</a>
          <p class="redirecting">${ctx.esc(ctx.t("redirecting"))}</p>
        </div></div>`;
}
