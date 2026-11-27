// @ts-check
/* state.js → Default content: demo products, buildState, hydrate, i18n helpers (texts live in 01-default-texts.js)
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */
import { t as tI18n, L as LI18n } from "../i18n/index.js";
import { applyChannelsToSettings } from "../domain/channels.js";
import { stampCatalogImages } from "../domain/category-images.js";
import { alignLegacySiteSettings, applySiteSettingsToState, mergeSiteSettings } from "../domain/site-settings.js";
import { createDefaultState } from "./01a-default-state.js";

export function install(ctx) {
  Object.assign(ctx, {
    hydrate,
    t,
    money,
    formatDate,
    setLang,
    setTheme
  });
  // Default state builders live in 01a-default-state.js; hydrate merges saved data over them.
  const STALE_NAME = /تجربة|تجريبي|المرابطون|Demo Store|Demo One/i;
  const FRESH_NAME = { ar: "المتجر", fr: "Boutique" };
  if (typeof window !== "undefined" && window.BRAND?.name) {
    const ar = String(window.BRAND.name.ar || "");
    const fr = String(window.BRAND.name.fr || "");
    if (!ar || STALE_NAME.test(ar)) window.BRAND.name.ar = FRESH_NAME.ar;
    if (!fr || STALE_NAME.test(fr)) window.BRAND.name.fr = FRESH_NAME.fr;
  }
  const defaultState = createDefaultState(ctx);

  function withoutTwelveMonthClaim(text) {
    return String(text ?? "")
      .replace(/\s*بضمان 12 شهرًا،?/g, "")
      .replace(/\s*مع ضمان 12 شهرًا،?/g, "،")
      .replace(/ضمان 12 شهرًا،?\s*/g, "")
      .replace(/الضمان 12 شهرًا/g, "الضمان")
      .replace(/,\s*garantis 12 mois\s*/gi, " ")
      .replace(/\s*avec 12 mois de garantie,?\s*/gi, " ")
      .replace(/\s*avec une garantie de 12 mois,?\s*/gi, " ")
      .replace(/\s*12 mois de garantie,?\s*/gi, " ")
      .replace(/garantie de 12 mois/gi, "garantie")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+,/g, ",")
      .replace(/،{2,}/g, "،")
      .trim();
  }

  function scrubI18nName(value) {
    const ar = String(value?.ar || "").trim();
    const fr = String(value?.fr || "").trim();
    return {
      ar: !ar || STALE_NAME.test(ar) ? FRESH_NAME.ar : value.ar,
      fr: !fr || STALE_NAME.test(fr) ? FRESH_NAME.fr : value.fr
    };
  }

  function withoutRenewedWord(text) {
    return String(text ?? "")
      .replace(/الإلكترونيات المجددة/g, "الإلكترونيات")
      .replace(/تقنية مجددة/g, "تقنية موثوقة")
      .replace(/المجددة/g, "")
      .replace(/مجددة/g, "")
      .replace(/\s+،/g, "،")
      .replace(/،{2,}/g, "،")
      .replace(/\s{2,}/g, " ")
      .trim()
      .replace(/^،|،$/g, "");
  }

  function scrubLocaleField(value) {
    if (!value) return value;
    if (typeof value === "string") return withoutRenewedWord(withoutTwelveMonthClaim(value));
    return {
      ar: withoutRenewedWord(withoutTwelveMonthClaim(value.ar)),
      fr: withoutTwelveMonthClaim(value.fr)
    };
  }

  function scrubRenewedTree(value) {
    if (typeof value === "string") return withoutRenewedWord(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) value[i] = scrubRenewedTree(value[i]);
      return value;
    }
    if (value && typeof value === "object") {
      for (const key of Object.keys(value)) value[key] = scrubRenewedTree(value[key]);
    }
    return value;
  }

  function stripDemoPrefix(value) {
    return String(value || "")
      .replace(/^Demo\s+/i, "")
      .trim();
  }

  function scrubProductVendors(state) {
    for (const product of state.products || []) {
      if (product.vendor) product.vendor = stripDemoPrefix(product.vendor);
      if (product.brand) product.brand = stripDemoPrefix(product.brand);
    }
  }

  function scrubMarketingCopy(settings) {
    for (const slide of settings.heroSlides || []) {
      if (slide.subtitle) slide.subtitle = scrubLocaleField(slide.subtitle);
    }
    if (settings.seo?.description) settings.seo.description = scrubLocaleField(settings.seo.description);
    for (const item of settings.trustBar || []) {
      if (item.icon === "shield" && item.label) item.label = scrubLocaleField(item.label);
    }
  }

  const SHORT_NAV = [
    {
      id: "anniversary",
      label: { ar: "عروض", fr: "Offres" },
      href: "collection.html?handle=special-offers",
      flame: true,
      visible: true
    },
    {
      id: "iphones",
      label: { ar: "هواتف", fr: "Téléphones" },
      href: "collection.html?handle=phones",
      visible: true
    },
    {
      id: "laptops",
      label: { ar: "حواسيب", fr: "Ordinateurs" },
      href: "collection.html?handle=laptops",
      visible: true
    },
    {
      id: "accessories",
      label: { ar: "ملحقات", fr: "Accessoires" },
      href: "collection.html?handle=accessories",
      visible: true
    },
    { id: "help", label: { ar: "تواصل", fr: "Contact" }, href: "page.html?slug=contact", visible: true }
  ];

  function compactNavigation(settings) {
    settings.navigation = SHORT_NAV.map((item) => ({ ...item }));
  }

  function scrubLogo(settings) {
    const logo = String(settings.logo || "");
    const staleBrand =
      STALE_NAME.test(String(settings.storeName?.ar || "")) || STALE_NAME.test(String(settings.storeName?.fr || ""));
    if (
      staleBrand ||
      !logo ||
      /\.(png|jpe?g|webp)$/i.test(logo) ||
      /hero|phones|cats\//i.test(logo) ||
      /brand-logo/i.test(logo)
    ) {
      settings.logo = "assets/img/brand-logo.svg";
      settings.logoWhite = "assets/img/brand-logo-white.svg";
    }
  }

  function scrubStorefrontCopy(state) {
    const settings = state.settings || {};
    settings.storeName = scrubI18nName(settings.storeName);
    settings.legalName = scrubI18nName(settings.legalName);
    compactNavigation(settings);
    scrubLogo(settings);
    scrubProductVendors(state);
    scrubMarketingCopy(settings);
    scrubRenewedTree(settings);
    if (state.pages) scrubRenewedTree(state.pages);
  }

  function hydrate(saved) {
    const base = defaultState.buildState();
    if (!saved) {
      scrubStorefrontCopy(base);
      return base;
    }
    const out = ctx.merge(base, saved);
    const baseProducts = new Map(base.products.map((p) => [p.handle, p]));
    out.products = (saved.products || base.products).map((p) => ctx.merge(baseProducts.get(p.handle) || {}, p));
    out.collections = (saved.collections || base.collections).map((c) => {
      const merged = ctx.merge(base.collections.find((x) => x.handle === c.handle) || {}, c);
      if (typeof merged.title === "string") merged.title = defaultState.collectionTitle(merged);
      return merged;
    });
    out.pages = (saved.pages || base.pages).map((p) => ctx.merge(base.pages.find((x) => x.slug === p.slug) || {}, p));
    out.blog = (saved.blog || base.blog).map((b) => ctx.merge(base.blog.find((x) => x.slug === b.slug) || {}, b));
    out.settings.homeSections = (saved.settings?.homeSections || base.settings.homeSections).map((s) =>
      ctx.merge(base.settings.homeSections.find((x) => x.id === s.id) || {}, s)
    );
    out.settings.navigation = (saved.settings?.navigation || base.settings.navigation).map((n) =>
      ctx.merge(base.settings.navigation.find((x) => x.id === n.id) || {}, n)
    );
    out.settings.pageSections = (saved.settings?.pageSections || base.settings.pageSections).map((s) =>
      ctx.merge(base.settings.pageSections.find((x) => x.id === s.id) || {}, s)
    );
    out.products.forEach((p) => {
      if (!p.specs) p.specs = defaultState.specsFor(p, p.battery || 92);
      if (!p.includes) p.includes = defaultState.includesFor(p);
      if (!p.description) p.description = p.description || "";
      if (!p.colorImages) p.colorImages = {};
      if (!p.colorRemote) p.colorRemote = {};
    });
    // WhatsApp links need digits only (wa.me rejects "+", spaces and dashes); an 8-digit local number gets +222.
    if (typeof out.settings.whatsapp === "string") {
      let wa = out.settings.whatsapp.replace(/\D+/g, "");
      if (wa.length === 8) wa = `222${wa}`;
      out.settings.whatsapp = wa;
    }
    return finishHydrate(out, saved);
  }

  function keepSavedMarketing(out, saved) {
    const src = saved?.settings;
    if (!src) return;
    if (src.announcement) out.settings.announcement = src.announcement;
    if (Array.isArray(src.offers)) out.settings.offers = src.offers;
    if (Array.isArray(src.coupons)) out.settings.coupons = src.coupons;
  }

  function finishHydrate(out, saved) {
    keepSavedMarketing(out, saved);
    out.settings.siteSettings = mergeSiteSettings(out.settings.siteSettings, out.settings);
    alignLegacySiteSettings(out.settings);
    applySiteSettingsToState(out.settings, ctx.lang);
    applyChannelsToSettings(out.settings, window.BRAND || {});
    scrubStorefrontCopy(out);
    stampCatalogImages(out);
    return out;
  }
  // I18N moved to ./i18n/ar.js, ./i18n/fr.js (single source of truth)

  const LANG_KEY = "lang";
  ctx.lang = localStorage.getItem(ctx.LS_LANG) === "fr" ? "fr" : "ar";
  ctx.theme = localStorage.getItem(ctx.LS_THEME) === "dark" ? "dark" : "light";

  function t(key, vars = {}) {
    return tI18n(ctx.lang, key, vars);
  }
  const L = (value) => LI18n(ctx.lang, value);
  function money(n) {
    return ctx.formatCurrency(n);
  }
  /** @param {string | number | Date} value @param {Intl.DateTimeFormatOptions} [opts] */
  function formatDate(value, opts = { year: "numeric", month: "short", day: "numeric" }) {
    try {
      return new Intl.DateTimeFormat(ctx.lang === "ar" ? "ar-MR" : "fr-MR", opts).format(new Date(value));
    } catch {
      return String(value || "");
    }
  }

  function setLang(next) {
    ctx.lang = next === "fr" ? "fr" : "ar";
    localStorage.setItem(ctx.LS_LANG, ctx.lang);
    ctx.applyDocument();
    window.dispatchEvent(new CustomEvent("restore:lang", { detail: ctx.lang }));
  }
  function setTheme(next) {
    ctx.theme = next === "dark" ? "dark" : "light";
    localStorage.setItem(ctx.LS_THEME, ctx.theme);
    ctx.applyDocument();
  }
  Object.assign(ctx, { LANG_KEY, L });
}
