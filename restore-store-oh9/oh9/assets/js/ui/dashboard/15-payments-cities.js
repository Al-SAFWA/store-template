// @ts-check
/* dashboard.js → Payments and shipping cities (1.15: phone-first cards)
   Payment methods are cards with an on/off switch and a 4-step editor (active → account number → discount → note).
   Cities are cards too: the fee is edited in place, the switch disables a city, "+ city" opens a 3-field editor.
   Data shape is unchanged except one new optional field per payment: `account` (the number the customer pays to). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { viewPayments, paymentEditor, viewPaymentSave, cityEditor, viewCitySave, setCityFee });

  const payments = () => ctx.model.settings.payments || [];
  const cities = () => ctx.model.settings.cities || [];

  /** One line under the payment name: what the customer will see, or what is still missing. */
  function paymentMeta(payment) {
    const parts = [];
    if (payment.account) parts.push(`${ctx.dt("الحساب", "Compte")} ${payment.account}`);
    else if (!/cash|cod|delivery|استلام/i.test(`${payment.id} ${payment.name?.ar || ""}`))
      parts.push(ctx.dt("لم يُضف رقم حساب", "Pas de numéro de compte"));
    if (Number(payment.discount) > 0) parts.push(`${ctx.dt("خصم", "Remise")} ${payment.discount}%`);
    const note = ctx.lng(payment.note) || "";
    // 1.17.2 — a note that promises a % the method does not have is not shown (storefront drops it too)
    const stale = /\d{1,2}\s*%/.test(note) && !(Number(payment.discount) > 0);
    if (stale)
      parts.push(
        ctx.dt("⚠ الملاحظة تذكر خصمًا غير مفعّل — لن تظهر للزبون", "⚠ La note promet une remise inactive — masquée")
      );
    return parts.join(" · ") || note;
  }

  function paymentCard(payment, index) {
    const mark =
      payment.image || payment.logo
        ? `<img src="${ctx.esc(payment.image || payment.logo)}" alt="">`
        : `<span class="u-tint" data-sv="bg:${ctx.esc(payment.color || "#0b6fb8")}">${ctx.esc(String(ctx.lng(payment.name) || "?").slice(0, 1))}</span>`;
    return `<article class="pc-card${payment.active === false ? " is-off" : ""}">
      <button type="button" class="pc-main" data-action="edit-payment" data-index="${index}" aria-label="${ctx.esc(ctx.lng(payment.name))}">
        <span class="pc-mark">${mark}</span>
        <span class="pc-text"><strong>${ctx.esc(ctx.lng(payment.name))}</strong><small>${ctx.esc(paymentMeta(payment))}</small></span>
      </button>
      <label class="toggle"><input type="checkbox" data-payment-active="${index}" ${payment.active !== false ? "checked" : ""}><span></span></label>
    </article>`;
  }

  function cityCard(city, index) {
    const free = Number(city.fee) <= 0;
    return `<article class="pc-card pc-city${city.active === false ? " is-off" : ""}">
      <button type="button" class="pc-main" data-action="edit-city" data-index="${index}">
        <span class="pc-text"><strong>${ctx.esc(ctx.lng(city.name))}</strong><small>${ctx.esc(ctx.lng(city.days))}</small></span>
      </button>
      <label class="pc-fee"><input type="number" min="0" inputmode="numeric" data-city-fee="${index}" value="${ctx.esc(city.fee ?? 0)}" aria-label="${ctx.esc(ctx.dt("رسوم التوصيل", "Frais"))}"><span>${free ? ctx.dt("مجاني", "Gratuit") : "MRU"}</span></label>
      <label class="toggle"><input type="checkbox" data-city-active="${index}" ${city.active !== false ? "checked" : ""}><span></span></label>
    </article>`;
  }

  function viewPayments() {
    const anyDiscount = payments().some((p) => p.active !== false && Number(p.discount) > 0);
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("الدفع والتوصيل", "Paiement & livraison")}</h2><p>${ctx.dt("فعّل ما تقبله فقط؛ يظهر للزبون عند إتمام الطلب. يُحفظ تلقائياً، واضغط «نشر» ليظهر في المتجر.", "Activez ce que vous acceptez ; visible à la commande. Sauvegarde automatique, publiez pour l’afficher.")}</p></div></div>
      <div class="pc">
        <section class="pc-section">
          <div class="pc-head"><h3>${ctx.dt("طرق الدفع", "Moyens de paiement")}</h3><button class="btn btn-soft btn-sm" data-action="add-payment">${ctx.icon("plus")} ${ctx.dt("طريقة أخرى", "Autre moyen")}</button></div>
          ${payments().map(paymentCard).join("") || `<p class="form-note">${ctx.dt("لا توجد طرق دفع بعد.", "Aucun moyen de paiement.")}</p>`}
          <p class="form-note">${
            anyDiscount
              ? ctx.dt(
                  "يوجد خصم على طريقة دفع: يظهر بانر العرض في الصفحة الرئيسية وصفحة المنتج.",
                  "Une remise est active : la bannière d’offre s’affiche sur l’accueil et la fiche produit."
                )
              : ctx.dt(
                  "لا خصم على أي طريقة دفع: بانر العرض مخفي تلقائياً في المتجر.",
                  "Aucune remise : la bannière d’offre est masquée automatiquement."
                )
          }</p>
        </section>
        <section class="pc-section">
          <div class="pc-head"><h3>${ctx.dt("مدن التوصيل", "Villes de livraison")}</h3><span class="form-note">${ctx.dt("السعر بالأوقية؛ عدّله في مكانه.", "Prix en MRU ; modifiable en place.")}</span></div>
          ${cities().map(cityCard).join("")}
          <button type="button" class="pc-add" data-action="add-city">${ctx.icon("plus")} ${ctx.dt("مدينة أخرى", "Autre ville")}</button>
        </section>
        <section class="pe-step pc-free">
          <h4>${ctx.dt("توصيل مجاني للطلبات فوق", "Livraison offerte au-dessus de")}</h4>
          <label class="si-field"><input type="number" min="0" inputmode="numeric" data-path="settings.freeShippingOver" value="${ctx.esc(ctx.model.settings.freeShippingOver ?? 0)}"><small>${ctx.dt("بالأوقية. اتركه 0 لإلغاء الميزة.", "En MRU. 0 pour désactiver.")}</small></label>
          ${ctx.biField(ctx.dt("ملاحظة الشحن (تظهر في صفحة المنتج)", "Note livraison (fiche produit)"), "settings.shippingNote", { type: "textarea", rows: 2 })}
          ${ctx.directToggle(ctx.dt("إخفاء المنتجات المنتهية من المتجر", "Masquer les produits épuisés"), "settings.autoHideOutOfStock", ctx.model.settings.autoHideOutOfStock)}
        </section>
      </div>`;
  }

  /** In-place fee edit on a city card. */
  function setCityFee(index, value) {
    const city = cities()[Number(index)];
    if (!city) return;
    city.fee = Math.max(0, Number(value) || 0);
    ctx.saveDraftNow();
    const unit = document.querySelector(`[data-city-fee="${index}"]`)?.nextElementSibling;
    if (unit) unit.textContent = city.fee <= 0 ? ctx.dt("مجاني", "Gratuit") : "MRU";
  }

  ctx.pendingPaymentIndex = null;
  function paymentEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? {
          id: `payment-${Date.now().toString(36)}`,
          name: { ar: "", fr: "" },
          image: "",
          color: "#0b6fb8",
          active: true,
          account: "",
          discount: 0,
          note: { ar: "", fr: "" }
        }
      : ctx.clone(payments()[index]);
    if (buffer.account == null) buffer.account = "";
    ctx.editBuffer = buffer;
    ctx.pendingPaymentIndex = isNew ? null : index;
    const step = (title, body) => `<section class="pe-step"><h4>${title}</h4>${body}</section>`;
    ctx.openModal(
      isNew ? ctx.dt("طريقة دفع جديدة", "Nouveau moyen") : ctx.lng(buffer.name),
      `<div class="pe">
        ${isNew ? step(ctx.dt("الاسم", "Nom"), `<label class="si-field"><input data-edit-path="name.ar" value="" dir="rtl" placeholder="${ctx.dt("مثل: بنكيلي", "ex. Bankily")}"></label><label class="si-field"><span>Français</span><input data-edit-path="name.fr" value="" dir="ltr"></label>`) : ""}
        ${step(ctx.dt("تفعيل", "Activation"), ctx.editToggle(ctx.dt("مفعّلة — تظهر للزبون", "Active — visible au client"), "active", buffer.active !== false))}
        ${step(
          ctx.dt("رقم الحساب الذي يحوّل إليه الزبون", "Numéro de compte à créditer"),
          `<label class="si-field"><input data-edit-path="account" value="${ctx.esc(buffer.account)}" dir="ltr" inputmode="tel" placeholder="44 12 34 56"><small>${ctx.dt("يظهر للزبون مع زر «نسخ» في صفحة الدفع وفي رسالة واتساب. اتركه فارغاً للدفع عند الاستلام.", "Affiché au client avec un bouton « copier » au paiement et dans WhatsApp. Vide pour le paiement à la livraison.")}</small></label>`
        )}
        ${step(
          ctx.dt("خصم عند الدفع بهذه الطريقة", "Remise avec ce moyen"),
          `<label class="si-field pc-pct"><input type="number" min="0" max="90" inputmode="numeric" data-edit-path="discount" value="${ctx.esc(buffer.discount || 0)}"><b>%</b><small>${ctx.dt("اتركه 0 إن لم يكن هناك خصم؛ بانر العرض يختفي تلقائياً.", "0 s’il n’y a pas de remise ; la bannière disparaît automatiquement.")}</small></label>`
        )}
        ${step(
          ctx.dt("ملاحظة للزبون (اختياري)", "Note au client (optionnel)"),
          `<label class="si-field"><input data-edit-path="note.ar" value="${ctx.esc(buffer.note?.ar || "")}" dir="rtl" placeholder="${ctx.dt("مثل: أرسل لقطة التحويل عبر واتساب", "ex. Envoyez la capture du virement")}"></label>
           <small class="form-note">${ctx.dt("لا تكتب نسبة الخصم هنا؛ تُعرض تلقائياً من الخطوة 3.", "N’écrivez pas la remise ici ; elle s’affiche depuis l’étape 3.")}</small>
           <details class="pe-more"><summary>${ctx.dt("بالفرنسية، اللون والشعار", "Français, couleur et logo")}</summary><div class="pe-more-body">
             <label class="si-field"><span>Note FR</span><input data-edit-path="note.fr" value="${ctx.esc(buffer.note?.fr || "")}" dir="ltr"></label>
             <label class="si-field"><span>${ctx.dt("اللون", "Couleur")}</span><input type="color" data-edit-path="color" value="${ctx.esc(buffer.color || "#0b6fb8")}"></label>
             ${ctx.imageEditor(ctx.dt("شعار التطبيق", "Logo de l’application"), "image", buffer.image || buffer.logo || "")}
           </div></details>`
        )}
      </div>`,
      { footer: ctx.editorFooter(!isNew, "delete-payment-buffer") }
    );
  }

  function viewPaymentSave() {
    const item = ctx.editBuffer;
    if (!item) return;
    if (item.note && !item.note.fr) item.note.fr = item.note.ar || "";
    if (item.name && !item.name.fr) item.name.fr = item.name.ar || "";
    item.discount = Math.max(0, Math.min(90, Number(item.discount) || 0));
    item.account = String(item.account || "").trim();
    if (ctx.pendingPaymentIndex == null) ctx.model.settings.payments.push(item);
    else ctx.model.settings.payments[ctx.pendingPaymentIndex] = item;
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(ctx.dt("تم حفظ طريقة الدفع", "Paiement enregistré"), "good");
  }

  ctx.pendingCityIndex = null;
  function cityEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? {
          id: `city-${Date.now().toString(36)}`,
          name: { ar: "", fr: "" },
          fee: 0,
          days: { ar: "2–4 أيام", fr: "2–4 jours" },
          active: true
        }
      : ctx.clone(cities()[index]);
    ctx.editBuffer = buffer;
    ctx.pendingCityIndex = isNew ? null : index;
    ctx.openModal(
      isNew ? ctx.dt("مدينة جديدة", "Nouvelle ville") : ctx.lng(buffer.name),
      `<div class="pe">
        <section class="pe-step"><h4>${ctx.dt("المدينة", "Ville")}</h4>
          <label class="si-field"><input data-edit-path="name.ar" value="${ctx.esc(buffer.name?.ar || "")}" dir="rtl" placeholder="${ctx.dt("مثل: روصو", "ex. Rosso")}"></label>
          <details class="pe-more"><summary>Français</summary><div class="pe-more-body"><label class="si-field"><input data-edit-path="name.fr" value="${ctx.esc(buffer.name?.fr || "")}" dir="ltr"></label></div></details>
        </section>
        <section class="pe-step"><h4>${ctx.dt("رسوم التوصيل", "Frais de livraison")}</h4>
          <label class="si-field"><input type="number" min="0" inputmode="numeric" data-edit-path="fee" value="${ctx.esc(buffer.fee ?? 0)}"><small>${ctx.dt("بالأوقية. 0 = مجاني.", "En MRU. 0 = gratuit.")}</small></label>
        </section>
        <section class="pe-step"><h4>${ctx.dt("المدة", "Délai")}</h4>
          <label class="si-field"><input data-edit-path="days.ar" value="${ctx.esc(buffer.days?.ar || "")}" dir="rtl" placeholder="2–4 أيام"></label>
          <details class="pe-more"><summary>Français</summary><div class="pe-more-body"><label class="si-field"><input data-edit-path="days.fr" value="${ctx.esc(buffer.days?.fr || "")}" dir="ltr"></label></div></details>
        </section>
        <section class="pe-step"><h4>${ctx.dt("الحالة", "État")}</h4>${ctx.editToggle(ctx.dt("نشطة — تظهر في صفحة الدفع", "Active — visible au paiement"), "active", buffer.active !== false)}</section>
      </div>`,
      { footer: ctx.editorFooter(!isNew, "delete-city-buffer") }
    );
  }

  function viewCitySave() {
    const item = ctx.editBuffer;
    if (!item) return;
    if (item.name && !item.name.fr) item.name.fr = item.name.ar || "";
    if (item.days && !item.days.fr) item.days.fr = item.days.ar || "";
    item.fee = Math.max(0, Number(item.fee) || 0);
    if (ctx.pendingCityIndex == null) ctx.model.settings.cities.push(item);
    else ctx.model.settings.cities[ctx.pendingCityIndex] = item;
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(ctx.dt("تم حفظ المدينة", "Ville enregistrée"), "good");
  }
}
