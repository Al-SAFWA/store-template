// @ts-check
/* dashboard.js → Hero slides, merchant edition (1.13)
   Replaces the raw form of 10-homepage.js: the list shows each slide as it will look in the store, and the editor is
   four numbered steps — picture, background (presets, no CSS), text (Arabic first, French folded), button (text +
   destination picked from a list). Data shape of `settings.heroSlides` is unchanged. */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  /** Background presets. `dark: true` = white text. Old custom gradients stay as a seventh "custom" swatch. */
  const HERO_PRESETS = [
    {
      id: "night",
      bg: "linear-gradient(135deg,#1f1f2e 0%,#39255b 55%,#ff6400 130%)",
      dark: true,
      ar: "ليلي",
      fr: "Nuit"
    },
    {
      id: "sky",
      bg: "linear-gradient(135deg,#eef3ff 0%,#d9e5ff 45%,#f7c7ff 120%)",
      dark: false,
      ar: "سماوي",
      fr: "Ciel"
    },
    { id: "sea", bg: "linear-gradient(135deg,#0b6fb8 0%,#00a651 100%)", dark: true, ar: "بحري", fr: "Mer" },
    { id: "black", bg: "linear-gradient(135deg,#111 0%,#444 100%)", dark: true, ar: "أسود", fr: "Noir" },
    { id: "white", bg: "linear-gradient(135deg,#ffffff 0%,#ececec 100%)", dark: false, ar: "أبيض", fr: "Blanc" },
    { id: "orange", bg: "linear-gradient(135deg,#ff6400 0%,#ffb347 100%)", dark: true, ar: "برتقالي", fr: "Orange" }
  ];
  const DEFAULT_IMAGE = "assets/img/hero-1.webp";
  Object.assign(ctx, { heroPanelHTML, heroEditor, saveHeroEditor, heroPresetFor, HERO_PRESETS });
  const norm = (value) =>
    String(value || "")
      .replace(/\s+/g, "")
      .toLowerCase();

  function heroPresetFor(bg) {
    return HERO_PRESETS.find((preset) => norm(preset.bg) === norm(bg)) || null;
  }

  /* ---------- list ---------- */

  function slidePreviewHTML(slide, { small = false } = {}) {
    const light = slide.dark === false;
    return `<div class="hs-preview ${light ? "is-light" : ""} ${small ? "is-small" : ""}" data-sv="bg:${ctx.esc(slide.bg || HERO_PRESETS[0].bg)}">
      <div class="hs-copy"><strong>${ctx.esc(ctx.lng(slide.title) || ctx.dt("عنوان الشريحة", "Titre"))}</strong><span>${ctx.esc(ctx.lng(slide.subtitle) || "")}</span>${slide.cta ? `<em>${ctx.esc(ctx.lng(slide.cta))}</em>` : ""}</div>
      <img src="${ctx.esc(slide.image || DEFAULT_IMAGE)}" alt="">
    </div>`;
  }

  function heroPanelHTML() {
    const slides = ctx.model.settings.heroSlides || [];
    return `<div class="hs-list">
      ${slides
        .map(
          (slide, index) => `<article class="hs-card ${slide.visible === false ? "is-hidden" : ""}">
        <button type="button" class="hs-open" data-action="edit-hero" data-index="${index}" aria-label="${ctx.dt("تعديل", "Modifier")}">${slidePreviewHTML(slide)}</button>
        <div class="hs-bar">
          <span class="hs-num">${index + 1}</span>
          <span class="grow">${slide.visible === false ? ctx.dt("مخفية", "Masquée") : ctx.dt("ظاهرة في المتجر", "Visible en boutique")}</span>
          ${ctx.directToggle("", `settings.heroSlides.${index}.visible`, slide.visible !== false)}
          <button class="btn btn-sm btn-soft" type="button" data-action="edit-hero" data-index="${index}" title="${ctx.dt("تعديل", "Modifier")}">${ctx.icon("edit")}</button>
          <button class="btn btn-sm btn-soft" type="button" data-action="hero-up" data-index="${index}" ${index === 0 ? "disabled" : ""} title="${ctx.dt("أعلى", "Monter")}">${ctx.icon("up")}</button>
          <button class="btn btn-sm btn-soft" type="button" data-action="hero-down" data-index="${index}" ${index === slides.length - 1 ? "disabled" : ""} title="${ctx.dt("أسفل", "Descendre")}">${ctx.icon("down")}</button>
        </div>
      </article>`
        )
        .join("")}
      <button type="button" class="hs-add" data-action="add-hero">${ctx.icon("plus")} ${ctx.dt("إضافة شريحة", "Ajouter une diapositive")}</button>
      <p class="form-note">${ctx.dt("اضغط على الشريحة لتعديلها. الأسهم تغيّر الترتيب، والمفتاح يخفيها دون حذفها. التغييرات تُنشر عند الضغط على «نشر».", "Touchez une diapositive pour la modifier. Les flèches changent l’ordre, l’interrupteur la masque sans la supprimer. Publiez pour mettre en ligne.")}</p>
    </div>`;
  }

  /* ---------- editor ---------- */

  function destinationOptions(current) {
    const groups = [];
    groups.push({
      label: ctx.dt("عام", "Général"),
      items: [{ value: "collection.html?handle=all", label: ctx.dt("كل المنتجات", "Tous les produits") }]
    });
    const collections = (ctx.model.collections || []).filter((c) => c.handle && c.handle !== "all");
    if (collections.length)
      groups.push({
        label: ctx.dt("فئة", "Catégorie"),
        items: collections.map((c) => ({
          value: `collection.html?handle=${c.handle}`,
          label: ctx.lng(c.title) || c.handle
        }))
      });
    const products = (ctx.model.products || []).filter((p) => p.handle && p.active !== false).slice(0, 80);
    if (products.length)
      groups.push({
        label: ctx.dt("منتج", "Produit"),
        items: products.map((p) => ({ value: `product.html?handle=${p.handle}`, label: ctx.lng(p.title) || p.handle }))
      });
    const pages = (ctx.model.pages || []).filter((p) => p.slug);
    if (pages.length)
      groups.push({
        label: ctx.dt("صفحة", "Page"),
        items: pages.map((p) => ({ value: `page.html?slug=${p.slug}`, label: ctx.lng(p.title) || p.slug }))
      });
    const known = new Set(groups.flatMap((g) => g.items.map((i) => i.value)));
    const isCustom = current && !known.has(current);
    const html = groups
      .map(
        (g) =>
          `<optgroup label="${ctx.esc(g.label)}">${g.items
            .map(
              (i) =>
                `<option value="${ctx.esc(i.value)}" ${i.value === current ? "selected" : ""}>${ctx.esc(i.label)}</option>`
            )
            .join("")}</optgroup>`
      )
      .join("");
    return {
      html: `${html}<option value="__custom" ${isCustom ? "selected" : ""}>${ctx.dt("رابط آخر…", "Autre lien…")}</option>`,
      isCustom
    };
  }

  function newSlide() {
    return {
      id: `hero-${Date.now().toString(36)}`,
      visible: true,
      title: { ar: "", fr: "" },
      subtitle: { ar: "", fr: "" },
      cta: { ar: "تسوق الآن", fr: "Découvrir" },
      href: "collection.html?handle=all",
      image: DEFAULT_IMAGE,
      bg: HERO_PRESETS[0].bg,
      dark: true
    };
  }

  /** Markup of the four steps. */
  function heroEditorBody(buffer, preset, dest) {
    const swatch = (p, on, extra = "") =>
      `<button type="button" class="hs-swatch ${on ? "is-on" : ""} ${extra}" data-hero-bg="${p.id}" title="${ctx.esc(p.label)}" aria-label="${ctx.esc(p.label)}" data-sv="bg:${ctx.esc(p.bg)}"></button>`;
    const swatches =
      HERO_PRESETS.map((p) => swatch({ id: p.id, bg: p.bg, label: ctx.dt(p.ar, p.fr) }, preset?.id === p.id)).join("") +
      (!preset && buffer.bg
        ? swatch({ id: "__custom", bg: buffer.bg, label: ctx.dt("مخصّص", "Personnalisé") }, true, "is-custom")
        : "");
    const body = `
      <div class="pe hs-editor">
        <section class="pe-step">
          <h4>${ctx.dt("الصورة", "Photo")}</h4>
          <div class="image-field hs-image-field">
            ${slidePreviewHTML(buffer)}
            <input type="hidden" data-edit-path="image" value="${ctx.esc(buffer.image || "")}">
            <label class="btn btn-soft hs-upload">${ctx.icon("image")} ${ctx.dt("تغيير الصورة", "Changer la photo")}<input type="file" accept="image/*" data-upload-path="image" hidden></label>
          </div>
          <p class="form-note">${ctx.dt("الأفضل صورة للجهاز بخلفية شفافة (PNG/WebP). تُصغَّر وتُضغط تلقائياً.", "Idéalement une photo du produit sur fond transparent (PNG/WebP). Redimensionnée automatiquement.")}</p>
        </section>

        <section class="pe-step">
          <h4>${ctx.dt("الخلفية", "Fond")}</h4>
          <div class="hs-presets" role="radiogroup">
            ${swatches}
          </div>
          <p class="form-note">${ctx.dt("لون النص يُضبط تلقائياً: أبيض على الداكن، أسود على الفاتح.", "La couleur du texte s’adapte : blanc sur fond sombre, noir sur fond clair.")}</p>
        </section>

        <section class="pe-step">
          <h4>${ctx.dt("النص", "Texte")}</h4>
          <div class="pe-field pe-title"><label>${ctx.dt("العنوان", "Titre")}</label><input data-edit-path="title.ar" data-hero-live="title" value="${ctx.esc(buffer.title.ar || "")}" placeholder="${ctx.dt("مثال: هواتف مجددة بضمان سنة", "Ex. : téléphones garantis 1 an")}"></div>
          <div class="pe-field"><label>${ctx.dt("سطر تحت العنوان (اختياري)", "Sous-titre (facultatif)")}</label><textarea data-edit-path="subtitle.ar" data-hero-live="subtitle" rows="2">${ctx.esc(buffer.subtitle.ar || "")}</textarea></div>
          <details class="pe-more"><summary>${ctx.dt("النص بالفرنسية", "Texte en français")}</summary>
            <div class="pe-more-body">
              <div class="pe-field"><label>Titre</label><input data-edit-path="title.fr" value="${ctx.esc(buffer.title.fr || "")}" dir="ltr"></div>
              <div class="pe-field"><label>Sous-titre</label><textarea data-edit-path="subtitle.fr" rows="2" dir="ltr">${ctx.esc(buffer.subtitle.fr || "")}</textarea></div>
              <div class="pe-field"><label>Bouton</label><input data-edit-path="cta.fr" value="${ctx.esc(buffer.cta.fr || "")}" dir="ltr"></div>
              <p class="form-note">${ctx.dt("إن تركتها فارغة يُعرض النص العربي للزوار بالفرنسية.", "Si vide, le texte arabe est affiché aux visiteurs francophones.")}</p>
            </div>
          </details>
        </section>

        <section class="pe-step">
          <h4>${ctx.dt("الزر", "Bouton")}</h4>
          <div class="pe-two">
            <div class="pe-field"><label>${ctx.dt("نص الزر", "Texte du bouton")}</label><input data-edit-path="cta.ar" data-hero-live="cta" value="${ctx.esc(buffer.cta.ar || "")}"></div>
            <div class="pe-field"><label>${ctx.dt("يفتح", "Ouvre")}</label><select data-hero-dest>${dest.html}</select></div>
          </div>
          <div class="pe-field hs-custom-href ${dest.isCustom ? "" : "u-hidden"}"><label>${ctx.dt("الرابط", "Lien")}</label><input data-edit-path="href" value="${ctx.esc(buffer.href || "")}" dir="ltr" placeholder="https://…"></div>
        </section>
      </div>`;
    return body;
  }

  /**
   * @param {number|null} index  null = new slide
   * @param {object} [restored]  buffer restored after a lost session (1.13)
   */
  function heroEditor(index, restored) {
    const isNew = index == null;
    const buffer = restored || (isNew ? newSlide() : ctx.clone(ctx.model.settings.heroSlides[index]));
    for (const key of ["title", "subtitle", "cta"]) buffer[key] = buffer[key] || { ar: "", fr: "" };
    ctx.editBuffer = buffer;
    ctx.editorKind = "hero";
    ctx.pendingHeroIndex = isNew ? null : index;
    const preset = heroPresetFor(buffer.bg);
    const dest = destinationOptions(buffer.href);
    const title = isNew
      ? ctx.dt("شريحة جديدة", "Nouvelle diapositive")
      : `${ctx.dt("تعديل الشريحة", "Diapositive")} ${index + 1}`;
    const body = heroEditorBody(buffer, preset, dest);
    ctx.openModal(title, body, {
      footer: ctx.editorFooter(!isNew, "delete-hero-buffer"),
      onMount: (root) => {
        root.querySelector(".dash-modal-foot")?.classList.add("pe-foot");
        mountHeroEditor(root);
      }
    });
  }

  /** Live preview + preset / destination behaviour, scoped to the open modal. */
  function mountHeroEditor(root) {
    const preview = root.querySelector(".hs-image-field .hs-preview");
    const buffer = ctx.editBuffer;
    const paint = () => {
      if (!preview || !buffer) return;
      preview.setAttribute("data-sv", `bg:${buffer.bg || HERO_PRESETS[0].bg}`);
      preview.classList.toggle("is-light", buffer.dark === false);
      preview.querySelector("strong").textContent = buffer.title?.ar || ctx.dt("عنوان الشريحة", "Titre");
      preview.querySelector("span").textContent = buffer.subtitle?.ar || "";
      const em = preview.querySelector("em");
      if (em) em.textContent = buffer.cta?.ar || "";
      const img = preview.querySelector("img");
      if (img && buffer.image && img.getAttribute("src") !== buffer.image) img.src = buffer.image;
    };
    root.querySelectorAll("[data-hero-live]").forEach((node) =>
      node.addEventListener("input", () => {
        // handleField already wrote the value into the buffer (delegated input listener); repaint afterwards.
        setTimeout(paint, 0);
      })
    );
    root.querySelectorAll("[data-hero-bg]").forEach((button) =>
      button.addEventListener("click", () => {
        const preset = HERO_PRESETS.find((p) => p.id === button.dataset.heroBg);
        if (preset && buffer) {
          buffer.bg = preset.bg;
          buffer.dark = preset.dark;
        }
        root.querySelectorAll("[data-hero-bg]").forEach((b) => b.classList.toggle("is-on", b === button));
        paint();
      })
    );
    const dest = root.querySelector("[data-hero-dest]");
    const custom = root.querySelector(".hs-custom-href");
    dest?.addEventListener("change", () => {
      const value = /** @type {HTMLSelectElement} */ (dest).value;
      if (value === "__custom") {
        custom?.classList.remove("u-hidden");
        custom?.querySelector("input")?.focus();
        return;
      }
      custom?.classList.add("u-hidden");
      if (buffer) buffer.href = value;
      const hrefInput = custom?.querySelector("input");
      if (hrefInput) hrefInput.value = value;
    });
    // The shared upload handler mirrors the new URL into the hidden input and the <img> inside `.image-field`.
    root.querySelector(".hs-image-field input[type=file]")?.addEventListener("change", () => {
      const poll = setInterval(() => {
        if (buffer?.image && preview?.querySelector("img")?.getAttribute("src") === buffer.image) {
          clearInterval(poll);
          paint();
        }
      }, 300);
      setTimeout(() => clearInterval(poll), 15000);
    });
    paint();
  }

  function saveHeroEditor() {
    const buffer = ctx.editBuffer;
    if (!buffer) return;
    const ar = String(buffer.title?.ar || "").trim();
    if (!ar) {
      ctx.toast(ctx.dt("اكتب عنوان الشريحة أولاً.", "Saisissez d’abord le titre."), "error");
      return;
    }
    // French falls back to Arabic so the FR storefront never shows an empty hero.
    for (const key of ["title", "subtitle", "cta"]) {
      buffer[key] = buffer[key] || { ar: "", fr: "" };
      if (!String(buffer[key].fr || "").trim()) buffer[key].fr = buffer[key].ar || "";
    }
    if (!buffer.href || buffer.href === "__custom") buffer.href = "collection.html?handle=all";
    const preset = heroPresetFor(buffer.bg);
    if (preset) buffer.dark = preset.dark;
    if (ctx.pendingHeroIndex == null) ctx.model.settings.heroSlides.push(buffer);
    else ctx.model.settings.heroSlides[ctx.pendingHeroIndex] = buffer;
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(
      ctx.dt(
        "تم حفظ الشريحة — اضغط «نشر» لتظهر في المتجر.",
        "Diapositive enregistrée — publiez pour la mettre en ligne."
      ),
      "good"
    );
  }
}
