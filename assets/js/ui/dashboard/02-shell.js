// @ts-check
/* dashboard.js → Application shell
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

import { TEMPLATE_VERSION } from "../../version.js";

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { renderShell, renderRoute });
  /* 1.17 — eight everyday screens, everything else folded under "متقدم" (collapsed, remembered). */
  const NAV_GROUPS = [
    {
      label: { ar: "يومياً", fr: "Au quotidien" },
      items: [
        { id: "overview", icon: "overview", ar: "نظرة عامة", fr: "Vue d’ensemble" },
        { id: "orders", icon: "orders", ar: "الطلبات", fr: "Commandes", count: true },
        { id: "products", icon: "products", ar: "المنتجات", fr: "Produits" },
        { id: "categories", icon: "categories", ar: "الفئات", fr: "Catégories" },
        { id: "marketing", icon: "marketing", ar: "الكوبونات والعروض", fr: "Coupons & offres" }
      ]
    },
    {
      label: { ar: "متجري", fr: "Ma boutique" },
      items: [
        { id: "store-info", icon: "home", ar: "بيانات متجري", fr: "Ma boutique" },
        { id: "payments", icon: "payment", ar: "الدفع والتوصيل", fr: "Paiement & livraison" }
      ]
    },
    {
      label: { ar: "متقدم", fr: "Avancé" },
      advanced: true,
      items: [
        { id: "reviews", icon: "reviews", ar: "التقييمات", fr: "Avis" },
        { id: "homepage", icon: "home", ar: "الصفحة الرئيسية", fr: "Page d’accueil" },
        { id: "appearance", icon: "palette", ar: "الهوية والألوان", fr: "Identité & couleurs" },
        { id: "content", icon: "content", ar: "القائمة والتذييل", fr: "Menu & pied de page" },
        { id: "pages", icon: "pages", ar: "الصفحات", fr: "Pages" },
        { id: "team", icon: "team", ar: "الفريق", fr: "Équipe" },
        { id: "settings", icon: "settings", ar: "الإعدادات", fr: "Réglages" },
        { id: "audit", icon: "audit", ar: "سجل النشاط", fr: "Journal d’activité" }
      ]
    }
  ];
  const OWNER_ONLY_ROUTES = new Set(["team", "settings", "audit"]);
  const ROUTE_TITLES = {
    overview: {
      ar: "نظرة عامة",
      fr: "Vue d’ensemble",
      sub: { ar: "ملخص مباشر للمتجر", fr: "Résumé en direct de la boutique" }
    },
    orders: {
      ar: "الطلبات",
      fr: "Commandes",
      sub: { ar: "إدارة الطلبات والواتساب والفواتير", fr: "Commandes, WhatsApp et factures" }
    },
    products: { ar: "المنتجات", fr: "Produits", sub: { ar: "المخزون والأسعار والصور", fr: "Stock, prix et images" } },
    categories: {
      ar: "الفئات",
      fr: "Catégories",
      sub: { ar: "تنظيم مجموعات المتجر", fr: "Organisez les collections" }
    },
    reviews: {
      ar: "التقييمات",
      fr: "Avis clients",
      sub: { ar: "راجع واعتمد تقييمات العملاء", fr: "Modérez les avis clients" }
    },
    content: {
      ar: "القائمة والتذييل",
      fr: "Menu & pied de page",
      sub: { ar: "القائمة العلوية، شريط الثقة والتذييل", fr: "Menu, barre de confiance et pied de page" }
    },
    homepage: {
      ar: "الصفحة الرئيسية",
      fr: "Page d’accueil",
      sub: { ar: "الأقسام، السلايدر والترتيب", fr: "Sections, slider et ordre" }
    },
    appearance: {
      ar: "الهوية والألوان",
      fr: "Identité & couleurs",
      sub: { ar: "الشعار، الألوان والخطوط", fr: "Logo, couleurs et polices" }
    },
    marketing: {
      ar: "العروض والتسويق",
      fr: "Offres & marketing",
      sub: { ar: "بنكيلي، الكوبونات والبانرات", fr: "Bankily, coupons et bannières" }
    },
    pages: {
      ar: "الصفحات",
      fr: "Pages",
      sub: { ar: "الصفحات الثابتة والسياسات", fr: "Pages statiques et politiques" }
    },
    "store-info": {
      ar: "بيانات متجري",
      fr: "Ma boutique",
      sub: { ar: "الاسم، واتساب، العنوان، أوقات العمل", fr: "Nom, WhatsApp, adresse, horaires" }
    },
    payments: {
      ar: "الدفع والتوصيل",
      fr: "Paiement & livraison",
      sub: { ar: "بنكيلي، مصرفي، سداد، كليك والمدن", fr: "Bankily, Masrvi, Sedad, Click et villes" }
    },
    team: { ar: "الفريق", fr: "Équipe", sub: { ar: "المديرون وصلاحيات الدخول", fr: "Gérants et accès" } },
    settings: {
      ar: "الإعدادات",
      fr: "Réglages",
      sub: { ar: "SEO، واتساب، البكسل والحماية", fr: "SEO, WhatsApp, pixels et sécurité" }
    },
    audit: {
      ar: "سجل النشاط",
      fr: "Journal d’activité",
      sub: { ar: "كل التغييرات المسجلة", fr: "Toutes les modifications" }
    }
  };

  function shellDisplayName() {
    if (ctx.session?.role === "owner") return ctx.dt("مالك المتجر", "Propriétaire");
    return ctx.dt("مدير المتجر", "Gérant");
  }

  /** Avatar URL of the logged-in manager (empty when none is set). */
  function managerAvatar() {
    const managers = ctx.R.managers;
    const mgr =
      managers.find((item) => item.id === ctx.session?.id) ||
      managers.find((item) => item.username === ctx.session?.username);
    return mgr?.avatar?.trim() || "";
  }

  function navLinkHTML(item) {
    const active = ctx.route === item.id ? "active" : "";
    const count = ctx.newOrdersCount();
    const countBadge = item.count
      ? `<span class="count" data-nav-count="orders" ${count ? "" : "hidden"}>${count || ""}</span>`
      : "";
    return `<a href="#${item.id}" data-route="${item.id}" class="${active}">${ctx.icon(item.icon)}<span>${ctx.esc(item[ctx.dashLang] || item.ar)}</span>${countBadge}</a>`;
  }

  function navGroupHTML(group) {
    const isOwner = ctx.session?.role === "owner";
    const links = group.items
      .filter((item) => isOwner || !OWNER_ONLY_ROUTES.has(item.id))
      .map(navLinkHTML)
      .join("");
    const label = ctx.esc(group.label[ctx.dashLang] || group.label.ar);
    if (!group.advanced) return `<div class="dash-nav-label">${label}</div>${links}`;
    const open = localStorage.getItem("dash-advanced") === "1" || group.items.some((item) => item.id === ctx.route);
    return `<details class="dash-nav-adv" data-nav-advanced ${open ? "open" : ""}><summary class="dash-nav-label">${label} <small>${ctx.dt("نادراً ما تحتاجها", "Rarement utile")}</small></summary>${links}</details>`;
  }

  function sidebarBrandHTML() {
    const logo = ctx.esc(ctx.model.settings.logoWhite || "assets/img/brand-logo-white.svg");
    const storeName = ctx.esc(ctx.model.settings.storeName?.[ctx.dashLang] || "");
    return `<a class="brand" href="index.html"><img src="${logo}" alt="${storeName}"></a>`;
  }

  function sidebarUserHTML() {
    const displayName = shellDisplayName();
    const avatar = managerAvatar();
    const initials = String(displayName || "R")
      .slice(0, 2)
      .toUpperCase();
    const avatarHTML = avatar ? `<img src="${ctx.esc(avatar)}" alt="">` : ctx.esc(initials);
    const roleHTML = ctx.session?.role === "owner" ? ctx.dt("المالك", "Propriétaire") : ctx.dt("مدير", "Gérant");
    return `<div class="dash-user">
            <span class="dash-avatar" data-route="team" title="${ctx.dt("الفريق", "Équipe")}">${avatarHTML}</span>
            <div><strong>${ctx.esc(displayName)}</strong><small>${roleHTML}</small></div>
            <button type="button" data-action="logout" title="${ctx.dt("خروج", "Déconnexion")}">${ctx.icon("logout")}</button>
          </div>`;
  }

  function sidebarHTML() {
    const storeName = ctx.esc(ctx.lng(ctx.model.settings.storeName));
    return `<aside class="dash-sidebar" id="dash-sidebar">
          ${sidebarBrandHTML()}
          <div class="dash-workspace"><span class="dot"></span><div><strong>${storeName}</strong><small>MRU</small></div></div>
          <nav class="dash-nav">
            ${NAV_GROUPS.map(navGroupHTML).join("")}
          </nav>
          ${sidebarUserHTML()}
          <div class="dash-version" title="${ctx.dt("إصدار القالب", "Version du modèle")}">v${ctx.esc(TEMPLATE_VERSION)}</div>
        </aside>`;
  }

  function saveStateHTML() {
    const label = ctx.dirty
      ? ctx.dt("تغييرات غير منشورة", "Modifications non publiées")
      : ctx.dt("متجر محدث", "Boutique à jour");
    return `<span class="dash-save-state ${ctx.dirty ? "dirty" : "published"}"><i></i>${label}</span>`;
  }

  function langToggleHTML() {
    const next = ctx.dashLang === "ar" ? "fr" : "ar";
    return `<button class="dash-lang" type="button" data-dash-lang="${next}">${ctx.dashLang === "ar" ? "FR" : "AR"}</button>`;
  }

  function ordersAlertHTML() {
    const pending = Math.max(0, ctx.newOrdersCount() - ctx.orderBadgeSeen);
    return `<button class="dash-icon-btn" type="button" data-action="orders-alert" title="${ctx.dt("طلبات جديدة", "Nouvelles commandes")}">${ctx.icon("bell")}<span class="alert-dot" data-order-alert ${pending ? "" : "hidden"}>${pending || ""}</span></button>`;
  }

  function topbarHTML() {
    const titles = ROUTE_TITLES[ctx.route];
    const theme = ctx.R.theme === "dark" ? "sun" : "moon";
    return `<header class="dash-topbar">
            <button class="dash-menu-btn" type="button" data-action="toggle-sidebar">${ctx.icon("menu")}</button>
            <div class="dash-title"><h1 id="dash-title">${ctx.esc(titles?.[ctx.dashLang] || titles?.ar || "")}</h1><small id="dash-subtitle">${ctx.esc(titles?.sub?.[ctx.dashLang] || "")}</small></div>
            <label class="dash-search">${ctx.icon("search")}<input id="dash-search" placeholder="${ctx.dt("بحث في الطلبات والمنتجات...", "Rechercher commandes, produits...")}" value="${ctx.esc(ctx.searchTerm)}"></label>
            <div class="dash-top-actions">
              ${saveStateHTML()}
              ${langToggleHTML()}
              <button class="dash-icon-btn" type="button" data-action="theme" title="${ctx.dt("الوضع الليلي", "Mode sombre")}">${ctx.icon(theme)}</button>
              <a class="dash-icon-btn" href="index.html" target="_blank" rel="noopener" title="${ctx.dt("عرض المتجر", "Voir la boutique")}">${ctx.icon("external")}</a>
              ${ordersAlertHTML()}
              <div class="dash-publish">
                <button class="btn btn-soft" type="button" data-action="preview" title="${ctx.dt("معاينة", "Aperçu")}">${ctx.icon("preview")}<span>${ctx.dt("معاينة", "Aperçu")}</span></button>
                <button class="btn btn-primary" type="button" data-action="publish" title="${ctx.dt("نشر", "Publier")}">${ctx.icon("publish")}<span>${ctx.dt("نشر", "Publier")}</span></button>
              </div>
            </div>
          </header>`;
  }

  function renderShell() {
    ctx.app.innerHTML = `
      <div class="dash-shell">
        ${sidebarHTML()}
        <main class="dash-main">
          ${topbarHTML()}
          <div class="dash-view" id="dash-view"></div>
        </main>
      </div>`;
    renderRoute();
    ctx.updateCounts();
  }

  const VIEWS = {
    overview: "viewOverview",
    orders: "viewOrders",
    products: "viewProducts",
    categories: "viewCategories",
    reviews: "viewReviews",
    content: "viewContent",
    homepage: "viewHomepage",
    appearance: "viewAppearance",
    marketing: "viewMarketing",
    pages: "viewPages",
    payments: "viewPayments",
    "store-info": "viewStoreInfo",
    team: "viewTeam",
    settings: "viewSettings",
    audit: "viewAudit",
    profile: "viewProfile"
  };

  function routeTitle() {
    const titles = ROUTE_TITLES[ctx.route];
    return titles?.[ctx.dashLang] || titles?.ar || "";
  }

  function routeSubtitle() {
    return ROUTE_TITLES[ctx.route]?.sub?.[ctx.dashLang] || "";
  }

  /** Session/must-change/unknown-route guards. Returns false when the caller must stop. */
  function guardRoute() {
    if (!ctx.session) {
      ctx.renderLogin();
      return false;
    }
    if (ctx.session.mustChange) {
      ctx.renderPasswordChange();
      return false;
    }
    if (!ROUTE_TITLES[ctx.route]) ctx.route = "overview";
    if (OWNER_ONLY_ROUTES.has(ctx.route) && ctx.session.role !== "owner") {
      ctx.route = "overview";
      ctx.toast(ctx.dt("هذه الصفحة متاحة للمالك فقط", "Cette page est réservée au propriétaire"), "error");
    }
    return true;
  }

  function routeView() {
    const view = VIEWS[ctx.route] || "viewOverview";
    return ctx[view]();
  }

  function syncRouteChrome() {
    ctx.$$(".dash-nav a").forEach((link) => link.classList.toggle("active", link.dataset.route === ctx.route));
    const title = ctx.$("#dash-title");
    if (title) title.textContent = routeTitle();
    const subtitle = ctx.$("#dash-subtitle");
    if (subtitle) subtitle.textContent = routeSubtitle();
    const search = ctx.$("#dash-search");
    if (search && search.value !== ctx.searchTerm) search.value = ctx.searchTerm;
    ctx.updateDraftState();
    ctx.updateCounts();
  }

  /** A local (browser-only) account on a Supabase store cannot read orders, write the catalog or publish. */
  function localAccountWarningHTML() {
    if (!ctx.R.remote || ctx.session?.mode !== "local") return "";
    return `<div class="notice warn u-mb-12">${ctx.dt(
      "أنت داخل بحساب محلي (محفوظ في هذا المتصفح فقط). هذا الحساب لا يرى الطلبات ولا يحفظ المنتجات ولا ينشر. سجّل الخروج وادخل ببريد Supabase وكلمة مروره.",
      "Vous êtes connecté avec un compte local (ce navigateur seulement) : il ne voit pas les commandes, n’enregistre pas les produits et ne publie pas. Déconnectez-vous et entrez avec l’e-mail Supabase."
    )}</div>`;
  }

  /** Re-selects the tab the merchant was on before a re-render (1.13). */
  function restoreDashTab(view) {
    const wanted = ctx.dashTabs?.[ctx.route];
    if (!wanted) return;
    const tab = view.querySelector(`[data-dash-tab="${wanted}"]`);
    const tabs = tab?.parentElement;
    if (!tab || !tabs) return;
    tabs.querySelectorAll("[data-dash-tab]").forEach((item) => item.classList.toggle("active", item === tab));
    tabs.parentElement
      ?.querySelectorAll("[data-dash-panel]")
      .forEach((panel) => panel.classList.toggle("active", panel.dataset.dashPanel === wanted));
  }

  function renderRoute() {
    if (!guardRoute()) return;
    const view = ctx.$("#dash-view");
    if (!view) {
      renderShell();
      return;
    }
    view.innerHTML = localAccountWarningHTML() + routeView();
    restoreDashTab(view);
    syncRouteChrome();
    if (ctx.route === "orders")
      setTimeout(() => localStorage.setItem("restore_orders_seen_v1", String(ctx.newOrdersCount())), 800);
  }

  Object.assign(ctx, { NAV_GROUPS, OWNER_ONLY_ROUTES, ROUTE_TITLES });
}
