// @ts-check
/* dashboard.js → Orders
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

import { displayImage, FALLBACK_PHOTO } from "../../domain/category-images.js";

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, {
    filteredOrders,
    ordersTable,
    viewOrders,
    orderMessage,
    printOrder,
    viewOrderModal,
    exportOrdersCsv
  });
  function filteredOrders() {
    const needle = ctx.R.normalizeText(ctx.searchTerm);
    return ctx.orderList().filter((order) => {
      if (ctx.orderFilter !== "all" && ctx.orderGroupOf(order.status) !== ctx.orderFilter) return false;
      if (!needle) return true;
      const haystack = ctx.R.normalizeText(
        [
          order.id,
          order.customer?.name,
          order.customer?.phone,
          order.customer?.city,
          order.customer?.address,
          ...(order.items || []).map((item) => item.title)
        ].join(" ")
      );
      return haystack.includes(needle);
    });
  }

  /** `ctx.esc(value || "")` — the dominant pattern in this module. */
  const escOr = (value) => ctx.esc(value || "");

  /** Desktop row: status pill + the same next-step / WhatsApp / call bar as the phone cards (no status dropdown). */
  function orderRow(order) {
    const status = ctx.R.statusMeta(order.status);
    const itemCount = (order.items || []).reduce((sum, item) => sum + Number(item.qty || 1), 0);
    return `<tr>
          <td><strong class="u-fs-9">${ctx.esc(order.id)}</strong><br><small class="u-fs-8 u-soft">${ctx.esc(ctx.fmtDateTime(order.createdAt))}</small></td>
          <td><strong class="u-fs-10">${escOr(order.customer?.name)}</strong><br><small class="u-fs-8 u-soft" dir="ltr">${escOr(order.customer?.phone)}</small></td>
          <td>${escOr(order.customer?.city)}</td>
          <td>${itemCount}</td>
          <td>${escOr(order.payment?.name)}</td>
          <td class="price">${ctx.money(order.total)}</td>
          <td><span class="status-pill" data-sv="status:${ctx.esc(status.color)}">${ctx.esc(ctx.lng(status.label))}</span></td>
          <td class="oc-cell">${ctx.orderActionBar(order, { compact: true })}<button class="btn btn-sm btn-soft" type="button" data-action="view-order" data-id="${ctx.esc(order.id)}">${ctx.dt("عرض", "Voir")}</button></td>
        </tr>`;
  }

  function ordersTable(orders) {
    if (!orders.length)
      return `<div class="table-empty">${ctx.icon("orders")}<p>${ctx.dt("لا توجد طلبات مطابقة.", "Aucune commande correspondante.")}</p></div>`;
    return `<div class="dash-table-wrap"><table class="dash-table">
      <thead><tr><th>${ctx.dt("الطلب", "Commande")}</th><th>${ctx.dt("العميل", "Client")}</th><th>${ctx.dt("المدينة", "Ville")}</th><th>${ctx.dt("المنتجات", "Articles")}</th><th>${ctx.dt("الدفع", "Paiement")}</th><th>${ctx.dt("المجموع", "Total")}</th><th>${ctx.dt("الحالة", "Statut")}</th><th>${ctx.dt("الخطوة التالية", "Prochaine étape")}</th></tr></thead>
      <tbody>${orders.map(orderRow).join("")}</tbody>
    </table></div>`;
  }

  function viewOrders() {
    const orders = filteredOrders();
    const tabs = ctx.orderGroups();
    const tabHTML = (tab) =>
      `<button type="button" data-order-filter="${tab.id}" class="${ctx.orderFilter === tab.id ? "active" : ""}">${ctx.esc(tab.label)}${
        tab.count ? ` <span class="oc-count${tab.urgent ? " urgent" : ""}">${tab.count}</span>` : ""
      }</button>`;
    return `
      <div class="dash-view-head">
        <div><h2>${ctx.dt("الطلبات", "Commandes")}</h2><p>${ctx.dt("كل طلب يصل من المتجر يظهر هنا فورًا.", "Chaque commande de la boutique apparaît ici en direct.")}</p></div>
        <div class="dash-view-actions"><details class="dash-more"><summary aria-label="${ctx.dt("المزيد", "Plus")}">⋯</summary><div class="dash-more-menu"><button class="btn btn-soft btn-sm" type="button" data-action="export-orders">${ctx.icon("download")} ${ctx.dt("تصدير CSV", "Exporter CSV")}</button></div></details></div>
      </div>
      <div class="dash-toolbar orders-toolbar">
        <div class="segmented orders-tabs">${tabs.map(tabHTML).join("")}</div>
        <div class="spacer"></div>
        <label class="field u-min-210"><input id="order-search" placeholder="${ctx.dt("بحث بالاسم أو الهاتف", "Nom ou téléphone")}" value="${ctx.esc(ctx.searchTerm)}"></label>
      </div>
      <div class="orders-phone">${ctx.orderCardsHTML(orders)}</div>
      <div class="dash-card orders-desk">${ordersTable(orders)}</div>`;
  }

  function orderMessage(order, type = "confirm") {
    const template = ctx.model.settings.whatsappTemplates?.[type];
    if (!template) return "";
    const text = ctx
      .lng(template)
      .replaceAll("{name}", order.customer?.name || "")
      .replaceAll("{order_id}", order.id)
      .replaceAll("{store}", ctx.lng(ctx.model.settings.storeName));
    return text;
  }

  /** One `<tr>` of the printed document. */
  function printItemRows(order) {
    return (order.items || [])
      .map(
        (item) =>
          `<tr><td>${ctx.esc(ctx.lng(item.title))}<br><small>${ctx.esc(item.variantTitle || "")} ${ctx.esc(item.specsText || "")}</small></td><td>${item.qty}</td><td>${ctx.money(item.price)}</td><td>${ctx.money(item.line)}</td></tr>`
      )
      .join("");
  }

  /** The A4 document styles live in assets/css/print.css (a written document cannot carry a <style> block under CSP). */

  function printDocumentTitle(order, invoice) {
    if (invoice) return `${ctx.dt("فاتورة", "Facture")} ${ctx.esc(order.id)}`;
    return `${ctx.dt("ملصق شحن", "Étiquette")} ${ctx.esc(order.id)}`;
  }

  function printHeaderHTML(order, invoice) {
    const logoPath = `assets/img/brand-logo.svg`;
    const logo = ctx.esc(ctx.model.settings.logo || logoPath);
    const storeName = ctx.esc(ctx.model.settings.storeName?.[ctx.dashLang] || "");
    const heading = invoice ? ctx.dt("فاتورة", "Facture") : ctx.dt("ملصق شحن", "Étiquette d’expédition");
    const phone = ctx.esc(ctx.model.settings.mapPhone || ctx.model.settings.phoneDisplay || "");
    const address = ctx.esc(ctx.lng(ctx.model.settings.address));
    const email = ctx.esc(ctx.model.settings.email || "");
    return `<header><div><img src="${location.origin}${location.pathname.replace(/[^/]*$/, "")}${logo}" alt="${storeName}"><h1>${heading}</h1></div><div class="u-text-end"><strong>${phone}</strong><br>${address}<br>${email}</div></header>`;
  }

  function printInvoiceBody(order, itemRows) {
    const status = ctx.esc(ctx.lng(ctx.R.statusMeta(order.status).label));
    const customer = `${ctx.esc(order.customer?.name || "")}<br>${ctx.esc(order.customer?.phone || "")}<br>${ctx.esc(order.customer?.city || "")} — ${ctx.esc(order.customer?.address || "")}`;
    return `<div class="grid"><div class="box"><strong>${ctx.dt("فاتورة", "Facture")}: ${ctx.esc(order.id)}</strong><br>${ctx.esc(ctx.fmtDate(order.createdAt))}<br>${ctx.dt("الحالة", "Statut")}: ${status}</div><div class="box"><strong>${ctx.dt("العميل", "Client")}</strong><br>${customer}</div></div>
      <table><thead><tr><th>${ctx.dt("المنتج", "Produit")}</th><th>${ctx.dt("الكمية", "Qté")}</th><th>${ctx.dt("السعر", "Prix")}</th><th>${ctx.dt("المجموع", "Total")}</th></tr></thead><tbody>${itemRows}</tbody></table>
      <div class="total">${ctx.dt("المجموع الكلي", "Total")}: ${ctx.money(order.total)}</div>`;
  }

  function printAddressLines(order) {
    const city = ctx.esc(order.customer?.city || "");
    return `<strong>${ctx.esc(order.customer?.name || "")}</strong><br>${ctx.esc(order.customer?.phone || "")}<br>${ctx.esc(order.customer?.address || "")}<br>${city} — ${ctx.dt("موريتانيا", "Mauritanie")}`;
  }

  function printLabelBody(order) {
    const storeName = ctx.esc(ctx.model.settings.storeName?.[ctx.dashLang] || "Restore");
    const barcode = `<div class="barcode">${ctx.esc(order.id)} · ${ctx.esc(ctx.digits(order.customer?.phone).slice(-8))}</div>`;
    return `<div class="label"><h2>${storeName}</h2><div class="addr">${printAddressLines(order)}</div>${barcode}</div>`;
  }

  /** The document body (the page shell, dir and title live in print.html). */
  function printDocumentBody(order, invoice) {
    const itemRows = printItemRows(order);
    const body = invoice ? printInvoiceBody(order, itemRows) : printLabelBody(order);
    const footer = ctx.dt(
      "تم إنشاء هذا المستند من لوحة تحكم المتجر.",
      "Document généré depuis le tableau de bord de la boutique."
    );
    return `${printHeaderHTML(order, invoice)}
      ${body}
      <p class="print-footer">${footer}</p>`;
  }

  /** Prints through a real same-origin page: an about:blank popup cannot load a stylesheet under CSP. */
  function printOrder(order, mode) {
    const invoice = mode === "invoice";
    const key = `restore_print_${Date.now()}`;
    const payload = {
      title: printDocumentTitle(order, invoice),
      lang: ctx.dashLang,
      dir: ctx.dashLang === "ar" ? "rtl" : "ltr",
      body: printDocumentBody(order, invoice)
    };
    try {
      sessionStorage.setItem(key, JSON.stringify(payload));
    } catch {
      ctx.toast(ctx.dt("تعذر تجهيز الطباعة", "Impression impossible"), "error");
      return;
    }
    const win = window.open(`print.html?doc=${encodeURIComponent(key)}`, "_blank", "width=820,height=980");
    if (!win) {
      ctx.toast(ctx.dt("اسمح بالنوافذ المنبثقة للطباعة", "Autorisez les pop-ups pour imprimer"), "error");
      return;
    }
    // print-document.js prints once the sheet has loaded; this cleans the entry up afterwards
    setTimeout(() => sessionStorage.removeItem(key), 5000);
  }

  function orderItemRow(item) {
    const specs = item.specsText ? `· ${ctx.esc(item.specsText)}` : "";
    return `<div class="order-item-row"><img src="${ctx.esc(displayImage(item))}" alt="" data-fb="${FALLBACK_PHOTO}"><div class="grow"><strong>${ctx.esc(ctx.lng(item.title))}</strong><small>${ctx.esc(item.variantTitle || "")} ${specs}</small></div><span>×${item.qty}</span><strong>${ctx.money(item.line)}</strong></div>`;
  }

  function orderTotalsHTML(order) {
    return `<div class="order-totals">
              <div><span>${ctx.dt("المجموع الفرعي", "Sous-total")}</span><span>${ctx.money(order.subtotal)}</span></div>
              <div><span>${ctx.dt("الشحن", "Livraison")}</span><span>${ctx.money(order.shipping)}</span></div>
              <div><span>${ctx.dt("الخصم", "Réduction")}</span><span>${ctx.money(order.discount)}</span></div>
              <div class="total"><span>${ctx.dt("المجموع", "Total")}</span><span>${ctx.money(order.total)}</span></div>
            </div>`;
  }

  function orderContactLine(order) {
    return `<strong>${escOr(order.customer?.name)}</strong><br><span dir="ltr">${escOr(order.customer?.phone)}</span><br>${escOr(order.customer?.city)}<br>${escOr(order.customer?.address)}<br>${escOr(order.customer?.email)}`;
  }

  function orderContactSection(order, wa) {
    const phone = ctx.esc(order.customer?.phone);
    return `<div class="order-detail-section">
            <h4>${ctx.dt("العميل", "Client")}</h4>
            <p>${orderContactLine(order)}</p>
            <div class="u-flex u-gap-5 u-mt-9 u-wrap"><a class="btn btn-sm btn-whatsapp" href="${wa}" target="_blank" rel="noopener">${ctx.icon("whatsapp")} ${ctx.dt("واتساب", "WhatsApp")}</a><a class="btn btn-sm btn-soft" href="tel:${phone}">${ctx.dt("اتصال", "Appeler")}</a></div>
          </div>`;
  }

  function orderManagementSection(order) {
    const payment = ctx.esc(order.payment?.name || "");
    const source = ctx.esc(order.source || "whatsapp");
    const printIcon = ctx.icon("print");
    const id = ctx.esc(order.id);
    return `<details class="order-detail-section order-more u-mt-10"><summary>${ctx.dt("المزيد: الحالة يدوياً، ملاحظة داخلية، فاتورة وملصق", "Plus : statut manuel, note interne, facture et étiquette")}</summary>
            <div class="field u-mt-8"><label>${ctx.dt("الحالة", "Statut")}</label><select data-order-status="${id}">${ctx.statusOptions(order.status)}</select></div>
            <div class="field u-mt-8"><label>${ctx.dt("ملاحظة داخلية", "Note interne")}</label><textarea rows="3" data-order-note="${id}">${ctx.esc(order.internalNote || "")}</textarea></div>
            <div class="u-flex u-gap-5 u-wrap u-mt-8"><button class="btn btn-sm btn-soft" data-action="print-invoice" data-id="${id}">${printIcon} ${ctx.dt("فاتورة", "Facture")}</button><button class="btn btn-sm btn-soft" data-action="print-label" data-id="${id}">${printIcon} ${ctx.dt("ملصق شحن", "Étiquette")}</button></div>
            <p class="form-note u-mt-8">${ctx.dt("الدفع", "Paiement")}: <strong>${payment}</strong> · ${ctx.dt("المصدر", "Source")}: ${source}</p>
          </details>`;
  }

  function orderCustomerHTML(order, wa, statusColor) {
    const label = ctx.esc(ctx.lng(ctx.R.statusMeta(order.status).label));
    return `<div class="order-detail-section order-step"><h4>${ctx.dt("الخطوة التالية", "Prochaine étape")} · <span class="status-pill" data-sv="status:${ctx.esc(statusColor)}">${label}</span></h4>${ctx.orderActionBar(order)}</div>
      <div class="u-mt-10">${orderContactSection(order, wa)}</div>${orderManagementSection(order)}`;
  }

  function viewOrderModal(id) {
    const order = ctx.R.getOrders().find((item) => item.id === id);
    if (!order) return;
    const status = ctx.R.statusMeta(order.status);
    const statusColor = status.color;
    const wa = ctx.orderWhatsAppLink(order);
    const items = (order.items || []).map(orderItemRow).join("");
    const footer = `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إغلاق", "Fermer")}</button><button class="btn btn-primary btn-sm" data-action="save-order" data-id="${ctx.esc(order.id)}">${ctx.icon("check")} ${ctx.dt("حفظ التغييرات", "Enregistrer")}</button>`;
    ctx.openModal(
      `${ctx.dt("الطلب", "Commande")} ${order.id}`,
      `
      <div class="order-detail">
        <div>
          <div class="order-detail-section">
            <h4>${ctx.dt("المنتجات", "Articles")}</h4>
            ${items}
            ${orderTotalsHTML(order)}
          </div>
          <div class="order-detail-section u-mt-10">
            <h4>${ctx.dt("ملاحظات العميل", "Notes du client")}</h4>
            <p>${ctx.esc(order.customer?.notes || ctx.dt("لا توجد ملاحظات", "Aucune note"))}</p>
          </div>
        </div>
        <div>
          ${orderCustomerHTML(order, wa, statusColor)}
        </div>
      </div>`,
      { wide: true, footer }
    );
  }

  /** Flat CSV projection of one order. */
  function orderCsvRow(order) {
    const customer = order.customer || {};
    const payment = order.payment || {};
    const items = (order.items || []).map((item) => `${item.title} x${item.qty}`).join(" | ");
    return [
      order.id,
      order.createdAt,
      order.status,
      customer.name,
      customer.phone,
      customer.city,
      customer.address,
      payment.name,
      items,
      order.subtotal,
      order.shipping,
      order.discount,
      order.total,
      order.currency || "MRU",
      order.coupon || "",
      customer.notes || ""
    ];
  }

  function exportOrdersCsv() {
    const orders = ctx.orderList();
    const rows = [
      [
        "order_id",
        "date",
        "status",
        "name",
        "phone",
        "city",
        "address",
        "payment",
        "items",
        "subtotal",
        "shipping",
        "discount",
        "total",
        "currency",
        "coupon",
        "notes"
      ],
      ...orders.map(orderCsvRow)
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `restore-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    ctx.toast(ctx.dt("تم تصدير الطلبات", "Commandes exportées"), "good");
  }
}
