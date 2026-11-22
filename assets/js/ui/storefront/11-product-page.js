// @ts-check
/* app.js → Product page
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see app.js). */
import { createProductsRepo } from "../../data/repositories/products.repo.js";
import { displayImage, isBrokenProductImage } from "../../domain/category-images.js";
import { whatsappDigits } from "../../domain/channels.js";
import { isReturnEnabled, returnLabel } from "../../domain/store-policies.js";
import { mapRepoProduct } from "./11a-product-mappers.js";
import { galleryHTML, productExtraHTML, productNotFoundHTML, relatedHTML } from "./11b-product-blocks.js";

/** @param {StorefrontCtx} ctx */
/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, {
    productSeed,
    productReviews,
    productRating,
    specKeysFor,
    pdpSpecsHTML,
    pdpVariant,
    pdpInfoHTML,
    renderProductReviews,
    renderRatingStars,
    hashColor,
    loadProductByHandle,
    renderProduct
  });
  const PDP = { p: null, sel: {}, qty: 1, specs: {} };

  const OPT_LABELS = {
    color: { ar: "اللون", fr: "Couleur" },
    colour: { ar: "اللون", fr: "Couleur" },
    storage: { ar: "التخزين", fr: "Stockage" },
    "storage/ram": { ar: "التخزين / الذاكرة", fr: "Stockage / RAM" },
    condition: { ar: "الحالة", fr: "État" },
    ram: { ar: "الذاكرة", fr: "RAM" },
    cpu: { ar: "المعالج", fr: "Processeur" },
    connectivity: { ar: "الاتصال", fr: "Connectivité" },
    "strap color": { ar: "لون السوار", fr: "Couleur du bracelet" }
  };
  const optLabel = (name) => OPT_LABELS[String(name).toLowerCase()]?.[ctx.R.lang] || name;
  const COLOR_NAMES = {
    black: { ar: "أسود", fr: "Noir" },
    white: { ar: "أبيض", fr: "Blanc" },
    silver: { ar: "فضي", fr: "Argent" },
    gray: { ar: "رمادي", fr: "Gris" },
    grey: { ar: "رمادي", fr: "Gris" },
    graphite: { ar: "غرافيت", fr: "Graphite" },
    blue: { ar: "أزرق", fr: "Bleu" },
    navy: { ar: "كحلي", fr: "Bleu marine" },
    green: { ar: "أخضر", fr: "Vert" },
    red: { ar: "أحمر", fr: "Rouge" },
    pink: { ar: "وردي", fr: "Rose" },
    purple: { ar: "بنفسجي", fr: "Violet" },
    gold: { ar: "ذهبي", fr: "Or" },
    orange: { ar: "برتقالي", fr: "Orange" },
    yellow: { ar: "أصفر", fr: "Jaune" },
    brown: { ar: "بني", fr: "Marron" }
  };
  const optValue = (name, value) => {
    if (/condition|état/i.test(name)) return ctx.conditionLabel(value);
    if (/color|colour|couleur|لون/i.test(name)) return COLOR_NAMES[String(value).toLowerCase()]?.[ctx.R.lang] || value;
    return value;
  };

  function productSeed(p) {
    let h = 0;
    for (let i = 0; i < p.handle.length; i++) h = (h * 31 + p.handle.charCodeAt(i)) >>> 0;
    return h;
  }

  function productReviews(p) {
    const moderated = ctx.R.getProductReviews(p.handle).map((review) => ({
      ...review,
      handle: p.handle,
      name: review.customerName,
      date: review.createdAt
    }));
    const specific = (ctx.S.reviews || []).filter(
      (r) => (r.handle === p.handle || r.productHandle === p.handle) && r.approved !== false
    );
    if (moderated.length || specific.length) {
      const seen = new Set();
      return [...moderated, ...specific].filter((review) => {
        const key = review.id || `${review.name}:${ctx.L(review.title)}:${review.date}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    const seed = productSeed(p);
    const names = [
      ["أحمد ولد محمد", "Ahmed Ould Mohamed"],
      ["مريم بنت أحمد", "Mariem Mint Ahmed"],
      ["الشيخ ولد سيدي", "Cheikh Ould Sidi"],
      ["فاطمة بنت عبد الله", "Fatimetou Mint Abdallah"]
    ];
    const titles = [
      { ar: "جهاز مطابق للوصف", fr: "Conforme à la description" },
      { ar: "تغليف جيد وتوصيل سريع", fr: "Bien emballé et livraison rapide" },
      { ar: "قيمة ممتازة", fr: "Excellent rapport qualité-prix" }
    ];
    const bodies = [
      {
        ar: "وصل الجهاز بحالة ممتازة، البطارية جيدة والاتصال ممتاز. خدمة واتساب كانت سريعة.",
        fr: "L’appareil est arrivé en excellent état, batterie correcte et connectivité parfaite. Le service WhatsApp a été rapide."
      },
      {
        ar: "طلبت يوم الأحد ووصلني في نواكشوط يوم الاثنين. كل شيء يعمل كما هو مذكور.",
        fr: "Commandé dimanche, livré lundi à Nouakchott. Tout fonctionne comme annoncé."
      },
      {
        ar: "السعر أقل من الجديد والضمان أعطاني ثقة. أنصح به لمن يبحث عن جهاز موثوق.",
        fr: "Le prix est bien inférieur au neuf et la garantie inspire confiance. Je recommande."
      }
    ];
    return [0, 1, 2].map((i) => ({
      id: `${p.handle}-review-${i}`,
      handle: p.handle,
      name: ctx.R.lang === "ar" ? names[(seed + i) % names.length][0] : names[(seed + i) % names.length][1],
      rating: 4 + ((seed + i) % 2),
      title: titles[(seed + i) % titles.length],
      body: bodies[(seed + i) % bodies.length],
      verified: true,
      date: "2026-09-18"
    }));
  }

  function productRating(p) {
    const reviews = productReviews(p);
    return (reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / Math.max(1, reviews.length)).toFixed(1);
  }

  const SPEC_KEYS = {
    Macbook: ["cpu", "ram", "storage", "screen", "keyboard", "condition"],
    Laptop: ["cpu", "ram", "storage", "screen", "keyboard", "condition"],
    Smartphone: ["storage", "screen", "condition", "battery"],
    Tablets: ["storage", "screen", "condition", "battery"],
    "Apple Watch": ["screen", "condition", "battery"],
    Playstation: ["storage", "condition"]
  };
  const DEFAULT_SPEC_KEYS = ["condition", "battery"];

  function specKeysFor(p) {
    return SPEC_KEYS[p.type] || DEFAULT_SPEC_KEYS;
  }

  function optionCoversSpec(p, key) {
    const needle = String(key).toLowerCase();
    return (p.options || []).some((o) => {
      const n = String(o.name).toLowerCase();
      return n === needle || n.includes(needle) || needle.includes(n);
    });
  }

  function pdpSpecsHTML(p) {
    const specs = p.specs || {};
    const keys = specKeysFor(p).filter((key) => {
      const spec = specs[key];
      if (!spec || key === "battery") return false;
      if (optionCoversSpec(p, key)) return false;
      return [...new Set((spec.choices || []).filter(Boolean))].length > 0;
    });
    if (!keys.length) return "";
    return keys
      .map((key) => {
        const spec = specs[key];
        const value = PDP.specs[key] ?? spec.value;
        const choices = [...new Set((spec.choices || []).filter(Boolean))];
        const buttons = choices
          .map((choice) => {
            const active = String(choice) === String(value);
            return `<button class="opt-btn ${active ? "active" : ""}" type="button" dir="auto" data-spec="${ctx.esc(key)}" data-value="${ctx.esc(choice)}">${ctx.esc(choice)}</button>`;
          })
          .join("");
        return `<div class="opt-label">${ctx.esc(ctx.L(spec.label))} <span dir="auto">${ctx.esc(value || "")}</span></div><div class="opt-values">${buttons}</div>`;
      })
      .join("");
  }

  /** Variants saved by the dashboard carry {color, storage}; the page matches the shopper's picks on o1/o2 — fill
   * those in from the option order when they are missing so every product, local or remote, is selectable. */
  function withVariantAxes(p) {
    const options = p.options || [];
    if (!options.length) return p;
    (p.variants || []).forEach((v) => {
      if (v.o1 != null) return;
      const axes = options.map((o) => (isColorOption(o.name) ? v.color : v.storage));
      axes.forEach((value, i) => {
        v["o" + (i + 1)] = value || null;
      });
      if (!v.title) v.title = axes.filter(Boolean).join(" / ") || v.label || "";
    });
    return p;
  }

  function pdpVariant() {
    const p = PDP.p;
    if (!p) return null;
    const keys = (p.options || []).map((o) => o.name);
    const axis = (x, i) => x["o" + (i + 1)];
    // null on an axis means "any value" (e.g. a colour palette added to a product whose variants have no colour)
    let v = (p.variants || []).find((x) => keys.every((k, i) => axis(x, i) == null || axis(x, i) === PDP.sel[k]));
    if (!v) v = (p.variants || []).find((x) => x.available) || p.variants?.[0];
    return v;
  }

  const isColorOption = (name) => /color|colour/i.test(String(name));

  function colorButtonHTML(ctx, p, o, val, active) {
    const c = (p.colors || []).find((x) => x.name === val);
    return `<button class="opt-btn color-opt ${active ? "active" : ""}" type="button" data-opt="${ctx.esc(o.name)}" data-value="${ctx.esc(val)}" data-color-hex="${ctx.esc(c?.hex || "")}"><span class="color-dot u-tint" data-sv="bg:${c ? c.hex : "#ccc"}"></span>${ctx.esc(optValue(o.name, val))}</button>`;
  }

  function optionButtonHTML(ctx, o, val, active) {
    return `<button class="opt-btn ${active ? "active" : ""}" type="button" dir="auto" data-opt="${ctx.esc(o.name)}" data-value="${ctx.esc(val)}">${ctx.esc(optValue(o.name, val))}</button>`;
  }

  function optionRowHTML(o) {
    if (!o.values.length) return "";
    const isColor = isColorOption(o.name);
    const buttons = o.values
      .map((val) => {
        const active = PDP.sel[o.name] === val;
        return isColor ? colorButtonHTML(ctx, PDP.p, o, val, active) : optionButtonHTML(ctx, o, val, active);
      })
      .join("");
    return `<div class="opt-label">${ctx.esc(optLabel(o.name))} <span dir="auto">${ctx.esc(optValue(o.name, PDP.sel[o.name] || ""))}</span></div><div class="opt-values">${buttons}</div>`;
  }

  function pdpBadges(p, currentCondition) {
    const battery = p.battery
      ? `<span class="product-badge battery">${ctx.ICON.bolt} ${ctx.esc(ctx.t("battery"))} ${p.battery}%</span>`
      : "";
    const macos =
      p.type === "Macbook" ? `<span class="product-badge">${ctx.ICON.apple} ${ctx.esc(ctx.t("macos"))}</span>` : "";
    return `<div class="product-badges">${battery}<span class="product-badge">${ctx.esc(currentCondition)}</span>${macos}</div>`;
  }

  function pdpPriceRow(price, compare, disc) {
    const was =
      compare && compare > price
        ? `<span class="price-was">${ctx.money(compare)}</span><span class="price-badge">-${disc}%</span>`
        : "";
    return `<div class="price-row"><span class="price-now">${ctx.money(price)}</span>${was}</div>`;
  }

  function pdpActionsHTML(soldOut) {
    const label = soldOut ? ctx.esc(ctx.t("soldOut")) : ctx.esc(ctx.t("addToCart"));
    const disabled = soldOut ? "disabled" : "";
    return `<div class="product-actions">
          <button class="btn btn-primary btn-block" type="button" data-add-cart ${disabled}>${label}</button>
          <button class="btn btn-dark btn-block" type="button" data-buy-now ${disabled}>${ctx.esc(ctx.t("buyNow"))}</button>
        </div>`;
  }

  function pdpTrustHTML(p) {
    const last =
      p.type === "Macbook"
        ? `<div>${ctx.ICON.badgeCheck}<span>${ctx.esc(ctx.t("macos"))}<small>${ctx.esc(ctx.t("checkedSub"))}</small></span></div>`
        : `<div>${ctx.ICON.badgeCheck}<span>${ctx.esc(ctx.t("checked"))}<small>${ctx.esc(ctx.t("checkedSub"))}</small></span></div>`;
    const returnsOn = isReturnEnabled(ctx.SET);
    const returnsBit = returnsOn
      ? `<div>${ctx.ICON.return}<span>${ctx.esc(returnLabel(ctx.SET, ctx.R.lang) || ctx.t("returns"))}<small>${ctx.esc(ctx.t("returnsSub"))}</small></span></div>`
      : "";
    return `<div class="trust-mini">
          <div>${ctx.ICON.truck}<span>${ctx.esc(ctx.t("freeDelivery"))}<small>${ctx.esc(ctx.t("freeDeliverySub"))}</small></span></div>
          <div>${ctx.ICON.shield}<span>${ctx.esc(ctx.t("warranty"))}<small>${ctx.esc(ctx.t("warrantySub"))}</small></span></div>
          ${returnsBit}
          ${last}
        </div>`;
  }

  function pdpIncludedHTML(p) {
    const items = (p.includes || [])
      .map((item) => `<li>${ctx.ICON.check}<span>${ctx.esc(ctx.L(item))}</span></li>`)
      .join("");
    return `<div class="included-card">
          <h3>${ctx.esc(ctx.t("whatsIncluded"))}</h3>
          <ul>${items}</ul>
        </div>`;
  }

  function pdpAccordionHTML(p) {
    const shipping = ctx.esc(ctx.L(ctx.SET.shippingNote));
    const cities = ctx.esc(
      ctx.R.lang === "ar"
        ? "نواكشوط: توصيل مجاني · باقي المدن: رسوم حسب الولاية."
        : "Nouakchott : livraison offerte · Autres villes : frais selon la wilaya."
    );
    const returnsOn = isReturnEnabled(ctx.SET);
    const returnsBit = returnsOn ? returnLabel(ctx.SET, ctx.R.lang) : "";
    const warranty = ctx.esc(
      ctx.R.lang === "ar"
        ? returnsOn
          ? `ضمان 12 شهرًا يغطي الأعطال التقنية، و${returnsBit} في حال وجود مشكلة.`
          : "ضمان 12 شهرًا يغطي الأعطال التقنية."
        : returnsOn
          ? `Garantie 12 mois couvrant les pannes techniques et ${returnsBit.toLowerCase()} en cas de problème.`
          : "Garantie 12 mois couvrant les pannes techniques."
    );
    return `<div class="accordion">
          <details open><summary>${ctx.esc(ctx.t("description"))}</summary><div class="acc-body"><p>${ctx.esc(ctx.L(p.description))}</p><p class="muted">${ctx.esc(ctx.L(ctx.SET.originalDevice))} · ${ctx.esc(ctx.t("warrantyMonths", { months: p.warrantyMonths || 12 }))}</p></div></details>
          <details><summary>${ctx.esc(ctx.t("shippingDelivery"))}</summary><div class="acc-body"><p>${shipping}</p><p>${cities}</p></div></details>
          <details><summary>${ctx.esc(ctx.t("warrantyReturns"))}</summary><div class="acc-body"><p>${warranty}</p></div></details>
        </div>`;
  }

  function currentConditionLabel(p) {
    const conditionOption = p.options?.find((o) => /condition|état/i.test(o.name));
    const selected = conditionOption?.values?.find((value) => value === PDP.sel[conditionOption.name]);
    return ctx.conditionLabel(selected || p.condition);
  }

  function whatsappQuestion(p, v) {
    const title = ctx.L(p.title);
    const variantTitle = ctx.L(v?.title) || (v ? ctx.variantLabel(v) : "");
    const qty = Number(PDP.qty) || 1;
    const price = ctx.money(Number(v?.price ?? p.price) * qty);
    const named = `${title}${variantTitle ? ` (${variantTitle})` : ""}`;
    return ctx.R.lang === "ar"
      ? `مرحباً، أريد طلب: ${named} × ${qty} — ${price}`
      : `Bonjour, je souhaite commander : ${named} × ${qty} — ${price}`;
  }

  function pdpInfoHTML() {
    const p = PDP.p;
    const v = pdpVariant();
    const price = Number(v?.price ?? p.price);
    const compare = v?.compare ?? p.compare;
    const rating = productRating(p);
    // `available` is only present on the legacy sample catalog; products created in the dashboard or loaded from the
    // tables carry stock instead — an absent flag must not read as "sold out" (it did: add-to-cart was disabled on
    // every dashboard-created product).
    const variantSoldOut = v ? v.available === false || (v.stock != null && Number(v.stock) <= 0) : false;
    const soldOut = Number(p.stock) <= 0 || p.available === false || variantSoldOut;
    const options = (p.options || []).map(optionRowHTML).join("");
    return `
      <div class="product-info" id="product-info">
        <div class="vendor">${ctx.esc(p.vendor || ctx.L(ctx.SET.storeName))}</div>
        <h1>${ctx.esc(ctx.L(p.title))}</h1>
        <div class="rating">${[1, 2, 3, 4, 5].map((n) => `<span class="tp-star${n > Math.round(Number(rating)) ? " off" : ""}" data-icon="star"></span>`).join("")}<span>${rating} · ${productReviews(p).length} ${ctx.esc(ctx.t("reviews"))}</span></div>
        ${pdpBadges(p, currentConditionLabel(p))}
        ${pdpPriceRow(price, compare, ctx.discountFor(price, compare))}
        ${ctx.hasPaymentOffer() ? `<div class="payment-offer-line">${ctx.ICON.bolt}<span>${ctx.esc(ctx.L(ctx.SET.paymentOffer))}</span></div>` : ""}
        ${options}
        ${pdpSpecsHTML(p)}
        <div class="opt-label">${ctx.esc(ctx.t("quantity"))}</div>
        <div class="qty">
          <button type="button" data-qty="-1" aria-label="-">−</button>
          <span id="qty-val">${PDP.qty}</span>
          <button type="button" data-qty="1" aria-label="+">+</button>
        </div>
        ${pdpActionsHTML(soldOut)}
        ${
          whatsappDigits(ctx.SET)
            ? `<a class="whatsapp-order" href="https://wa.me/${ctx.esc(whatsappDigits(ctx.SET))}?text=${encodeURIComponent(whatsappQuestion(p, v))}" target="_blank" rel="noopener">${ctx.ICON.whatsapp} ${ctx.esc(ctx.t("orderWhatsApp"))}</a>`
            : ""
        }
        ${pdpTrustHTML(p)}
        ${pdpIncludedHTML(p)}
        ${pdpAccordionHTML(p)}
      </div>
      ${renderProductReviews(p)}`;
  }

  function renderProductReviews(product) {
    const reviews = ctx.R.getProductReviews(product.handle);
    const cust = ctx.R.getCustomer();
    const pending = cust
      ? ctx.R.customerReviews().filter((r) => r.productHandle === product.handle && r.status === "pending")
      : [];
    const canReview = Boolean(cust) && !pending.length;
    const average = reviews.length ? reviews.reduce((sum, r) => sum + Number(r.rating || 5), 0) / reviews.length : 0;
    return `
      <section class="product-reviews reveal" aria-labelledby="reviews-heading">
        <div class="container">
          <div class="reviews-head">
            <h2 id="reviews-heading">${ctx.esc(ctx.t("reviews"))} <span class="reviews-count">(${reviews.length})</span></h2>
            ${reviews.length ? `<div class="reviews-summary">${renderRatingStars(average)} <span>${average.toFixed(1)} / 5 · ${reviews.length} ${ctx.esc(ctx.t("reviews"))}</span></div>` : ""}
          </div>
          ${pending.length ? `<div class="review-pending-note">${ctx.ICON.shield} ${ctx.esc(ctx.t("reviewPending"))}</div>` : ""}
          <div class="reviews-list">
            ${
              reviews.length
                ? reviews
                    .map(
                      (r) => `
              <article class="review-card">
                <div class="review-header">
                  <span class="review-avatar u-tint" data-sv="bg:${hashColor(String(r.customerName || "R"))}">${ctx.esc(String(r.customerName || "R").slice(0, 1))}</span>
                  <div>
                    <strong>${ctx.esc(r.customerName || "")}${r.verified ? ` <span class="verified-badge">${ctx.esc(ctx.t("verifiedBuyer"))}</span>` : ""}</strong>
                    <div class="review-meta">${renderRatingStars(Number(r.rating) || 5)} <time>${ctx.esc(ctx.R.formatDate(r.createdAt))}</time></div>
                  </div>
                </div>
                <h4>${ctx.esc(ctx.L(r.title))}</h4>
                <p>${ctx.esc(ctx.L(r.body))}</p>
              </article>`
                    )
                    .join("")
                : `<p class="muted">${ctx.esc(ctx.t("noReviews"))}</p>`
            }
          </div>
          ${
            canReview
              ? `
            <div class="review-form" id="review-form">
              <h3>${ctx.esc(ctx.t("writeReview"))}</h3>
              <div class="form-grid">
                <div class="field"><label>${ctx.esc(ctx.t("rating"))}</label>
                  <div class="rating-input" data-rating="0">
                    ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} / 5">${ctx.ICON.star}</button>`).join("")}
                  </div>
                </div>
                <div class="field"><label>${ctx.esc(ctx.t("title"))}</label><input type="text" id="review-title" placeholder="${ctx.esc(ctx.t("reviewTitlePlaceholder"))}"></div>
                <div class="field span-2"><label>${ctx.esc(ctx.t("comment"))}</label><textarea id="review-body" rows="3" placeholder="${ctx.esc(ctx.t("reviewBodyPlaceholder"))}"></textarea></div>
                <div class="field span-2"><button class="btn btn-primary" type="button" id="submit-review">${ctx.esc(ctx.t("submitReview"))}</button></div>
              </div>
            </div>`
              : cust
                ? ""
                : `
            <p class="review-login-prompt"><a href="account.html">${ctx.esc(ctx.t("loginToReview"))}</a></p>`
          }
        </div>
      </section>`;
  }

  function renderRatingStars(rating) {
    const full = Math.round(rating);
    return [1, 2, 3, 4, 5]
      .map((n) => `<span class="tp-star${n > full ? " off" : ""}" data-icon="star"></span>`)
      .join("");
  }

  function hashColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 45%)`;
  }

  async function loadProductByHandle(handle) {
    const local = handle ? ctx.BY_HANDLE.get(handle) : null;
    if (!ctx.R.remote || !ctx.R.config?.supabaseUrl) return local;
    try {
      const repo = createProductsRepo(ctx.R.config);
      const row = await repo.getByHandle(handle);
      if (!row) return local;
      return mapRepoProduct(row, local);
    } catch (e) {
      console.warn("restore_products repo fallback", e);
      return local;
    }
  }

  function showNotFound() {
    document.title = `${ctx.t("productNotFound")} | ${ctx.L(ctx.SET.storeName)}`;
    const crumb = document.getElementById("prod-crumb");
    if (crumb)
      crumb.innerHTML = `<a href="index.html">${ctx.esc(ctx.t("homeCrumb"))}</a><span>/</span><span>${ctx.esc(ctx.t("productNotFound"))}</span>`;
    const host = ensureBlock("product-root");
    host.innerHTML = productNotFoundHTML(ctx);
    ["product-extra", "product-related"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });
  }

  /** Resets PDP state for a freshly loaded product. */
  function seedPdp(p) {
    PDP.p = withVariantAxes(p);
    PDP.qty = 1;
    PDP.sel = {};
    PDP.specs = {};
    Object.entries(p.specs || {}).forEach(([key, spec]) => {
      PDP.specs[key] = spec.value;
    });
    (p.options || []).forEach((o) => {
      if (o.values.length) PDP.sel[o.name] = o.values[0];
    });
    const v = pdpVariant();
    if (!v) return;
    (p.options || []).forEach((o, i) => {
      if (v[`o${i + 1}`]) PDP.sel[o.name] = v[`o${i + 1}`];
    });
  }

  function renderBreadcrumb(p) {
    const col = ctx.S.collections.find((c) => (p.collections || []).includes(c.handle));
    const crumb = document.getElementById("prod-crumb");
    if (!crumb) return;
    const collection = encodeURIComponent(p.collections?.[0] || "all");
    crumb.innerHTML = `<a href="index.html">${ctx.esc(ctx.t("homeCrumb"))}</a><span>/</span><a href="collection.html?handle=${collection}">${ctx.esc(col ? ctx.L(col.title) : ctx.t("shop"))}</a><span>/</span><span>${ctx.esc(p.title)}</span>`;
  }

  function galleryImages(p) {
    const raw = [...new Set([p.image, ...(p.images || []), ...Object.values(p.colorImages || {})].filter(Boolean))];
    const images = raw.filter((url) => !isBrokenProductImage(url));
    const fallback = displayImage(p);
    const list = images.length ? images : [fallback];
    const color = p.colorImages?.[p.colors?.[0]?.name];
    const initialImage = color && !isBrokenProductImage(color) ? color : list[0];
    return { images: list, initialImage };
  }

  /** The product page shell is a `page-*` custom element so no HTML string is parsed into it (CSP: no inline CSS). */
  function ensureBlock(id) {
    const existing = document.getElementById(id);
    if (existing) return existing;
    const host = document.createElement("page-block");
    host.id = id;
    (document.getElementById("product-root")?.parentElement || document.body).appendChild(host);
    return host;
  }

  function renderRelated(p) {
    const related = ensureBlock("product-related");
    const pool = ctx.PRODUCTS.filter(
      (x) => x.handle !== p.handle && (x.collections || []).some((c) => (p.collections || []).includes(c))
    );
    const items = (pool.length ? pool : ctx.PRODUCTS.filter((x) => x.handle !== p.handle)).slice(0, 5);
    related.innerHTML = relatedHTML(ctx, items);
    return related;
  }

  async function renderProduct() {
    const handle = new URLSearchParams(location.search).get("handle");
    const p = handle ? await loadProductByHandle(handle) : null;
    if (!p) return showNotFound();

    seedPdp(p);
    ctx.applyProductSeo(p);
    renderBreadcrumb(p);

    const { images, initialImage } = galleryImages(p);
    const root = ensureBlock("product-root");
    root.innerHTML = galleryHTML(ctx, p, images, initialImage, pdpInfoHTML);

    const extra = ensureBlock("product-extra");
    extra.innerHTML = productExtraHTML(ctx, p, productReviews(p), productRating);

    const related = renderRelated(p);
    ctx.hydrateIcons(root);
    ctx.hydrateIcons(extra);
    ctx.hydrateIcons(related);
    ctx.observeReveals();
  }
  Object.assign(ctx, { PDP, OPT_LABELS, optLabel, optValue });
}
