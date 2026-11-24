// @ts-check
/* app.js → Header & footer
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */

import { collectionHandleFromHref, isCollectionVisible } from "../../domain/collection-aliases.js";
import { visibleChannel, whatsappDigits } from "../../domain/channels.js";
import { paymentIcon } from "../../domain/payments.js";
import { siteSettingVisible, siteText } from "../../domain/site-settings.js";
import { trustItemText } from "../../domain/store-policies.js";

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { renderHeader, renderCustomerAccount, renderFooter, navItems });

  function navItems() {
    return (ctx.SET.navigation || []).filter((item) => {
      if (item.visible === false) return false;
      const handle = collectionHandleFromHref(item.href);
      if (!handle || handle === "all") return true;
      return isCollectionVisible(ctx.S.collections, handle);
    });
  }

  const currencyLabel = () => {
    const lang = ctx.R.lang;
    const ar = lang === "ar";
    if (ctx.R.getCurrencyMode() === "old") return ar ? "قديمة" : "Ancienne";
    return ar ? "جديدة" : "Nouvelle";
  };

  function otherLang(lang) {
    return lang === "ar" ? "fr" : "ar";
  }

  function otherLangLabel(lang) {
    return otherLang(lang) === "fr" ? "Français" : "العربية";
  }

  function flagFor(lang) {
    return lang === "fr" ? "assets/img/flag-fr.svg" : "assets/img/flag-mr.svg";
  }

  function themeButtonLabel() {
    return ctx.R.theme === "dark" ? ctx.t("light") : ctx.t("dark");
  }

  function themeButtonIcon() {
    return ctx.R.theme === "dark" ? ctx.ICON.sun : ctx.ICON.moon;
  }

  function navLabel(item) {
    const handle = collectionHandleFromHref(item.href);
    if (handle === "special-offers" || item.id === "anniversary") {
      return siteText(ctx.SET, "offers_label", ctx.R.lang) || ctx.L(item.label);
    }
    return ctx.L(item.label);
  }

  function navItemHTML(n) {
    const flame = n.flame ? '<span class="flame" data-icon="flame" aria-hidden="true"></span>' : "";
    const sub = n.sub?.length
      ? `<div class="nav-drop">${n.sub.map((s) => `<a href="${ctx.esc(ctx.R.safeHref(s.href))}">${ctx.esc(ctx.L(s.label))}</a>`).join("")}</div>`
      : "";
    return `
            <div class="nav-item">
              <a href="${ctx.esc(ctx.R.safeHref(n.href))}">${ctx.esc(navLabel(n))}${flame}</a>
              ${sub}
            </div>`;
  }

  function renderHeader() {
    const el = document.getElementById("site-header");
    if (!el) return;
    const lang = ctx.R.lang;
    const otherLabel = otherLangLabel(lang);
    const currentFlag = flagFor(lang);
    const closed = !ctx.R.isStoreOpen();
    const announceText = siteText(ctx.SET, "announcement", ctx.R.lang) || ctx.L(ctx.SET.announcement);
    el.className = "site-header";
    el.innerHTML = `
      ${
        closed
          ? `<div class="announcement is-closed"><span>${ctx.esc(ctx.t("storeClosed"))}</span></div>`
          : siteSettingVisible(ctx.SET, "announcement") && announceText
            ? `<div class="announcement" aria-label="${ctx.esc(announceText)}"><span>${ctx.esc(announceText)}</span></div>`
            : ""
      }
      <div class="container header-top">
        <a class="logo" href="index.html" aria-label="${ctx.esc(ctx.L(ctx.SET.storeName))}"><img src="${ctx.esc(ctx.R.theme === "dark" ? ctx.SET.logoWhite || ctx.SET.logo : ctx.SET.logo)}" alt="${ctx.esc(ctx.L(ctx.SET.storeName))}" width="190" height="80" decoding="async"></a>
        <form class="search" id="header-search" role="search" autocomplete="off">
          <input type="search" placeholder="${ctx.esc(ctx.t("searchPlaceholder"))}" aria-label="${ctx.esc(ctx.t("search"))}">
          <button class="search-btn" type="submit" aria-label="${ctx.esc(ctx.t("search"))}">${ctx.ICON.search}</button>
        </form>
        <div class="header-actions">
          <div class="customer-account" id="customer-account"></div>
          <button class="lang-current" type="button" data-set-lang="${lang === "ar" ? "fr" : "ar"}" aria-label="${ctx.esc(ctx.t("language"))}" title="${lang === "ar" ? "Français" : "العربية"}">
            <img src="${currentFlag}" alt="" width="20" height="14"><span>${lang === "ar" ? "AR" : "FR"}</span>
          </button><button class="icon-btn theme-btn" type="button" data-theme-toggle aria-label="${ctx.esc(themeButtonLabel())}">${themeButtonIcon()}</button>
          <a class="icon-btn" href="account.html" aria-label="${ctx.esc(ctx.t("account"))}">${ctx.ICON.user}</a>
          <a class="icon-btn" href="wishlist.html" aria-label="${ctx.esc(ctx.t("wishlist"))}">${ctx.ICON.heart}<span class="cart-count wish-count" hidden>0</span></a>
          <button class="icon-btn" type="button" data-open-cart aria-label="${ctx.esc(ctx.t("cart"))}">${ctx.ICON.bag}<span class="cart-count cart-count-n" hidden>0</span></button>
        </div>
      </div>
      <nav class="main-nav" aria-label="Main">
        <div class="container nav-inner">
          ${navItems().map(navItemHTML).join("")}
        </div>
        <button class="nav-scroll" type="button" aria-label="${ctx.esc(ctx.t("seeAll"))}"><span data-icon="chevronRight" aria-hidden="true"></span></button>
      </nav>`;
    wireHeader(el, otherLabel);
    ctx.hydrateIcons(el);
  }

  function wireHeader(el, otherLabel) {
    const form = el.querySelector("#header-search");
    const input = form.querySelector("input");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      ctx.openSearch(input.value);
    });
    input.addEventListener("focus", () => {
      input.blur();
      ctx.openSearch(input.value);
    });
    el.querySelectorAll("[data-open-cart]").forEach((b) => b.addEventListener("click", ctx.openCart));
    el.querySelector(".nav-scroll")?.addEventListener("click", () => {
      el.querySelector(".nav-inner")?.scrollBy({ left: (ctx.R.lang === "ar" ? -1 : 1) * 260, behavior: "smooth" });
    });
    el.querySelector("[data-currency-toggle]")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      el.querySelector(".currency-switch")?.classList.toggle("open");
    });
    el.querySelectorAll("[data-set-currency]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ctx.R.setCurrencyMode(btn.dataset.setCurrency);
        el.querySelector(".currency-switch")?.classList.remove("open");
      });
    });
    // Currency label update
    window.addEventListener("restore:currencyMode", () => {
      const label = el.querySelector(".currency-label");
      if (label) label.textContent = currencyLabel();
    });
    // Account dropdown
    el.querySelector("[data-account-toggle]")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      el.querySelector(".account-dropdown")?.classList.toggle("open");
    });
    el.querySelector("[data-customer-logout]")?.addEventListener("click", () => {
      ctx.R.customerLogout();
      location.reload();
    });
    // Close dropdowns on outside click
    document.addEventListener("click", () => {
      el.querySelector(".lang-switch")?.classList.remove("open");
      el.querySelector(".currency-switch")?.classList.remove("open");
      el.querySelector(".account-dropdown")?.classList.remove("open");
    });
    el.querySelector(".lang-current span")?.setAttribute("title", otherLabel);
  }

  function renderCustomerAccount() {
    const root = document.getElementById("customer-account");
    if (!root) return;
    const cust = ctx.R.getCustomer();
    root.closest(".header-actions")?.classList.toggle("is-customer", Boolean(cust));
    if (cust) {
      const initial = String(cust.name || "U")
        .trim()
        .slice(0, 1)
        .toUpperCase();
      root.innerHTML = `
        <div class="account-dropdown">
          <button class="account-btn" type="button" data-account-toggle aria-label="${ctx.esc(ctx.t("account"))}">
            <span class="account-avatar">${ctx.esc(initial)}</span>
            <span class="account-name">${ctx.esc(cust.name)}</span>
            ${ctx.ICON.chevronDown}
          </button>
          <div class="account-menu">
            <a href="account.html">${ctx.ICON.user} ${ctx.esc(ctx.t("myAccount"))}</a>
            <a href="wishlist.html">${ctx.ICON.heart} ${ctx.esc(ctx.t("wishlist"))}</a>
            <button type="button" data-customer-logout>${ctx.ICON.logout} ${ctx.esc(ctx.t("logout"))}</button>
          </div>
        </div>`;
    } else {
      root.innerHTML = `<a class="btn btn-outline btn-sm account-login-link" href="account.html">${ctx.ICON.user} ${ctx.esc(ctx.t("login"))}</a>`;
    }
  }

  const DAY_NAMES = {
    ar: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
    fr: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."]
  };
  /** Opening hours sentence from settings.hours (1.15: edited in "My store"); falls back to the old i18n text. */
  function hoursText() {
    const hours = ctx.SET.hours;
    if (!hours || !Array.isArray(hours.days) || !hours.open) return ctx.t("workingHours");
    const lang = ctx.R.lang === "fr" ? "fr" : "ar";
    if (hours.closed) return lang === "ar" ? "مغلق مؤقتاً" : "Fermé temporairement";
    const days = hours.days.slice().sort((a, b) => a - b);
    const list =
      days.length === 7
        ? lang === "ar"
          ? "كل الأيام"
          : "Tous les jours"
        : days.map((i) => DAY_NAMES[lang][i]).join(lang === "ar" ? "، " : ", ");
    return `${list}، ${hours.open}–${hours.close || ""}`.replace(/،\s*$/, "");
  }

  function renderFooter() {
    const el = document.getElementById("site-footer");
    if (!el) return;
    const year = new Date().getFullYear();
    const trust = `
      <div class="trust-bar">
        <div class="container trust-inner">
          <ul class="trust-list">
            ${(ctx.SET.trustBar || [])
              .map((item) => {
                const label = trustItemText(ctx.SET, item, ctx.R.lang, ctx.L(item.label));
                if (!label) return "";
                return `<li><span class="trust-ico" data-icon="${ctx.esc(item.icon)}"></span>${ctx.esc(label)}</li>`;
              })
              .join("")}
          </ul>
          ${ctx.hasPaymentOffer() ? `<div class="footer-promo">${ctx.ICON.bolt}<span>${ctx.esc(ctx.L(ctx.SET.paymentOffer))}</span></div>` : ""}
        </div>
      </div>`;
    el.innerHTML =
      trust +
      `
      <footer class="footer">
        <div class="container footer-main">
          <div>
            <a class="logo" href="index.html" aria-label="${ctx.esc(ctx.L(ctx.SET.storeName))}"><img src="${ctx.SET.logoWhite}" alt="${ctx.esc(ctx.L(ctx.SET.storeName))}" width="190" height="80" decoding="async"></a>
            <div class="footer-contact">
              <h4>${ctx.esc(ctx.t("contactUs"))}</h4>
              ${
                visibleChannel(ctx.SET, "address")
                  ? `<div class="row"><span>${ctx.ICON.mapPin} ${ctx.SET.mapUrl ? `<a href="${ctx.esc(ctx.SET.mapUrl)}" target="_blank" rel="noopener">${ctx.esc(ctx.L(ctx.SET.address))}</a>` : ctx.esc(ctx.L(ctx.SET.address))}</span></div>`
                  : ""
              }
              ${
                whatsappDigits(ctx.SET)
                  ? `<div class="row"><span>${ctx.ICON.whatsapp} <a href="https://wa.me/${ctx.esc(whatsappDigits(ctx.SET))}" target="_blank" rel="noopener" dir="ltr">${ctx.esc(ctx.SET.phoneDisplay || whatsappDigits(ctx.SET))}</a></span><span>${ctx.esc(ctx.t("replyWithin"))}</span></div>`
                  : ""
              }
              ${
                visibleChannel(ctx.SET, "phone")
                  ? `<div class="row"><span>${ctx.ICON.phone} <a href="tel:${ctx.esc(String(visibleChannel(ctx.SET, "phone").value).replace(/\s+/g, ""))}" dir="ltr">${ctx.esc(visibleChannel(ctx.SET, "phone").value)}</a></span></div>`
                  : ""
              }
              ${
                visibleChannel(ctx.SET, "email")
                  ? `<div class="row"><span>${ctx.ICON.mail} <a href="mailto:${ctx.esc(ctx.SET.email)}">${ctx.esc(ctx.SET.email)}</a></span></div>`
                  : ""
              }
              <div class="row"><span>${ctx.ICON.clock} ${ctx.esc(hoursText())}</span></div>
            </div>
            <div class="footer-pay" aria-label="${ctx.esc(ctx.t("paymentMethods"))}">
              ${(ctx.SET.payments || [])
                .filter((p) => p.active)
                .map((p) => {
                  const icon = paymentIcon(p);
                  const name = ctx.esc(ctx.L(p.name));
                  return icon
                    ? `<span class="pay-badge pay-image" title="${name}"><img src="${ctx.esc(icon)}" alt="${name}" width="40" height="40" loading="lazy"></span>`
                    : `<span class="pay-badge pay-text">${name}</span>`;
                })
                .join("")}
            </div>
          </div>
          ${(ctx.SET.footerColumns || [])
            .map(
              (col) => `
            <div>
              <h4>${ctx.esc(ctx.L(col.title))}</h4>
              <ul class="footer-links">
                ${col.links.map((l) => `<li><a href="${ctx.esc(ctx.R.safeHref(l.href))}">${ctx.esc(ctx.L(l.label))}</a></li>`).join("")}
              </ul>
            </div>`
            )
            .join("")}
        </div>
        <div class="container footer-bottom">
          <p>${ctx.esc(ctx.t("allRights", { year, store: ctx.L(ctx.SET.storeName) }))} · ${ctx.esc(ctx.L(ctx.SET.city))}, ${ctx.esc(ctx.L(ctx.SET.country.name))}</p>
          <div class="footer-bottom-links">
            <a href="dashboard.html">${ctx.R.lang === "ar" ? "لوحة التحكم" : "Tableau de bord"}</a>
            <div class="socials">
              ${(ctx.SET.social || [])
                .filter((s) => s.href)
                .map(
                  (s) =>
                    `<a href="${ctx.esc(ctx.R.safeHref(s.href, ""))}" target="_blank" rel="noopener noreferrer" aria-label="${ctx.esc(s.id)}">${ctx.ICON[s.icon] || ctx.ICON.instagram}</a>`
                )
                .join("")}
            </div>
          </div>
        </div>
      </footer>`;
    ctx.hydrateIcons(el);
  }
}
