// @ts-check
/* dashboard.js → Products
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, {
    filteredProducts,
    viewProducts,
    productEditor,
    saveProductEditor,
    bulkPriceModal,
    applyBulkPrice,
    deleteProduct
  });
  function filteredProducts() {
    const needle = ctx.R.normalizeText(ctx.productSearch);
    return ctx.productList().filter((product) => {
      if (ctx.productCategory !== "all" && !(product.collections || []).includes(ctx.productCategory)) return false;
      if (ctx.productStock === "low" && Number(product.stock) > Number(ctx.model.settings.lowStockThreshold || 2))
        return false;
      if (ctx.productStock === "out" && Number(product.stock) > 0) return false;
      if (!needle) return true;
      return ctx.R.normalizeText(
        [
          ctx.lng(product.title),
          product.title?.ar,
          product.title?.fr,
          product.handle,
          product.vendor,
          product.type,
          product.sku
        ].join(" ")
      ).includes(needle);
    });
  }

  function viewProducts() {
    const list = filteredProducts();
    const shown = list.slice(0, 80);
    return `${ctx.catalogBanner()}
      <div class="dash-view-head">
        <div><h2>${ctx.dt("المنتجات", "Produits")}</h2><p>${list.length} ${ctx.dt("منتج في المخزون", "produits en stock")} · ${ctx.lowStockProducts().length} ${ctx.dt("بحاجة لتعبئة", "à réapprovisionner")}</p></div>
        <div class="dash-view-actions"><button class="btn btn-soft" data-action="bulk-price">${ctx.icon("edit")} ${ctx.dt("تعديل أسعار جماعي", "Prix groupés")}</button><button class="btn btn-primary" data-action="add-product">${ctx.icon("plus")} ${ctx.dt("منتج جديد", "Nouveau produit")}</button></div>
      </div>
      <div class="dash-toolbar">
        <label class="field u-min-210"><input id="product-search" placeholder="${ctx.dt("بحث عن منتج...", "Rechercher un produit...")}" value="${ctx.esc(ctx.productSearch)}"></label>
        <label class="field"><select data-product-filter="category"><option value="all">${ctx.dt("كل الفئات", "Toutes catégories")}</option>${ctx.model.collections.map((collection) => `<option value="${ctx.esc(collection.handle)}" ${ctx.productCategory === collection.handle ? "selected" : ""}>${ctx.esc(ctx.lng(collection.title))}</option>`).join("")}</select></label>
        <label class="field"><select data-product-filter="stock"><option value="all">${ctx.dt("كل المخزون", "Tout le stock")}</option><option value="low" ${ctx.productStock === "low" ? "selected" : ""}>${ctx.dt("مخزون منخفض", "Stock faible")}</option><option value="out" ${ctx.productStock === "out" ? "selected" : ""}>${ctx.dt("نفد المخزون", "Épuisé")}</option></select></label>
        <div class="spacer"></div>
        <span class="badge-soft">${shown.length}/${list.length}</span>
        ${ctx.directToggle(ctx.dt("إخفاء المنتجات المنتهية من المتجر", "Masquer les produits épuisés"), "settings.autoHideOutOfStock", ctx.model.settings.autoHideOutOfStock)}
      </div>
      <div class="dash-card">
        ${
          shown.length
            ? `<div class="dash-table-wrap"><table class="dash-table"><thead><tr><th>${ctx.dt("المنتج", "Produit")}</th><th>${ctx.dt("SKU", "SKU")}</th><th>${ctx.dt("الفئة", "Catégorie")}</th><th>${ctx.dt("السعر", "Prix")}</th><th>${ctx.dt("المخزون", "Stock")}</th><th>${ctx.dt("الحالة", "Statut")}</th><th>${ctx.dt("المتجر", "Boutique")}</th><th></th></tr></thead><tbody>
          ${shown
            .map((product) => {
              return productRow(product);
            })
            .join("")}</tbody></table></div>`
            : `<div class="table-empty">${ctx.icon("products")}<p>${ctx.dt("لا توجد منتجات مطابقة.", "Aucun produit correspondant.")}</p></div>`
        }
      </div>`;
  }

  /** Blank product used when the editor opens for a new item. */
  function newProductBuffer() {
    return {
      handle: `p-${Date.now().toString(36)}`,
      title: { ar: "", fr: "" },
      vendor: "",
      type: "Smartphone",
      condition: "Good",
      price: 0,
      compare: 0,
      stock: 1,
      battery: 90,
      active: true,
      image: "",
      images: [],
      description: { ar: "", fr: "" },
      includes: [],
      specs: {},
      colors: [],
      colorImages: {},
      variants: [],
      collections: [],
      sku: "",
      warrantyMonths: 12
    };
  }

  function categoryOptionsHTML(buffer) {
    return ctx.model.collections
      .map(
        (collection) =>
          `<option value="${ctx.esc(collection.handle)}" ${buffer.collections?.includes(collection.handle) ? "selected" : ""}>${ctx.esc(ctx.lng(collection.title))}</option>`
      )
      .join("");
  }

  /** One row of the products table. */
  function productCategoryLabel(product) {
    const category = ctx.model.collections.find((collection) =>
      (product.collections || []).includes(collection.handle)
    );
    if (category) return ctx.lng(category.title);
    return product.collections?.[0] || "—";
  }

  function productCompareLabel(product) {
    if (!(product.compare > product.price)) return "";
    return `<br><small class="u-strike">${ctx.money(product.compare)}</small>`;
  }

  function stockColor(product, isLow) {
    if (Number(product.stock) <= 0) return "var(--danger)";
    return isLow ? "#e67e22" : "inherit";
  }

  function stockBarPercent(product) {
    return Math.min(100, Math.max(3, (Number(product.stock) / 20) * 100));
  }

  function productActiveBadge(product) {
    if (product.active !== false) return `<span class="badge-soft green">${ctx.dt("نشط", "Actif")}</span>`;
    return `<span class="badge-soft">${ctx.dt("مخفي", "Masqué")}</span>`;
  }

  function productRow(product) {
    const productIndex = ctx.model.products.indexOf(product);
    const isLow = Number(product.stock) <= Number(ctx.model.settings.lowStockThreshold || 2);
    return `<tr>
              <td><div class="cell-main"><img src="${ctx.esc(product.image)}" alt=""><div><strong>${ctx.esc(ctx.lng(product.title))}</strong><small>${ctx.esc(product.type || "")} · ${ctx.esc(product.condition || "")}</small></div></div></td>
              <td class="u-ltr">${ctx.esc(product.sku || product.handle)}</td>
              <td>${ctx.esc(productCategoryLabel(product))}</td>
              <td class="price">${ctx.money(product.price)}${productCompareLabel(product)}</td>
              <td><div class="u-flex u-col u-gap-3"><strong class="u-fs-9 u-tint-text" data-sv="fg:${ctx.esc(stockColor(product, isLow))}">${product.stock}</strong><div class="mini-bar" data-sv="bar:${isLow ? "#e67e22" : "#25a55f"};min-width:50px"><i class="u-w-pct" data-sv="w:${stockBarPercent(product)}"></i></div></div></td>
              <td>${productActiveBadge(product)}</td>
              <td><label class="toggle"><input type="checkbox" data-product-active="${productIndex}" ${product.active !== false ? "checked" : ""}><span></span></label></td>
              <td><div class="cell-actions"><button class="btn btn-sm btn-soft" data-action="edit-product" data-index="${productIndex}">${ctx.icon("edit")}</button><button class="btn btn-sm btn-soft" data-action="delete-product" data-index="${productIndex}">${ctx.icon("trash")}</button></div></td>
            </tr>`;
  }

  function productEditorTitle(buffer, isNew) {
    if (isNew) return ctx.dt("منتج جديد", "Nouveau produit");
    return buffer.title?.ar || buffer.title;
  }

  function productEditorBuffer(index) {
    if (index == null) return newProductBuffer();
    return ctx.clone(ctx.model.products[index]);
  }

  function productEditor(index) {
    const isNew = index == null;
    const buffer = productEditorBuffer(index);
    ctx.editBuffer = buffer;
    ctx.openModal(productEditorTitle(buffer, isNew), ctx.productEditorMarkup(buffer, categoryOptionsHTML(buffer)), {
      footer: ctx.editorFooter(!isNew, "delete-product-buffer"),
      onMount: (root) => {
        root.querySelector(".dash-modal-foot")?.classList.add("pe-foot");
        ctx.mountProductEditor(root);
      }
    });
    ctx.pendingProductIndex = isNew ? null : index;
  }
  ctx.pendingProductIndex = null;

  /* ---------- product editor: read back ---------- */

  function parseColorMap(text) {
    return Object.fromEntries(
      text
        .split("\n")
        .map((line) => line.split(":"))
        .filter((parts) => parts.length >= 2)
        .map((parts) => [parts[0].trim(), parts.slice(1).join(":").trim()])
    );
  }

  function applyJsonField(ctx, item, node) {
    const path = node.dataset.editPath;
    if (!node.value.trim()) {
      ctx.setPath(item, path, node.dataset.json === "array" ? [] : null);
      return;
    }
    try {
      ctx.setPath(item, path, JSON.parse(node.value));
    } catch {
      ctx.toast(`${ctx.dt("JSON غير صالح في", "JSON invalide dans")} ${path}`, "error");
    }
  }

  /** Reads the editor (photos, colours, choices, advanced JSON) into the edit buffer. */
  function readStructuredFields(item) {
    const modal = ctx.$(".dash-modal");
    if (!modal) return;
    modal.querySelectorAll("[data-colormap]").forEach((node) => {
      item.colorImages = parseColorMap(node.value);
    });
    modal.querySelectorAll("[data-json]").forEach((node) => applyJsonField(ctx, item, node));
    ctx.readProductEditor(item, modal);
  }

  /** Numeric fields and the default `active` flag. */
  function normalizeNumericFields(item) {
    item.price = Number(item.price) || 0;
    item.compare = Number(item.compare) || 0;
    item.stock = Number(item.stock) || 0;
    item.battery = Number(item.battery) || 0;
    item.warrantyMonths = Number(item.warrantyMonths) || 12;
    if (item.active == null) item.active = true;
  }

  /** Handle uniqueness for a new product. */
  function isDuplicateHandle(ctx, item) {
    if (ctx.pendingProductIndex != null) return false;
    return ctx.model.products.some((product) => product.handle === item.handle);
  }

  /** Relational mode: write through the repository, never into the draft JSON. */
  function saveProductToTables(ctx, item) {
    if (ctx.pendingProductIndex != null) item.id = ctx.model.products[ctx.pendingProductIndex]?.id || item.id;
    return ctx
      .catalogWrite(ctx.dt("تم حفظ المنتج في قاعدة البيانات", "Produit enregistré en base"), () =>
        ctx.CAT.saveProduct(item)
      )
      .then((ok) => {
        if (!ok) return;
        ctx.closeModal();
        ctx.renderRoute();
      });
  }

  /** Draft mode: replace or insert the product and persist the draft. */
  function saveProductToDraft(ctx, item) {
    if (ctx.pendingProductIndex == null) ctx.model.products.unshift(item);
    else ctx.model.products[ctx.pendingProductIndex] = item;
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.R.addAudit(`${ctx.dt("حفظ منتج", "Produit enregistré")}: ${item.title?.ar || item.handle}`);
    ctx.toast(ctx.dt("تم حفظ المنتج في المسودة", "Produit enregistré dans le brouillon"), "good");
    ctx.renderRoute();
  }

  /** Handles must be lowercase latin (storefront URLs + DB rule). Clean what the merchant typed; generate when nothing usable remains. */
  function normalizeHandle(value) {
    const slug = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return /^[a-z0-9][a-z0-9-]{1,118}$/.test(slug) ? slug : `p-${Date.now().toString(36)}`;
  }
  /** Title must be a {ar, fr} pair with at least one language; FR mirrors AR when empty. Returns false when both are blank. */
  function normalizeTitle(item) {
    if (!item.title || typeof item.title !== "object") item.title = { ar: String(item.title || ""), fr: "" };
    item.title.ar = String(item.title.ar || "").trim();
    item.title.fr = String(item.title.fr || "").trim() || item.title.ar;
    return Boolean(item.title.ar || item.title.fr);
  }
  function saveProductEditor() {
    const item = ctx.editBuffer;
    if (!item) return;
    if (!normalizeTitle(item)) {
      ctx.toast(ctx.dt("اكتب اسم المنتج أولاً", "Saisissez d’abord le nom du produit"), "error");
      return;
    }
    // New product: the URL slug comes from the name (variant ids embed it, so this runs before the read-back).
    if (ctx.pendingProductIndex == null) item.handle = ctx.handleFromTitle(item.title, ctx.model.products);
    readStructuredFields(item);
    normalizeNumericFields(item);
    const cleaned = normalizeHandle(item.handle);
    if (cleaned !== item.handle) {
      item.handle = cleaned;
      ctx.toast(ctx.dt("تم تصحيح المعرّف إلى ", "Identifiant corrigé en ") + cleaned);
    }
    if (isDuplicateHandle(ctx, item)) {
      ctx.toast(ctx.dt("المعرف مستخدم مسبقًا", "Identifiant déjà utilisé"), "error");
      return;
    }
    if (ctx.tablesMode()) return saveProductToTables(ctx, item);
    return saveProductToDraft(ctx, item);
  }

  function bulkPriceModal() {
    ctx.openModal(
      ctx.dt("تعديل الأسعار الجماعي", "Modification groupée des prix"),
      `
      <div class="field"><label>${ctx.dt("الفئة", "Catégorie")}</label><select id="bulk-category"><option value="all">${ctx.dt("كل الفئات", "Toutes")}</option>${ctx.model.collections.map((collection) => `<option value="${ctx.esc(collection.handle)}">${ctx.esc(ctx.lng(collection.title))}</option>`).join("")}</select></div>
      <div class="form-grid u-mt-10"><div class="field"><label>${ctx.dt("نسبة التغيير %", "Pourcentage")}</label><input id="bulk-percent" type="number" value="5" placeholder="5"></div><div class="field"><label>${ctx.dt("الاتجاه", "Sens")}</label><select id="bulk-direction"><option value="up">${ctx.dt("زيادة", "Augmenter")}</option><option value="down">${ctx.dt("تخفيض", "Diminuer")}</option></select></div></div>
      <p class="form-note u-mt-10">${ctx.dt("سيتم تحديث السعر الأخير مع الحفاظ على السعر المشطوب كما هو. يمكنك التراجع بعدم النشر.", "Le prix sera ajusté. Le prix barré reste inchangé. Vous pouvez annuler avant publication.")}</p>`,
      {
        footer: `<button class="btn btn-soft btn-sm" data-action="close-modal">${ctx.dt("إلغاء", "Annuler")}</button><button class="btn btn-primary btn-sm" data-action="apply-bulk-price">${ctx.dt("تطبيق", "Appliquer")}</button>`
      }
    );
  }

  function applyBulkPrice() {
    const category = ctx.$("#bulk-category")?.value || "all";
    const percent = Number(ctx.$("#bulk-percent")?.value) || 0;
    const direction = ctx.$("#bulk-direction")?.value || "up";
    if (ctx.tablesMode()) {
      let n = 0;
      ctx
        .catalogWrite(ctx.dt("تم تحديث الأسعار في قاعدة البيانات", "Prix mis à jour en base"), async () => {
          n = await ctx.CAT.bulkPrice({ collection: category, percent, direction });
        })
        .then((ok) => {
          if (ok) {
            ctx.closeModal();
            ctx.renderRoute();
            ctx.toast(`${n} ${ctx.dt("منتجًا تم تحديث سعره", "produits mis à jour")}`, "good");
          }
        });
      return;
    }
    let count = 0;
    ctx.model.products.forEach((product) => {
      if (product.active === false) return;
      if (category !== "all" && !(product.collections || []).includes(category)) return;
      const factor = direction === "up" ? 1 + percent / 100 : 1 - percent / 100;
      product.price = Math.max(0, Math.round((Number(product.price) * factor) / 5) * 5);
      count += 1;
    });
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.renderRoute();
    ctx.toast(`${count} ${ctx.dt("منتجًا تم تحديث سعره", "produits mis à jour")}`, "good");
  }

  function deleteProduct(index, fromBuffer = false) {
    const product = fromBuffer ? ctx.editBuffer : ctx.model.products[index];
    if (!product) return;
    if (!confirm(`${ctx.dt("حذف", "Supprimer")} ${product.title?.ar || product.handle}?`)) return;
    if (ctx.tablesMode()) {
      ctx
        .catalogWrite(ctx.dt("تم حذف المنتج من قاعدة البيانات", "Produit supprimé en base"), () =>
          ctx.CAT.deleteProduct(product)
        )
        .then((ok) => {
          if (ok) {
            ctx.closeModal();
            ctx.renderRoute();
          }
        });
      return;
    }
    if (fromBuffer) ctx.model.products = ctx.model.products.filter((item) => item.handle !== product.handle);
    else ctx.model.products.splice(index, 1);
    ctx.saveDraftNow();
    ctx.closeModal();
    ctx.R.addAudit(`${ctx.dt("حذف منتج", "Produit supprimé")}: ${product.handle}`);
    ctx.renderRoute();
    ctx.toast(ctx.dt("تم حذف المنتج من المسودة", "Produit supprimé du brouillon"), "good");
  }
}
