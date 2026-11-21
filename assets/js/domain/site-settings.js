// @ts-check
/* Dashboard-controlled storefront copy: one row per key (value + is_visible).
   Lives in settings.siteSettings and, when migrated, in public.site_settings. */

/** @typedef {{ ar: string, fr: string }} I18n */

export const SITE_SETTINGS_TABLE = "site_settings";

/** @type {Array<{ key: string, kind: "number" | "i18n", defaultValue: any, defaultVisible: boolean, ar: string, fr: string, hintAr?: string, hintFr?: string }>} */
export const SITE_SETTING_DEFS = [
  {
    key: "return_days",
    kind: "number",
    defaultValue: 10,
    defaultVisible: true,
    ar: "مدة الإرجاع (أيام)",
    fr: "Délai de retour (jours)",
    hintAr: "الافتراضي 10. كل موضع يذكر الإرجاع يقرأ هذه القيمة.",
    hintFr: "Défaut 10. Tous les textes de retour lisent cette valeur."
  },
  {
    key: "no_risk",
    kind: "i18n",
    defaultValue: { ar: "بدون مخاطرة", fr: "Sans risque" },
    defaultVisible: true,
    ar: "شارة بدون مخاطرة",
    fr: "Badge « Sans risque »"
  },
  {
    key: "no_risk_text",
    kind: "i18n",
    defaultValue: {
      ar: "{returnDays} أيام لإرجاع الجهاز عند وجود أي مشكلة",
      fr: "{returnDays} jours pour retourner l’appareil en cas de problème"
    },
    defaultVisible: true,
    ar: "وصف بدون مخاطرة",
    fr: "Texte sous « Sans risque »"
  },
  {
    key: "refurbished_label",
    kind: "i18n",
    defaultValue: { ar: "مجدد", fr: "reconditionné" },
    defaultVisible: true,
    ar: "كلمة «مجدد»",
    fr: "Mot « reconditionné »",
    hintAr: "تظهر في شريط «ما معنى مجدد» وصفحات السياسة.",
    hintFr: "Affiché dans le bandeau « que signifie reconditionné »."
  },
  {
    key: "offers_label",
    kind: "i18n",
    defaultValue: { ar: "عروض", fr: "Offres" },
    defaultVisible: true,
    ar: "عنوان العروض (بدل Anniversary)",
    fr: "Titre des offres (ex-Anniversary)",
    hintAr: "الرابط القديم restore-anniversary يبقى ويعرض هذه التسمية.",
    hintFr: "L’ancien slug restore-anniversary affiche ce libellé."
  },
  {
    key: "trusted_by",
    kind: "i18n",
    defaultValue: { ar: "آلاف العملاء يثقون بنا", fr: "Des milliers de clients nous font confiance" },
    defaultVisible: false,
    ar: "عنوان ثقة العملاء",
    fr: "Titre « clients nous font confiance »",
    hintAr: "مخفي افتراضياً. لا تضع رقماً إن لم ترد إظهار عدد.",
    hintFr: "Masqué par défaut. N’indiquez un chiffre que si vous le souhaitez."
  },
  {
    key: "announcement",
    kind: "i18n",
    defaultValue: {
      ar: "توصيل مجاني داخل نواكشوط • الدفع عند الاستلام أو عبر بنكيلي",
      fr: "Livraison gratuite à Nouakchott • Paiement à la livraison ou Bankily"
    },
    defaultVisible: true,
    ar: "شريط الإعلان العلوي",
    fr: "Barre d’annonce"
  },
  {
    key: "categories_title",
    kind: "i18n",
    defaultValue: { ar: "تسوق الإلكترونيات المجددة", fr: "Électronique reconditionnée" },
    defaultVisible: true,
    ar: "عنوان شريط الفئات",
    fr: "Titre du ruban catégories"
  },
  {
    key: "service_title",
    kind: "i18n",
    defaultValue: {
      ar: "كل أجهزتنا أصلية ومفحوصة من طرف خبراء",
      fr: "Tous nos appareils sont originaux et vérifiés par des experts"
    },
    defaultVisible: true,
    ar: "عنوان قسم الخدمات",
    fr: "Titre de la section services"
  },
  {
    key: "warranty_label",
    kind: "i18n",
    defaultValue: { ar: "ضمان 12 شهرًا", fr: "Garantie 12 mois" },
    defaultVisible: true,
    ar: "شارة الضمان",
    fr: "Badge garantie"
  },
  {
    key: "free_delivery",
    kind: "i18n",
    defaultValue: { ar: "توصيل مجاني داخل نواكشوط", fr: "Livraison gratuite à Nouakchott" },
    defaultVisible: true,
    ar: "شارة التوصيل المجاني",
    fr: "Badge livraison gratuite"
  },
  {
    key: "checked_experts",
    kind: "i18n",
    defaultValue: { ar: "فحص بواسطة خبراء", fr: "Vérifié par des experts" },
    defaultVisible: true,
    ar: "شارة الفحص",
    fr: "Badge contrôle"
  }
];

const DEF_BY_KEY = Object.fromEntries(SITE_SETTING_DEFS.map((row) => [row.key, row]));

export function defaultSiteSettings() {
  /** @type {Record<string, { value: any, is_visible: boolean }>} */
  const out = {};
  for (const def of SITE_SETTING_DEFS) {
    out[def.key] = {
      value: typeof def.defaultValue === "object" ? { ...def.defaultValue } : def.defaultValue,
      is_visible: def.defaultVisible
    };
  }
  return out;
}

function cloneValue(value) {
  if (value && typeof value === "object") return { ...value };
  return value;
}

/** Seed defaults from the older settings.returnDays / noRisk / announcement fields. */
function applyLegacy(out, legacy) {
  if (!legacy || typeof legacy !== "object") return;
  if (legacy.returnDays != null) out.return_days.value = Number(legacy.returnDays);
  if (legacy.returnEnabled === false) out.return_days.is_visible = false;
  if (legacy.noRisk) {
    if (legacy.noRisk.title) out.no_risk.value = { ...out.no_risk.value, ...legacy.noRisk.title };
    if (legacy.noRisk.text) out.no_risk_text.value = { ...out.no_risk_text.value, ...legacy.noRisk.text };
    if (legacy.noRisk.visible === false) out.no_risk.is_visible = false;
  }
  if (legacy.announcement) out.announcement.value = legacy.announcement;
  if (legacy.categoriesTitle) out.categories_title.value = legacy.categoriesTitle;
  if (legacy.serviceTitle) out.service_title.value = legacy.serviceTitle;
  if (legacy.trustTitle) out.trusted_by.value = legacy.trustTitle;
}

/** Merge saved rows over defaults. Unknown keys are kept. */
export function mergeSiteSettings(saved, legacy) {
  const out = defaultSiteSettings();
  applyLegacy(out, legacy);
  if (!saved || typeof saved !== "object") return out;
  for (const [key, row] of Object.entries(saved)) {
    if (!row || typeof row !== "object") continue;
    const def = DEF_BY_KEY[key];
    const prev = out[key] || { value: row.value, is_visible: true };
    out[key] = {
      value: row.value != null ? cloneValue(row.value) : prev.value,
      is_visible: row.is_visible !== false && row.visible !== false
    };
    if (def?.kind === "number") out[key].value = Number(out[key].value);
  }
  return out;
}

export function siteRow(settings, key) {
  const def = DEF_BY_KEY[key];
  const row = settings?.siteSettings?.[key];
  if (row && typeof row === "object") return row;
  if (!def) return { value: "", is_visible: true };
  return { value: def.defaultValue, is_visible: def.defaultVisible };
}

export function siteSettingVisible(settings, key) {
  return siteRow(settings, key).is_visible !== false;
}

/** Localised string (or number as string) when visible, else "". */
export function siteText(settings, key, lang) {
  if (!siteSettingVisible(settings, key)) return "";
  const value = siteRow(settings, key).value;
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  const code = lang === "fr" ? "fr" : "ar";
  return String(value[code] || value.ar || value.fr || "");
}

export function siteNumber(settings, key, fallback = 0) {
  const n = Number(siteRow(settings, key).value);
  return Number.isFinite(n) ? n : fallback;
}

function copyVisibleI18n(settings, ss, key, field) {
  const row = ss[key];
  if (row?.is_visible !== false && row?.value) settings[field] = row.value;
}

function copyRenewal(settings, ss, lang) {
  const word = siteText(settings, "refurbished_label", lang);
  if (!word) return;
  const brand = settings.storeName || { ar: "", fr: "" };
  const arWord = ss.refurbished_label.value?.ar || word;
  const frWord = ss.refurbished_label.value?.fr || word;
  settings.renewalText = {
    ar: `ما معنى ${arWord} من ${brand.ar || ""}؟`,
    fr: `Que signifie ${frWord} chez ${brand.fr || ""} ?`
  };
}

function copyOffersTitle(settings, ss) {
  const offers = ss.offers_label?.value;
  if (!offers || ss.offers_label?.is_visible === false) return;
  const anniversary = (settings.homeSections || []).find(
    (section) => section.id === "anniversary" || section.collection === "special-offers"
  );
  if (anniversary) anniversary.title = offers;
}

/** Copy siteSettings onto the legacy fields the rest of the app already reads. */
export function applySiteSettingsToState(settings, lang) {
  if (!settings) return settings;
  settings.siteSettings = mergeSiteSettings(settings.siteSettings);
  const ss = settings.siteSettings;
  const days = Number(ss.return_days?.value);
  if (Number.isFinite(days) && days > 0) settings.returnDays = Math.min(90, Math.round(days));
  settings.returnEnabled = ss.return_days?.is_visible !== false;
  settings.noRisk = {
    visible: ss.no_risk?.is_visible !== false,
    title: ss.no_risk?.value || { ar: "بدون مخاطرة", fr: "Sans risque" },
    text: ss.no_risk_text?.value || settings.noRisk?.text || { ar: "", fr: "" }
  };
  copyVisibleI18n(settings, ss, "announcement", "announcement");
  copyVisibleI18n(settings, ss, "categories_title", "categoriesTitle");
  copyVisibleI18n(settings, ss, "service_title", "serviceTitle");
  if (ss.trusted_by?.value) settings.trustTitle = ss.trusted_by.value;
  copyRenewal(settings, ss, lang);
  copyOffersTitle(settings, ss);
  return settings;
}

export function siteSettingsToRows(settings) {
  const ss = mergeSiteSettings(settings?.siteSettings);
  return Object.entries(ss).map(([key, row]) => ({
    key,
    value: row.value,
    is_visible: row.is_visible !== false
  }));
}

export function rowsToSiteSettings(rows) {
  /** @type {Record<string, { value: any, is_visible: boolean }>} */
  const saved = {};
  for (const row of rows || []) {
    if (!row?.key) continue;
    saved[row.key] = { value: row.value, is_visible: row.is_visible !== false };
  }
  return mergeSiteSettings(saved);
}
