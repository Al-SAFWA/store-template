// @ts-check
/* dashboard.js → Categories (1.14)
   One list for the merchant: every card is a collection (the thing products belong to). The card's switch hides it
   everywhere; the editor is 4 short steps — name → image → products → where it shows (home strip / top menu).
   Home strip = `theme.categories`, top menu = `settings.navigation`; both are kept in sync from here so the merchant
   never edits three lists. Products are never deleted with a category. Shared state lives on `ctx`. */

import { productInCollection, resolveCollectionHandle } from "../../domain/collection-aliases.js";

const PLACEHOLDER = "assets/img/category-iphone.svg";

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, {
    viewCategories,
    categoryEditor,
    saveCategoryEditor,
    deleteCategory,
    moveCategory,
    setCategoryImage,
    toggleCategoryProduct,
    toggleCategoryFlag,
    toggleCategoryVisible,
    filterCategoryProducts
  });

  const collections = () => ctx.model.collections || [];
  const products = () => ctx.model.products || [];
  const homeList = () => (ctx.model.theme.categories = ctx.model.theme.categories || []);
  const navList = () => (ctx.model.settings.navigation = ctx.model.settings.navigation || []);
  const navHref = (handle) => `collection.html?handle=${handle}`;
  const inCategory = (product, handle) => productInCollection(product, handle);
  const membersOf = (handle) => products().filter((product) => inCategory(product, handle));
  const onHome = (handle) => homeList().some((item) => item.handle === handle);
  const onMenu = (handle) => navList().some((item) => item.href === navHref(handle));

  function categoryImage(collection) {
    if (collection.image) return collection.image;
    const home = homeList().find((item) => item.handle === collection.handle);
    if (home?.image) return home.image;
    const first = membersOf(collection.handle).find((product) => product.image || product.images?.[0]);
    return first ? first.image || first.images[0] : PLACEHOLDER;
  }

  /* ---------- list ---------- */

  function cardMeta(collection) {
    const count = membersOf(collection.handle).length;
    const parts = [
      count ? ctx.dt(`${count} منتجات`, `${count} produits`) : ctx.dt("فارغة", "Vide"),
      onHome(collection.handle) ? ctx.dt("في الرئيسية", "Accueil") : "",
      onMenu(collection.handle) ? ctx.dt("في القائمة", "Menu") : ""
    ].filter(Boolean);
    return parts.join(" · ");
  }

  function categoryCard(collection, index, total) {
    return `<article class="ct-card ${collection.visible === false ? "is-off" : ""}">
      <div class="ct-order">
        <span class="ct-num">${index + 1}</span>
        <button type="button" class="ct-move" data-action="move-category" data-index="${index}" data-dir="-1" ${index === 0 ? "disabled" : ""} aria-label="${ctx.dt("أعلى", "Monter")}">▲</button>
        <button type="button" class="ct-move" data-action="move-category" data-index="${index}" data-dir="1" ${index === total - 1 ? "disabled" : ""} aria-label="${ctx.dt("أسفل", "Descendre")}">▼</button>
      </div>
      <button type="button" class="ct-main" data-action="edit-category" data-index="${index}">
        <span class="ct-thumb"><img src="${ctx.esc(categoryImage(collection))}" alt=""></span>
        <span class="ct-text"><strong>${ctx.esc(ctx.lng(collection.title))}</strong><small>${ctx.esc(cardMeta(collection))}</small></span>
      </button>
      <label class="toggle"><input type="checkbox" data-action="toggle-category-visible" data-index="${index}" ${collection.visible !== false ? "checked" : ""}><span></span></label>
      <div class="ct-actions">
        <button type="button" class="ct-edit" data-action="edit-category" data-index="${index}">${ctx.icon("edit")} ${ctx.dt("تعديل", "Modifier")}</button>
        <button type="button" class="ct-del" data-action="delete-category" data-index="${index}">${ctx.icon("trash")} ${ctx.dt("حذف", "Supprimer")}</button>
      </div>
    </article>`;
  }

  function viewCategories() {
    const list = collections();
    return `
      <div class="dash-view-head"><div><h2>${ctx.dt("الفئات", "Catégories")}</h2><p>${ctx.dt("قائمة واحدة: ما تفعّله هنا يظهر في الصفحة الرئيسية وقائمة المتجر. اضغط الفئة لتعديلها.", "Une seule liste : ce que vous activez ici apparaît sur l’accueil et dans le menu. Touchez une catégorie pour la modifier.")}</p></div></div>
      <div class="ct">
        ${list.map((collection, index) => categoryCard(collection, index, list.length)).join("")}
        ${list.length ? "" : `<p class="form-note">${ctx.dt("لا توجد فئات بعد.", "Aucune catégorie.")}</p>`}
        <button type="button" class="pc-add" data-action="add-category">${ctx.icon("plus")} ${ctx.dt("فئة جديدة", "Nouvelle catégorie")}</button>
      </div>`;
  }

  /* ---------- editor ---------- */

  /** Per-editor scratch: membership + visibility flags (not part of the collection row). */
  ctx.categoryDraft = null;

  function categoryEditor(index) {
    const isNew = index == null;
    const buffer = isNew
      ? { handle: `cat-${Date.now().toString(36)}`, title: { ar: "", fr: "" }, visible: true, image: "" }
      : ctx.clone(collections()[index]);
    if (!buffer.title || typeof buffer.title !== "object") buffer.title = { ar: String(buffer.title || ""), fr: "" };
    ctx.editBuffer = buffer;
    ctx.editorKind = "category";
    ctx.categoryDraft = {
      index: isNew ? null : index,
      home: isNew ? true : onHome(buffer.handle),
      menu: isNew ? true : onMenu(buffer.handle),
      members: new Set(membersOf(buffer.handle).map((product) => product.handle)),
      filter: ""
    };
    const step = (title, body, note = "") =>
      `<section class="pe-step"><h4>${title}</h4>${note ? `<p class="form-note">${note}</p>` : ""}${body}</section>`;
    ctx.openModal(
      isNew ? ctx.dt("فئة جديدة", "Nouvelle catégorie") : `${ctx.dt("فئة", "Catégorie")}: ${ctx.lng(buffer.title)}`,
      `<div class="pe">
        ${step(ctx.dt("الاسم", "Nom"), nameStep(buffer))}
        ${step(ctx.dt("الصورة", "Image"), imageStep(buffer), ctx.dt("اختر من صور منتجات الفئة أو ارفع صورة", "Choisissez parmi les photos des produits ou téléversez"))}
        ${step(ctx.dt("المنتجات", "Produits"), productsStep(), ctx.dt("اضغط المنتج لإضافته أو إزالته من الفئة", "Touchez un produit pour l’ajouter ou le retirer"))}
        ${step(ctx.dt("الظهور", "Affichage"), flagsStep())}
      </div>`,
      { footer: ctx.editorFooter(!isNew, "delete-category-buffer") }
    );
  }

  function nameStep(buffer) {
    return `<label class="si-field"><input data-edit-path="title.ar" value="${ctx.esc(buffer.title.ar || "")}" dir="rtl" placeholder="${ctx.dt("مثل: آيفون", "ex. iPhone")}"></label>
      <details class="pe-more"><summary>${ctx.dt("بالفرنسية (اختياري)", "En français (optionnel)")}</summary><div class="pe-more-body">
        <label class="si-field"><input data-edit-path="title.fr" value="${ctx.esc(buffer.title.fr || "")}" dir="ltr" placeholder="iPhone"></label>
        <label class="si-field"><span>${ctx.dt("المعرف في الرابط", "Identifiant")}</span><input value="${ctx.esc(buffer.handle)}" dir="ltr" readonly></label>
      </div></details>`;
  }

  function imageStep(buffer) {
    const seen = new Set();
    const pics = [];
    for (const product of products()) {
      const url = product.image || product.images?.[0];
      if (!url || seen.has(url) || !ctx.categoryDraft.members.has(product.handle)) continue;
      seen.add(url);
      pics.push(url);
      if (pics.length >= 8) break;
    }
    return `<div class="ct-picks" data-ct-picks>
        <label class="ct-pick ct-pick-up">${ctx.icon("plus")}<input type="file" accept="image/*" data-upload-path="image" hidden></label>
        ${pics.map((url) => `<button type="button" class="ct-pick ${url === buffer.image ? "on" : ""}" data-cat-image="${ctx.esc(url)}"><img src="${ctx.esc(url)}" alt=""></button>`).join("")}
      </div>
      <div class="ct-current"><img src="${ctx.esc(buffer.image || categoryImage(buffer))}" alt="" data-ct-current></div>`;
  }

  function productChip(product) {
    const on = ctx.categoryDraft.members.has(product.handle);
    return `<button type="button" class="ct-chip ${on ? "on" : ""}" data-cat-product="${ctx.esc(product.handle)}">${on ? "✓ " : ""}${ctx.esc(ctx.lng(product.title))}</button>`;
  }

  function productsStep() {
    const list = products();
    const members = list.filter((product) => ctx.categoryDraft.members.has(product.handle));
    const others = list.filter((product) => !ctx.categoryDraft.members.has(product.handle));
    return `<p class="form-note" data-cat-count>${memberCountText()}</p>
      ${list.length > 10 ? `<label class="si-field"><input type="search" data-cat-filter placeholder="${ctx.dt("ابحث عن منتج…", "Rechercher un produit…")}"></label>` : ""}
      <div class="ct-chips" data-ct-chips>${[...members, ...others].map(productChip).join("")}</div>`;
  }

  function memberCountText() {
    const n = ctx.categoryDraft.members.size;
    return ctx.dt(`${n} منتجات في هذه الفئة`, `${n} produits dans cette catégorie`);
  }

  function flagsStep() {
    const chip = (flag, label) =>
      `<button type="button" class="ct-chip ${ctx.categoryDraft[flag] ? "on" : ""}" data-cat-flag="${flag}">${ctx.categoryDraft[flag] ? "✓ " : ""}${label}</button>`;
    return `<div class="ct-chips">${chip("home", ctx.dt("في الصفحة الرئيسية", "Sur l’accueil"))}${chip("menu", ctx.dt("في القائمة العلوية", "Dans le menu"))}</div>`;
  }

  /* ---------- editor interactions (wired in 23-events-misc) ---------- */

  function setCategoryImage(url) {
    if (!ctx.editBuffer) return;
    ctx.editBuffer.image = url;
    document.querySelectorAll("[data-cat-image]").forEach((node) => {
      node.classList.toggle("on", /** @type {HTMLElement} */ (node).dataset.catImage === url);
    });
    const current = document.querySelector("[data-ct-current]");
    if (current instanceof HTMLImageElement) current.src = url;
  }

  function toggleCategoryProduct(handle) {
    const draft = ctx.categoryDraft;
    if (!draft) return;
    if (draft.members.has(handle)) draft.members.delete(handle);
    else draft.members.add(handle);
    const chip = document.querySelector(`[data-cat-product="${CSS.escape(handle)}"]`);
    const product = products().find((item) => item.handle === handle);
    if (chip && product) chip.outerHTML = productChip(product);
    const count = document.querySelector("[data-cat-count]");
    if (count) count.textContent = memberCountText();
  }

  function toggleCategoryFlag(flag) {
    const draft = ctx.categoryDraft;
    if (!draft || !(flag in draft)) return;
    draft[flag] = !draft[flag];
    const chip = document.querySelector(`[data-cat-flag="${flag}"]`);
    if (chip) {
      chip.classList.toggle("on", draft[flag]);
      chip.textContent = `${draft[flag] ? "✓ " : ""}${chip.textContent.replace(/^✓\s*/, "")}`;
    }
  }

  function filterCategoryProducts(text) {
    const needle = String(text || "")
      .trim()
      .toLowerCase();
    document.querySelectorAll("[data-cat-product]").forEach((node) => {
      const el = /** @type {HTMLElement} */ (node);
      el.hidden = Boolean(needle) && !el.textContent.toLowerCase().includes(needle);
    });
  }

  /* ---------- save / delete / reorder ---------- */

  /** Keeps the home strip and the top menu in line with the editor's two flags. */
  function syncPlacement(item, draft) {
    const home = homeList();
    const at = home.findIndex((entry) => entry.handle === item.handle);
    if (draft.home) {
      const entry = { label: item.title, handle: item.handle, image: item.image || categoryImage(item) };
      if (at === -1) home.push(entry);
      else home[at] = { ...home[at], ...entry };
    } else if (at !== -1) home.splice(at, 1);
    const nav = navList();
    const navAt = nav.findIndex((entry) => entry.href === navHref(item.handle));
    if (draft.menu) {
      if (navAt === -1)
        nav.push({ id: `cat-${item.handle}`, label: item.title, href: navHref(item.handle), visible: true });
      else nav[navAt].label = item.title;
    } else if (navAt !== -1) nav.splice(navAt, 1);
  }

  /** Products whose membership changed; mutates their `collections` and returns them. */
  function applyMembership(handle, members) {
    const changed = [];
    for (const product of products()) {
      const had = inCategory(product, handle);
      const want = members.has(product.handle);
      if (had === want) continue;
      const wantHandle = resolveCollectionHandle(handle);
      product.collections = want
        ? [...(product.collections || []), handle]
        : (product.collections || []).filter((entry) => resolveCollectionHandle(entry) !== wantHandle);
      changed.push(product);
    }
    return changed;
  }

  async function persistCategory(item, changedProducts, isNew) {
    if (!ctx.tablesMode()) {
      if (isNew) collections().push(item);
      else collections()[ctx.categoryDraft.index] = item;
      return true;
    }
    return ctx.catalogWrite(ctx.dt("تم حفظ الفئة", "Catégorie enregistrée"), async () => {
      await ctx.CAT.saveCollection(item);
      for (const product of changedProducts) await ctx.CAT.saveProduct(product);
    });
  }

  async function saveCategoryEditor() {
    const item = ctx.editBuffer;
    const draft = ctx.categoryDraft;
    if (!item || !draft) return;
    item.title.ar = String(item.title.ar || "").trim();
    if (!item.title.ar) return ctx.toast(ctx.dt("اكتب اسم الفئة", "Saisissez le nom"), "error");
    if (!item.title.fr) item.title.fr = item.title.ar;
    const isNew = draft.index == null;
    if (isNew) item.sortOrder = collections().length;
    const changed = applyMembership(item.handle, draft.members);
    const ok = await persistCategory(item, changed, isNew);
    if (!ok) return;
    syncPlacement(item, draft);
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(ctx.dt("تم حفظ الفئة", "Catégorie enregistrée"), "good");
  }

  async function toggleCategoryVisible(index, checked) {
    const item = collections()[index];
    if (!item) return;
    item.visible = checked !== false;
    const nav = navList().find((entry) => entry.href === navHref(item.handle));
    if (nav) nav.visible = item.visible;
    if (ctx.tablesMode()) {
      await ctx.catalogWrite(ctx.dt("تم تحديث الظهور", "Visibilité mise à jour"), () => ctx.CAT.saveCollection(item));
    } else ctx.saveDraftNow();
    ctx.renderRoute();
  }

  async function deleteCategory(index) {
    const item = collections()[index];
    if (!item) return;
    const count = membersOf(item.handle).length;
    const warn = count
      ? ctx.dt(
          `هذه الفئة تحتوي على ${count} منتجات. حذف الفئة لن يحذف المنتجات. المتابعة؟`,
          `Cette catégorie contient ${count} produits. Ils ne seront pas supprimés. Continuer ?`
        )
      : ctx.dt("حذف الفئة الفارغة؟", "Supprimer cette catégorie vide ?");
    if (!window.confirm(warn)) return;
    if (ctx.tablesMode()) {
      const ok = await ctx.catalogWrite(ctx.dt("تم حذف الفئة", "Catégorie supprimée"), () =>
        ctx.CAT.deleteCollection(item)
      );
      if (!ok) return;
    } else collections().splice(index, 1);
    const want = resolveCollectionHandle(item.handle);
    for (const product of products()) {
      if (inCategory(product, item.handle))
        product.collections = (product.collections || []).filter((h) => resolveCollectionHandle(h) !== want);
    }
    syncPlacement(item, { home: false, menu: false });
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(ctx.dt("تم حذف الفئة", "Catégorie supprimée"), "good");
  }

  function syncHomeOrder() {
    const home = homeList();
    const byHandle = new Map(home.map((entry) => [entry.handle, entry]));
    const next = [];
    for (const collection of collections()) {
      const entry = byHandle.get(collection.handle);
      if (entry) next.push(entry);
    }
    for (const entry of home) {
      if (!next.includes(entry)) next.push(entry);
    }
    ctx.model.theme.categories = next;
  }

  async function moveCategory(index, dir) {
    const list = collections();
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    list.forEach((item, position) => {
      item.sortOrder = position;
    });
    syncHomeOrder();
    if (ctx.tablesMode()) {
      await ctx.catalogWrite(ctx.dt("تم تغيير الترتيب", "Ordre modifié"), async () => {
        await ctx.CAT.saveCollection(list[index]);
        await ctx.CAT.saveCollection(list[target]);
      });
    } else ctx.saveDraftNow();
    ctx.renderRoute();
  }
}
