// @ts-check
/* dashboard.js → "My store" (1.15): the merchant's own data on ONE phone-first screen.
   Name/logo, contact (WhatsApp first), address, opening hours — fields that used to live in Settings, Appearance and
   Texts. Every input is a `[data-path]` field, so it writes straight into the draft like the rest of the dashboard;
   the preview card at the bottom mirrors what the storefront footer / "open now" badge will show. */

import { CHANNEL_DEFS, mergeChannels } from "../../domain/channels.js";

const DAY_LABELS = [
  { ar: "أحد", fr: "Dim" },
  { ar: "إثنين", fr: "Lun" },
  { ar: "ثلاثاء", fr: "Mar" },
  { ar: "أربعاء", fr: "Mer" },
  { ar: "خميس", fr: "Jeu" },
  { ar: "جمعة", fr: "Ven" },
  { ar: "سبت", fr: "Sam" }
];

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { viewStoreInfo, toggleStoreDay, storeInfoPreviewHTML });

  const S = () => ctx.model.settings;

  function input(path, value, { type = "text", dir = "", placeholder = "", inputmode = "" } = {}) {
    const attrs = [
      `data-path="${ctx.esc(path)}"`,
      `type="${type}"`,
      `value="${ctx.esc(value ?? "")}"`,
      dir ? `dir="${dir}"` : "",
      placeholder ? `placeholder="${ctx.esc(placeholder)}"` : "",
      inputmode ? `inputmode="${inputmode}"` : ""
    ]
      .filter(Boolean)
      .join(" ");
    return `<input ${attrs}>`;
  }

  function labelled(label, control, hint = "") {
    return `<label class="si-field"><span>${ctx.esc(label)}</span>${control}${hint ? `<small>${ctx.esc(hint)}</small>` : ""}</label>`;
  }

  /** Step 1 — name + logo. French name folded away; empty FR falls back to AR on the storefront already. */
  function stepIdentity() {
    const s = S();
    return `<section class="pe-step">
      <h4>${ctx.dt("الاسم والشعار", "Nom et logo")}</h4>
      <div class="si-identity">
        <div class="si-logo">${s.logo ? `<img src="${ctx.esc(s.logo)}" alt="">` : `<span>${ctx.esc(String(ctx.lng(s.storeName) || "?").slice(0, 1))}</span>`}</div>
        <div class="u-grow">
          ${labelled(ctx.dt("اسم المتجر", "Nom de la boutique"), input("settings.storeName.ar", s.storeName?.ar, { dir: "rtl" }))}
        </div>
      </div>
      <details class="pe-more"><summary>${ctx.dt("الاسم بالفرنسية وتغيير الشعار", "Nom en français et logo")}</summary>
        <div class="pe-more-body">
          ${labelled(ctx.dt("الاسم بالفرنسية", "Nom en français"), input("settings.storeName.fr", s.storeName?.fr, { dir: "ltr" }))}
          ${ctx.directImageEditor(ctx.dt("الشعار", "Logo"), "settings.logo", s.logo)}
          <p class="form-note">${ctx.dt("الأفضل: شعار أفقي بخلفية شفافة (PNG)، عرضه ضعف ارتفاعه تقريباً. يُعرض بارتفاع 34–44 بكسل في رأس المتجر — الصور المربعة أو صور المنتجات تظهر صغيرة جداً.", "Idéal : logo horizontal sur fond transparent (PNG), environ deux fois plus large que haut. Affiché à 34–44 px de haut dans l’en-tête ; les images carrées ou photos produits paraîtront minuscules.")}</p>
        </div>
      </details>
    </section>`;
  }

  function channelValuePath(def) {
    if (def.id === "whatsapp") return "settings.whatsapp";
    if (def.id === "phone") return "settings.phoneDisplay";
    if (def.id === "email") return "settings.email";
    return `settings.channels.${def.id}.value`;
  }

  function channelValueNow(def, item) {
    if (def.id === "whatsapp") return S().whatsapp;
    if (def.id === "phone") return S().phoneDisplay;
    if (def.id === "email") return S().email;
    return item.value;
  }

  function stepChannels() {
    const channels = mergeChannels(S(), window.BRAND || {});
    S().channels = channels;
    const row = (def) => {
      const item = channels[def.id] || { value: "", visible: false };
      const path = `settings.channels.${def.id}`;
      const valueField =
        def.kind === "i18n"
          ? `${labelled(ctx.dt("عربي", "Arabe"), input(`${path}.value.ar`, item.value?.ar || "", { dir: "rtl" }))}
             ${labelled("Français", input(`${path}.value.fr`, item.value?.fr || "", { dir: "ltr" }))}`
          : labelled(
              ctx.dt(def.ar, def.fr),
              input(channelValuePath(def), channelValueNow(def, item) || "", {
                dir: "ltr",
                type: def.kind === "email" ? "email" : def.kind === "url" ? "url" : "text",
                inputmode: def.kind === "phone" ? "tel" : "",
                placeholder: def.kind === "url" ? "https://" : ""
              })
            );
      return `<div class="si-channel">${ctx.directToggle(ctx.dt("إظهار", "Afficher"), `${path}.visible`, item.visible !== false)}${valueField}</div>`;
    };
    return `<section class="pe-step">
      <h4>${ctx.dt("حسابات التواصل", "Comptes de contact")}</h4>
      <p class="form-note">${ctx.dt("الحساب الفارغ أو المخفي لا يظهر في الفوتر ولا في زر الطلب.", "Un compte vide ou masqué n’apparaît ni dans le pied de page ni sur le bouton de commande.")}</p>
      ${CHANNEL_DEFS.map(row).join("")}
    </section>`;
  }

  /** Step 3 — address + optional Google Maps link. */
  function stepAddress() {
    const s = S();
    return `<section class="pe-step">
      <h4>${ctx.dt("العنوان", "Adresse")}</h4>
      ${labelled(ctx.dt("العنوان", "Adresse"), input("settings.address.ar", s.address?.ar, { dir: "rtl", placeholder: ctx.dt("مثل: تفرغ زينة، شارع جمال عبد الناصر", "ex. Tevragh Zeina, av. Nasser") }))}
      <div class="si-row">
        ${labelled(ctx.dt("المدينة", "Ville"), input("settings.city.ar", s.city?.ar, { dir: "rtl" }))}
        ${labelled(ctx.dt("رابط خرائط Google (اختياري)", "Lien Google Maps (optionnel)"), input("settings.mapUrl", s.mapUrl, { type: "url", dir: "ltr", placeholder: "https://maps.app.goo.gl/…" }))}
      </div>
      <details class="pe-more"><summary>${ctx.dt("بالفرنسية", "En français")}</summary>
        <div class="pe-more-body si-row">
          ${labelled("Adresse", input("settings.address.fr", s.address?.fr, { dir: "ltr" }))}
          ${labelled("Ville", input("settings.city.fr", s.city?.fr, { dir: "ltr" }))}
        </div>
      </details>
    </section>`;
  }

  /** Step 4 — opening hours: tappable days, from/to, holiday switch. */
  function stepHours() {
    const hours = S().hours || {};
    const days = Array.isArray(hours.days) ? hours.days : [0, 1, 2, 3, 4, 5, 6];
    const chips = DAY_LABELS.map(
      (d, i) =>
        `<button type="button" class="si-day${days.includes(i) ? " on" : ""}" data-store-day="${i}" aria-pressed="${days.includes(i)}">${ctx.esc(ctx.dt(d.ar, d.fr))}</button>`
    ).join("");
    return `<section class="pe-step">
      <h4>${ctx.dt("أوقات العمل", "Horaires")}</h4>
      <div class="si-days">${chips}</div>
      <div class="si-row">
        ${labelled(ctx.dt("من", "De"), input("settings.hours.open", hours.open || "09:00", { type: "time", dir: "ltr" }))}
        ${labelled(ctx.dt("إلى", "À"), input("settings.hours.close", hours.close || "19:00", { type: "time", dir: "ltr" }))}
      </div>
      ${ctx.directToggle(ctx.dt("إغلاق مؤقت (إجازة) — يُعرض «مغلق» ويُوقف الطلبات", "Fermeture temporaire — affiche « fermé » et bloque les commandes"), "settings.hours.closed", hours.closed === true)}
    </section>`;
  }

  /** Human sentence for the hours, e.g. "الأحد–الخميس والسبت، 9:00–19:00". */
  function hoursSentence() {
    const hours = S().hours || {};
    const days = (Array.isArray(hours.days) ? hours.days : [0, 1, 2, 3, 4, 5, 6]).slice().sort((a, b) => a - b);
    if (hours.closed) return ctx.dt("مغلق مؤقتاً", "Fermé temporairement");
    if (!days.length) return ctx.dt("لا أيام عمل محددة", "Aucun jour ouvré");
    const names = days.map((i) => ctx.dt(DAY_LABELS[i].ar, DAY_LABELS[i].fr));
    const list = days.length === 7 ? ctx.dt("كل الأيام", "Tous les jours") : names.join("، ");
    return `${list}، ${hours.open || "09:00"}–${hours.close || "19:00"}`;
  }

  function storeInfoPreviewHTML() {
    const s = S();
    const open = typeof ctx.R.isStoreOpen === "function" ? ctx.R.isStoreOpen() : true;
    return `<div class="si-preview" data-store-preview>
      <strong>${ctx.dt("هكذا يظهر في أسفل المتجر:", "Aperçu du pied de page :")}</strong>
      <div>${ctx.icon("mapPin")} ${ctx.esc([ctx.lng(s.address), ctx.lng(s.city)].filter(Boolean).join("، ") || ctx.dt("— لا عنوان بعد", "— pas d’adresse"))}</div>
      <div>${ctx.icon("phone")} <span dir="ltr">${ctx.esc(s.phoneDisplay || s.whatsapp || "—")}</span></div>
      <div>${ctx.icon("clock")} ${ctx.esc(hoursSentence())} · <em class="${open ? "si-open" : "si-closed"}">${open ? ctx.dt("مفتوح الآن", "Ouvert") : ctx.dt("مغلق الآن", "Fermé")}</em></div>
    </div>`;
  }

  function viewStoreInfo() {
    return `
      <div class="dash-view-head">
        <div><h2>${ctx.dt("بيانات متجري", "Ma boutique")}</h2><p>${ctx.dt("كل ما يراه الزبون عنك في مكان واحد. يُحفظ تلقائياً؛ اضغط «نشر» ليظهر في المتجر.", "Tout ce que le client voit de vous, au même endroit. Sauvegardé automatiquement ; publiez pour l’afficher.")}</p></div>
      </div>
      <div class="pe si">
        ${stepIdentity()}
        ${stepChannels()}
        ${stepAddress()}
        ${stepHours()}
        ${storeInfoPreviewHTML()}
      </div>`;
  }

  /** Day chip tapped: flip membership in settings.hours.days, save, refresh chip + preview (no full re-render). */
  function toggleStoreDay(index) {
    const hours = (S().hours = S().hours || {});
    const days = new Set(Array.isArray(hours.days) ? hours.days : [0, 1, 2, 3, 4, 5, 6]);
    if (days.has(index)) days.delete(index);
    else days.add(index);
    hours.days = [...days].sort((a, b) => a - b);
    ctx.saveDraftNow();
    document.querySelectorAll("[data-store-day]").forEach((node) => {
      const el = /** @type {HTMLElement} */ (node);
      const on = days.has(Number(el.dataset.storeDay));
      el.classList.toggle("on", on);
      el.setAttribute("aria-pressed", String(on));
    });
    document.querySelector("[data-store-preview]")?.replaceWith(ctx.htmlToNode(storeInfoPreviewHTML()));
  }
}
