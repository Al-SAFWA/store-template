// @ts-check
/* dashboard.js → Orders, phone view (1.12): one card per order with a single "next step" button.
   Three groups replace the seven status tabs; the status machine itself is unchanged (statuses live in state.js,
   labels/colours in 13-store-utils.js). 05-orders.js renders this list next to the desktop table; CSS picks one. */

import { displayImage, FALLBACK_PHOTO } from "../../domain/category-images.js";

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, {
    orderGroups,
    orderGroupOf,
    orderNextStep,
    orderWhatsAppLink,
    orderCardsHTML,
    orderActionBar,
    orderAgo
  });

  /** Tab → statuses it contains. */
  const GROUPS = {
    new: ["new", "confirmed", "preparing", "shipped"],
    done: ["delivered", "cancelled", "returned"]
  };
  /** Status → the one action a merchant takes from there. */
  const NEXT = {
    new: { status: "confirmed", ar: "تأكيد الطلب", fr: "Confirmer", icon: "check" },
    confirmed: { status: "preparing", ar: "جاهز للشحن", fr: "Préparé", icon: "box" },
    preparing: { status: "shipped", ar: "خرج للتوصيل", fr: "Expédié", icon: "truck" },
    shipped: { status: "delivered", ar: "تم التسليم", fr: "Livré", icon: "check" }
  };
  /** Status → WhatsApp template that fits the moment. */
  const WA_TEMPLATE = {
    new: "confirm",
    confirmed: "confirm",
    preparing: "shipped",
    shipped: "shipped",
    delivered: "delivered"
  };

  function orderGroups() {
    const orders = ctx.orderList();
    const count = (ids) => orders.filter((o) => ids.includes(o.status)).length;
    return [
      { id: "new", label: ctx.dt("الطلبات", "Commandes"), count: count(GROUPS.new), urgent: count(["new"]) > 0 },
      { id: "done", label: ctx.dt("منتهٍ", "Terminées"), count: count(GROUPS.done) }
    ];
  }
  function orderGroupOf(status) {
    return Object.keys(GROUPS).find((g) => GROUPS[g].includes(status)) || "done";
  }
  function orderNextStep(status) {
    return NEXT[status] || null;
  }
  function orderWhatsAppLink(order) {
    const type = WA_TEMPLATE[order.status] || "confirm";
    return `https://wa.me/${ctx.digits(order.customer?.phone)}?text=${encodeURIComponent(ctx.orderMessage(order, type))}`;
  }

  /** "منذ 12 دقيقة" / "il y a 2 h" — falls back to the date beyond a week. */
  function orderAgo(value) {
    const t = new Date(value).getTime();
    if (!t) return "";
    const minutes = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (minutes < 1) return ctx.dt("الآن", "à l’instant");
    if (minutes < 60) return ctx.dt(`منذ ${minutes} دقيقة`, `il y a ${minutes} min`);
    const hours = Math.round(minutes / 60);
    if (hours < 24) return ctx.dt(`منذ ${hours} ساعة`, `il y a ${hours} h`);
    const days = Math.round(hours / 24);
    if (days === 1) return ctx.dt("أمس", "hier");
    if (days < 7) return ctx.dt(`منذ ${days} أيام`, `il y a ${days} j`);
    return ctx.fmtDateTime(value);
  }

  /** Next-step + WhatsApp + call + cancel. Shared by the card and the detail modal. */
  function orderActionBar(order, { compact = false } = {}) {
    const next = orderNextStep(order.status);
    const id = ctx.esc(order.id);
    const phone = ctx.esc(order.customer?.phone || "");
    const nextBtn = next
      ? `<button class="btn oc-next oc-next-${ctx.esc(order.status)}" type="button" data-action="order-next" data-id="${id}">${ctx.icon(next.icon)} ${ctx.dt(next.ar, next.fr)}</button>`
      : `<span class="oc-final">${ctx.esc(ctx.lng(ctx.R.statusMeta(order.status).label))}</span>`;
    const cancel =
      next && !compact
        ? `<button class="oc-cancel" type="button" data-action="order-cancel" data-id="${id}">${ctx.dt("إلغاء", "Annuler")}</button>`
        : "";
    return `<div class="oc-actions">
      ${nextBtn}
      <a class="btn oc-wa" href="${orderWhatsAppLink(order)}" target="_blank" rel="noopener" aria-label="WhatsApp" title="WhatsApp">${ctx.icon("whatsapp")}</a>
      <a class="btn oc-call" href="tel:${phone}" aria-label="${ctx.dt("اتصال", "Appeler")}" title="${ctx.dt("اتصال", "Appeler")}">${ctx.icon("phone")}</a>
      ${cancel}
    </div>`;
  }

  function itemsLine(order) {
    const items = order.items || [];
    const first = items[0];
    if (!first) return { thumb: "", title: "", extra: "" };
    const more = items.length - 1;
    const extra = more > 0 ? ctx.dt(`+ ${more} منتج آخر`, `+ ${more} autre(s)`) : "";
    const variant = first.variantTitle ? ` · ${first.variantTitle}` : "";
    const qty = Number(first.qty || 1) > 1 ? ` ×${first.qty}` : "";
    return {
      thumb: `<img src="${ctx.esc(displayImage(first))}" alt="" data-fb="${FALLBACK_PHOTO}">`,
      title: ctx.esc(`${first.title || ""}${variant}${qty}`),
      extra: [extra, order.payment?.name || ""]
        .filter(Boolean)
        .map((s) => ctx.esc(s))
        .join(" · ")
    };
  }

  function orderCard(order) {
    const status = ctx.R.statusMeta(order.status);
    const c = order.customer || {};
    const where = [c.city, c.address].filter(Boolean).join("، ");
    const line = itemsLine(order);
    return `<article class="order-card" data-action="view-order" data-id="${ctx.esc(order.id)}">
      <div class="oc-head">
        <div class="oc-who"><strong>${ctx.esc(c.name || ctx.dt("زبون", "Client"))}</strong><small dir="auto"><span dir="ltr">${ctx.esc(c.phone || "")}</span>${where ? ` · ${ctx.esc(where)}` : ""}</small></div>
        <span class="status-pill" data-sv="status:${ctx.esc(status.color)}">${ctx.esc(ctx.lng(status.label))}</span>
      </div>
      <div class="oc-items"><span class="oc-thumb">${line.thumb}</span><div class="oc-item-text"><strong>${line.title}</strong><small>${line.extra}</small></div><b class="oc-total">${ctx.money(order.total)}</b></div>
      ${orderActionBar(order)}
      <small class="oc-meta">${ctx.esc(orderAgo(order.createdAt))} · <span dir="ltr">${ctx.esc(order.id)}</span></small>
    </article>`;
  }

  function orderCardsHTML(orders) {
    if (!orders.length)
      return `<div class="table-empty order-cards-empty">${ctx.icon("orders")}<p>${
        ctx.orderFilter === "new"
          ? ctx.dt("لا توجد طلبات جديدة الآن. كل شيء تحت السيطرة.", "Aucune nouvelle commande. Tout est à jour.")
          : ctx.dt("لا توجد طلبات هنا.", "Aucune commande ici.")
      }</p></div>`;
    return `<div class="order-cards">${orders.map(orderCard).join("")}</div>`;
  }
  void GROUPS;
}
