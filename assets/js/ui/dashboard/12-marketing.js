// @ts-check
/* dashboard.js → Marketing: coupons + home promo banner + announcement (1.14)
   Coupons are phone cards (code, what it gives, status, on/off, copy). The editor is 4 steps: code → discount →
   minimum order → expiry, plus one switch that turns the coupon into the homepage promo banner (`settings.offers[0]`).
   Shared state lives on `ctx`. */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { viewMarketing, couponEditor, setCouponType, copyText });

  const coupons = () => (ctx.model.settings.coupons = ctx.model.settings.coupons || []);
  const offers = () => (ctx.model.settings.offers = ctx.model.settings.offers || []);
  const isExpired = (coupon) => Boolean(coupon.expiresAt) && Date.parse(coupon.expiresAt) < Date.now() - 86400000;
  const valueText = (coupon) => (coupon.type === "percent" ? `${Number(coupon.value) || 0}%` : ctx.money(coupon.value));

  function couponMeta(coupon) {
    const parts = [ctx.dt(`خصم ${valueText(coupon)}`, `-${valueText(coupon)}`)];
    if (Number(coupon.minTotal) > 0)
      parts.push(ctx.dt(`لطلب فوق ${ctx.money(coupon.minTotal)}`, `dès ${ctx.money(coupon.minTotal)}`));
    if (isExpired(coupon)) parts.push(ctx.dt("منتهي", "Expiré"));
    else if (coupon.expiresAt)
      parts.push(ctx.dt(`حتى ${ctx.fmtDate(coupon.expiresAt)}`, `jusqu’au ${ctx.fmtDate(coupon.expiresAt)}`));
    const promo = offers()[0];
    if (promo && promo.active !== false && String(promo.code || "").toUpperCase() === String(coupon.code).toUpperCase())
      parts.push(ctx.dt("في بانر الرئيسية", "Bannière accueil"));
    return parts.join(" · ");
  }

  function couponCard(coupon, index) {
    const off = coupon.active === false || isExpired(coupon);
    return `<article class="cp-card ${off ? "is-off" : ""}">
      <button type="button" class="cp-main" data-action="edit-coupon" data-index="${index}">
        <span class="cp-code" dir="ltr">${ctx.esc(coupon.code)}</span>
        <span class="cp-text"><strong>${ctx.esc(valueText(coupon))}</strong><small>${ctx.esc(couponMeta(coupon))}</small></span>
      </button>
      <button type="button" class="btn btn-soft btn-sm" data-action="copy-text" data-text="${ctx.esc(coupon.code)}" aria-label="${ctx.dt("نسخ", "Copier")}">${ctx.icon("copy")}</button>
      <label class="toggle"><input type="checkbox" data-coupon-active="${index}" ${coupon.active !== false ? "checked" : ""}><span></span></label>
    </article>`;
  }

  function promoSection() {
    const promo = offers()[0] || {};
    return `<section class="pc-section cp-block">
      <div class="pc-head"><h3>${ctx.dt("بانر الصفحة الرئيسية", "Bannière de l’accueil")}</h3></div>
      <p class="form-note">${ctx.dt("يظهر في أعلى الرئيسية مع عدّ تنازلي. الطريقة الأسهل: افتح كوبوناً وفعّل «اعرضه في بانر الرئيسية».", "Affichée en haut de l’accueil avec compte à rebours. Le plus simple : ouvrez un coupon et activez « afficher sur l’accueil ».")}</p>
      ${ctx.directToggle(ctx.dt("البانر ظاهر", "Bannière visible"), "settings.offers.0.active", promo.active !== false && Boolean(promo.title))}
      <details class="pe-more"><summary>${ctx.dt("تعديل نص البانر يدوياً", "Modifier le texte manuellement")}</summary><div class="pe-more-body">
        ${ctx.biField(ctx.dt("العنوان", "Titre"), "settings.offers.0.title")}
        ${ctx.biField(ctx.dt("الوصف", "Sous-titre"), "settings.offers.0.subtitle", { type: "textarea", rows: 2 })}
        <div class="form-grid">${ctx.field(ctx.dt("الكود", "Code"), "settings.offers.0.code")}${ctx.field(ctx.dt("نهاية العرض", "Fin"), "settings.offers.0.endsAt", { type: "datetime-local" })}</div>
      </div></details>
    </section>`;
  }

  function viewMarketing() {
    const list = coupons();
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("الكوبونات والعروض", "Coupons & offres")}</h2><p>${ctx.dt("أنشئ كود خصم، انسخه وأرسله لزبائنك على واتساب. اضغط الكوبون لتعديله.", "Créez un code, copiez-le et envoyez-le sur WhatsApp. Touchez un coupon pour le modifier.")}</p></div></div>
      <div class="cp">
        <section class="pc-section">
          <div class="pc-head"><h3>${ctx.dt("كوبونات الخصم", "Coupons")}</h3></div>
          ${list.map(couponCard).join("")}
          ${list.length ? "" : `<p class="form-note">${ctx.dt("لا توجد كوبونات بعد.", "Aucun coupon.")}</p>`}
          <button type="button" class="pc-add" data-action="add-coupon">${ctx.icon("plus")} ${ctx.dt("كوبون جديد", "Nouveau coupon")}</button>
        </section>
        ${promoSection()}
        <section class="pc-section cp-block">
          <div class="pc-head"><h3>${ctx.dt("شريط الإعلان العلوي", "Bandeau d’annonce")}</h3></div>
          ${ctx.biField("", "settings.announcement", { type: "textarea", rows: 2 })}
          <details class="pe-more"><summary>${ctx.dt("رسالة المتجر المغلق", "Message boutique fermée")}</summary><div class="pe-more-body">${ctx.biField("", "settings.closedMessage", { type: "textarea", rows: 2 })}</div></details>
        </section>
      </div>`;
  }

  /* ---------- editor ---------- */

  function randomCode() {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const pick = () => letters[Math.floor(Math.random() * letters.length)];
    return `${pick()}${pick()}${pick()}${Math.floor(10 + Math.random() * 89)}`;
  }

  function couponEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? {
          id: `coupon-${Date.now().toString(36)}`,
          code: randomCode(),
          type: "percent",
          value: 10,
          active: true,
          minTotal: 0,
          expiresAt: ""
        }
      : ctx.clone(coupons()[index]);
    const promo = offers()[0];
    buffer.promo = Boolean(
      promo && promo.active !== false && String(promo.code || "").toUpperCase() === String(buffer.code).toUpperCase()
    );
    ctx.editBuffer = buffer;
    const step = (title, body, note = "") =>
      `<section class="pe-step"><h4>${title}</h4>${note ? `<p class="form-note">${note}</p>` : ""}${body}</section>`;
    const typeChip = (type, label) =>
      `<button type="button" class="ct-chip ${buffer.type === type ? "on" : ""}" data-coupon-type="${type}">${label}</button>`;
    ctx.openModal(
      isNew ? ctx.dt("كوبون جديد", "Nouveau coupon") : buffer.code,
      `<div class="pe">
        ${step(ctx.dt("الكود", "Code"), `<label class="si-field"><input data-edit-path="code" value="${ctx.esc(buffer.code)}" dir="ltr" class="cp-input" autocapitalize="characters" placeholder="EID20"><small>${ctx.dt("حروف لاتينية وأرقام فقط. هذا ما يكتبه الزبون في صفحة الدفع.", "Lettres et chiffres. C’est ce que le client saisit au paiement.")}</small></label>`)}
        ${step(
          ctx.dt("قيمة الخصم", "Remise"),
          `<div class="ct-chips u-mb-8">${typeChip("percent", ctx.dt("نسبة %", "Pourcentage %"))}${typeChip("fixed", ctx.dt("مبلغ ثابت (MRU)", "Montant fixe (MRU)"))}</div>
           <label class="si-field pc-pct"><input type="number" min="0" inputmode="numeric" data-edit-path="value" value="${ctx.esc(buffer.value)}"><b data-coupon-unit>${buffer.type === "percent" ? "%" : "MRU"}</b></label>`
        )}
        ${step(ctx.dt("الحد الأدنى للطلب", "Minimum de commande"), `<label class="si-field"><input type="number" min="0" inputmode="numeric" data-edit-path="minTotal" value="${ctx.esc(buffer.minTotal || 0)}"><small>${ctx.dt("بالأوقية. 0 = بدون حد.", "En MRU. 0 = sans minimum.")}</small></label>`)}
        ${step(
          ctx.dt("الصلاحية", "Validité"),
          `<label class="si-field"><span>${ctx.dt("ينتهي في (اختياري)", "Expire le (optionnel)")}</span><input type="date" data-edit-path="expiresAt" value="${ctx.esc(buffer.expiresAt ? String(buffer.expiresAt).slice(0, 10) : "")}" dir="ltr"></label>
           ${ctx.editToggle(ctx.dt("مفعّل", "Actif"), "active", buffer.active !== false)}
           ${ctx.editToggle(ctx.dt("اعرضه في بانر الصفحة الرئيسية", "Afficher sur la bannière de l’accueil"), "promo", buffer.promo)}`
        )}
      </div>`,
      {
        footer: `${isNew ? "" : `<button class="btn btn-danger btn-sm" type="button" data-action="delete-coupon" data-index="${index}">${ctx.icon("trash")} ${ctx.dt("حذف", "Supprimer")}</button>`}<span class="u-grow"></span><button class="btn btn-soft btn-sm" type="button" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" type="button" data-action="save-coupon" data-index="${isNew ? "" : index}">${ctx.icon("check")} ${ctx.dt("حفظ", "Enregistrer")}</button>`
      }
    );
  }

  function setCouponType(type) {
    if (!ctx.editBuffer) return;
    ctx.editBuffer.type = type;
    document.querySelectorAll("[data-coupon-type]").forEach((node) => {
      node.classList.toggle("on", /** @type {HTMLElement} */ (node).dataset.couponType === type);
    });
    const unit = document.querySelector("[data-coupon-unit]");
    if (unit) unit.textContent = type === "percent" ? "%" : "MRU";
  }

  function copyText(text) {
    const done = () => ctx.toast(ctx.dt("تم النسخ", "Copié"), "good");
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => ctx.toast(text));
    else ctx.toast(text);
  }
}

/** Homepage banner built from a coupon (title/subtitle/code/end date). */
function promoFromCoupon(ctx, coupon, current) {
  const value = coupon.type === "percent" ? `${coupon.value}%` : ctx.money(coupon.value);
  const subtitle = coupon.minTotal
    ? {
        ar: `للطلبات فوق ${ctx.money(coupon.minTotal)}. اكتب الكود في صفحة الدفع.`,
        fr: `Dès ${ctx.money(coupon.minTotal)}. Saisissez le code au paiement.`
      }
    : { ar: "اكتب الكود في صفحة الدفع وسيُطبّق الخصم.", fr: "Saisissez le code au paiement." };
  return {
    ...current,
    id: current.id || "promo",
    active: true,
    title: { ar: `خصم ${value} بكود ${coupon.code}`, fr: `-${value} avec le code ${coupon.code}` },
    subtitle,
    code: coupon.code,
    href: current.href || "collection.html?handle=all",
    endsAt: coupon.expiresAt ? `${String(coupon.expiresAt).slice(0, 10)}T23:59` : ""
  };
}

/** Normalises the editor buffer and mirrors it into the homepage banner when asked. Called by save-coupon. */
export function finalizeCouponBuffer(ctx) {
  const coupon = ctx.editBuffer;
  if (!coupon) return null;
  coupon.code = String(coupon.code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  coupon.value = Math.max(0, Number(coupon.value) || 0);
  coupon.minTotal = Math.max(0, Number(coupon.minTotal) || 0);
  if (coupon.type !== "fixed") coupon.type = "percent";
  const promo = Boolean(coupon.promo);
  delete coupon.promo;
  const offers = (ctx.model.settings.offers = ctx.model.settings.offers || []);
  const current = offers[0] || {};
  const sameCode = String(current.code || "").toUpperCase() === coupon.code;
  if (promo) {
    const hasCopy = Boolean(current.title?.ar || current.title?.fr);
    offers[0] =
      sameCode && hasCopy
        ? {
            ...current,
            active: true,
            code: coupon.code,
            endsAt: coupon.expiresAt ? `${String(coupon.expiresAt).slice(0, 10)}T23:59` : current.endsAt || ""
          }
        : promoFromCoupon(ctx, coupon, current);
  } else if (sameCode) current.active = false;
  return coupon;
}
