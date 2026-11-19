// @ts-check
/* dashboard.js → Pages and FAQ (blog removed in 1.17)
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { viewPages, pageEditor, savePageEditor, faqEditor });
  function viewPages() {
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("الصفحات", "Pages")}</h2><p>${ctx.dt("الصفحات الثابتة والأسئلة الشائعة.", "Pages statiques et FAQ.")}</p></div></div>
      <div class="dash-tabs"><button class="active" data-dash-tab="pages-static">${ctx.dt("الصفحات", "Pages")}</button><button data-dash-tab="pages-faq">${ctx.dt("الأسئلة الشائعة", "FAQ")}</button></div>
      <div class="dash-panel active" data-dash-panel="pages-static">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("الصفحات الثابتة", "Pages statiques")}</h3><button data-action="add-page">${ctx.icon("plus")} ${ctx.dt("صفحة جديدة", "Nouvelle page")}</button></div><div class="dash-card-body"><div class="list-editor">
          ${(ctx.model.pages || []).map((page, index) => `<div class="list-row"><div class="grow"><strong>${ctx.esc(ctx.lng(page.title))}</strong><small class="handle">${ctx.esc(page.slug)}</small></div>${ctx.directToggle("", `pages.${index}.visible`, page.visible !== false)}<a class="btn btn-sm btn-soft" href="page.html?slug=${encodeURIComponent(page.slug)}" target="_blank" rel="noopener" title="${ctx.dt("معاينة", "Aperçu")}">${ctx.icon("external")}</a><button class="btn btn-sm btn-soft" data-action="edit-page" data-index="${index}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-page" data-index="${index}">${ctx.icon("trash")}</button></div>`).join("")}
        </div></div></article>
      </div>
      <div class="dash-panel" data-dash-panel="pages-faq">
        <article class="dash-card"><div class="dash-card-head"><h3>${ctx.dt("الأسئلة الشائعة", "FAQ")}</h3><button data-action="add-faq">${ctx.icon("plus")} ${ctx.dt("سؤال جديد", "Nouvelle question")}</button></div><div class="dash-card-body"><div class="list-editor">
          ${(ctx.model.faqs || []).map((faq, index) => `<div class="list-row"><div class="grow"><strong>${ctx.esc(ctx.lng(faq.q))}</strong><small>${ctx.esc(ctx.lng(faq.a)).slice(0, 90)}</small></div><button class="btn btn-sm btn-soft" data-action="edit-faq" data-index="${index}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-faq" data-index="${index}">${ctx.icon("trash")}</button></div>`).join("")}
        </div></div></article>
      </div>`;
  }

  ctx.pendingPageIndex = null;
  function pageEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? {
          slug: `page-${Date.now().toString(36)}`,
          title: { ar: "", fr: "" },
          body: { ar: "", fr: "" },
          visible: true,
          seoTitle: { ar: "", fr: "" },
          seoDescription: { ar: "", fr: "" }
        }
      : ctx.clone(ctx.model.pages[index]);
    ctx.editBuffer = buffer;
    ctx.pendingPageIndex = isNew ? null : index;
    ctx.openModal(
      isNew ? ctx.dt("صفحة جديدة", "Nouvelle page") : ctx.lng(buffer.title),
      `
      <div class="form-grid">
        ${ctx.editBi(ctx.dt("العنوان", "Titre"), "title", buffer.title)}
        <div class="field"><label>${ctx.dt("الرابط", "Slug")}</label><input data-edit-path="slug" value="${ctx.esc(buffer.slug)}" dir="ltr"></div>
        ${ctx.editBi(ctx.dt("محتوى الصفحة", "Contenu"), "body", buffer.body, { type: "textarea", rows: 12 })}
        ${ctx.editBi(ctx.dt("عنوان SEO", "Titre SEO"), "seoTitle", buffer.seoTitle)}
        ${ctx.editBi(ctx.dt("وصف SEO", "Description SEO"), "seoDescription", buffer.seoDescription, { type: "textarea", rows: 2 })}
        <p class="form-note span-2">${ctx.dt("الرابط يستخدم حروفًا إنجليزية صغيرة وأرقامًا وشرطات فقط. يظهر المحتوى في المتجر مباشرة بعد النشر.", "Le slug utilise des minuscules, chiffres et tirets. Le contenu apparaît après publication.")}</p>
        ${ctx.editToggle(ctx.dt("ظاهرة", "Visible"), "visible", buffer.visible !== false)}
      </div>`,
      {
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" data-action="save-page" data-index="${isNew ? "" : index}">${ctx.dt("حفظ", "Enregistrer")}</button>`
      }
    );
  }

  function savePageEditor() {
    if (!ctx.editBuffer) return;
    const slug = String(ctx.editBuffer.slug || "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
      return ctx.toast(
        ctx.dt("الرابط: حروف إنجليزية صغيرة وأرقام وشرطات فقط", "Slug : minuscules, chiffres et tirets uniquement"),
        "error"
      );
    }
    const duplicate = (ctx.model.pages || []).some(
      (page, index) => page.slug === slug && index !== ctx.pendingPageIndex
    );
    if (duplicate) return ctx.toast(ctx.dt("هذا الرابط مستخدم لصفحة أخرى", "Ce slug est déjà utilisé"), "error");
    if (!String(ctx.editBuffer.title?.ar || ctx.editBuffer.title?.fr || "").trim())
      return ctx.toast(ctx.dt("عنوان الصفحة مطلوب", "Le titre est requis"), "error");
    ctx.editBuffer.slug = slug;
    ctx.editBuffer.seoTitle = ctx.editBuffer.seoTitle || ctx.editBuffer.title;
    if (ctx.pendingPageIndex == null) ctx.model.pages.push(ctx.editBuffer);
    else ctx.model.pages[ctx.pendingPageIndex] = ctx.editBuffer;
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(
      ctx.dt(
        "تم حفظ الصفحة في المسودة. انشر لتظهر للزوار.",
        "Page enregistrée en brouillon. Publiez pour la rendre visible."
      ),
      "good"
    );
  }

  function faqEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? { id: `faq-${Date.now().toString(36)}`, q: { ar: "", fr: "" }, a: { ar: "", fr: "" } }
      : ctx.clone(ctx.model.faqs[index]);
    ctx.editBuffer = buffer;
    ctx.openModal(
      isNew ? ctx.dt("سؤال جديد", "Nouvelle question") : ctx.lng(buffer.q),
      `
      <div class="dash-form">${ctx.editBi(ctx.dt("السؤال", "Question"), "q", buffer.q)}${ctx.editBi(ctx.dt("الجواب", "Réponse"), "a", buffer.a, { type: "textarea", rows: 4 })}</div>`,
      {
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" data-action="save-faq" data-index="${isNew ? "" : index}">${ctx.dt("حفظ", "Enregistrer")}</button>`
      }
    );
  }
}
