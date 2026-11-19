// @ts-check
/* dashboard.js → Overview (1.17)
   Built for a small merchant on a phone: three big tap-through cards (to confirm / today / low stock), three quick
   buttons, store status, this month's three numbers and the last five orders. No charts. Shared state on `ctx`. */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { viewOverview });

  const dayKey = (value) => String(value || "").slice(0, 10);
  const monthKey = (value) => String(value || "").slice(0, 7);
  const isLive = (order) => order.status !== "cancelled" && order.status !== "returned";

  function bigCard(route, value, label, note, tone) {
    return `<a class="ov-big ov-${tone}" href="#${route}" data-route="${route}">
      <strong>${value}</strong><span>${ctx.esc(label)}</span><small>${ctx.esc(note)}</small>
    </a>`;
  }

  function topProduct(orders) {
    const qty = new Map();
    for (const order of orders)
      for (const item of order.items || []) {
        const key = ctx.lng(item.title) || item.handle || "";
        if (key) qty.set(key, (qty.get(key) || 0) + Number(item.qty || 1));
      }
    const best = [...qty.entries()].sort((a, b) => b[1] - a[1])[0];
    return best ? `${best[0]} (${best[1]})` : "—";
  }

  function orderRow(order) {
    const status = ctx.R.statusMeta(order.status);
    return `<button type="button" class="ov-order" data-action="view-order" data-id="${ctx.esc(order.id)}">
      <span class="ov-order-main"><strong>${ctx.esc(order.customer?.name || order.id)}</strong><small>${ctx.esc(order.customer?.city || "")} · ${ctx.esc(ctx.fmtDate(order.createdAt))}</small></span>
      <span class="ov-order-side"><b>${ctx.money(order.total)}</b><i class="status-pill u-status-text" data-sv="status:${ctx.esc(status.color)}">${ctx.esc(ctx.lng(status.label))}</i></span>
    </button>`;
  }

  function viewOverview() {
    const orders = ctx.orderList();
    const today = dayKey(new Date().toISOString());
    const month = monthKey(today);
    const pending = orders.filter((order) => order.status === "new");
    const todays = orders.filter((order) => dayKey(order.createdAt) === today && isLive(order));
    const monthOrders = orders.filter((order) => monthKey(order.createdAt) === month && isLive(order));
    const low = ctx.lowStockProducts();
    const open = ctx.R.isStoreOpen();
    const name = ctx.session?.displayName || ctx.session?.name || "";
    return `
      <div class="dash-view-head ov-head">
        <div><h2>${ctx.dt("مرحباً", "Bonjour")}${name ? ` ${ctx.esc(name)}` : ""} 👋</h2>
          <p><span class="ov-dot ${open ? "on" : ""}"></span>${open ? ctx.dt("المتجر مفتوح الآن", "Boutique ouverte") : ctx.dt("المتجر مغلق الآن", "Boutique fermée")}${ctx.dirty ? ` · <a href="#" data-action="publish">${ctx.dt("لديك تغييرات غير منشورة — انشر", "Modifications non publiées — publier")}</a>` : ""}</p>
        </div>
      </div>
      <div class="ov">
        <div class="ov-bigs">
          ${bigCard("orders", pending.length, ctx.dt("بانتظار التأكيد", "À confirmer"), pending.length ? ctx.dt("اتصل بالزبون وأكّد", "Appelez et confirmez") : ctx.dt("لا شيء معلّق", "Rien en attente"), pending.length ? "hot" : "calm")}
          ${bigCard("orders", todays.length, ctx.dt("طلبات اليوم", "Commandes du jour"), ctx.money(ctx.revenueOfOrders(todays)), "neutral")}
          ${bigCard("products", low.length, ctx.dt("مخزون منخفض", "Stock faible"), low.length ? ctx.esc(ctx.lng(low[0].title)) : ctx.dt("المخزون بخير", "Stock OK"), low.length ? "warn" : "calm")}
        </div>
        <div class="ov-quick">
          <button type="button" class="btn btn-primary" data-action="add-product">${ctx.icon("plus")} ${ctx.dt("منتج جديد", "Nouveau produit")}</button>
          <button type="button" class="btn btn-soft" data-action="add-coupon">${ctx.icon("marketing")} ${ctx.dt("كوبون جديد", "Nouveau coupon")}</button>
          <button type="button" class="btn btn-soft" data-action="preview">${ctx.icon("preview")} ${ctx.dt("افتح المتجر", "Voir la boutique")}</button>
        </div>
        <section class="pc-section">
          <div class="pc-head"><h3>${ctx.dt("هذا الشهر", "Ce mois")}</h3></div>
          <div class="ov-month">
            <div><small>${ctx.dt("المبيعات", "Ventes")}</small><strong>${ctx.money(ctx.revenueOfOrders(monthOrders))}</strong></div>
            <div><small>${ctx.dt("الطلبات", "Commandes")}</small><strong>${monthOrders.length}</strong></div>
            <div><small>${ctx.dt("الأكثر مبيعاً", "Meilleure vente")}</small><strong class="ov-top">${ctx.esc(topProduct(monthOrders))}</strong></div>
          </div>
        </section>
        <section class="pc-section">
          <div class="pc-head"><h3>${ctx.dt("آخر الطلبات", "Dernières commandes")}</h3><a href="#orders" data-route="orders">${ctx.dt("عرض الكل", "Tout voir")}</a></div>
          ${orders.length ? orders.slice(0, 5).map(orderRow).join("") : `<div class="empty-dash">${ctx.icon("orders")}<p>${ctx.dt("لا توجد طلبات بعد. ستظهر هنا فور وصولها من المتجر.", "Aucune commande pour l’instant.")}</p></div>`}
        </section>
      </div>`;
  }
}
