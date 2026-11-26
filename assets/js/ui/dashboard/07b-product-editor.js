// @ts-check
/* dashboard.js → Product editor (1.11): the screen a merchant fills on a phone.
   Five visible things — name, price, photos, colours, choices/stock — everything else under one "more details" fold.
   The editor owns its own state (`ctx.editBuffer` + a local `ui` object) and writes the catalog shape the rest of
   the system already understands (colors[], options[], variants[] with o1/o2/color/storage/price_delta/stock).
   The list, save and delete logic stay in 07-products.js. */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { productEditorMarkup, readProductEditor, mountProductEditor, handleFromTitle, slugify });

  const PRESET_COLORS = [
    ["Black", "#111827", "أسود", "Noir"],
    ["White", "#f8fafc", "أبيض", "Blanc"],
    ["Silver", "#cbd5e1", "فضي", "Argent"],
    ["Gray", "#6b7280", "رمادي", "Gris"],
    ["Gold", "#d4af37", "ذهبي", "Or"],
    ["Blue", "#2563eb", "أزرق", "Bleu"],
    ["Green", "#059669", "أخضر", "Vert"],
    ["Red", "#dc2626", "أحمر", "Rouge"],
    ["Pink", "#db2777", "وردي", "Rose"],
    ["Purple", "#7c3aed", "بنفسجي", "Violet"]
  ];
  const AXES = [
    ["Storage", "السعة", "Stockage"],
    ["Size", "المقاس", "Taille"],
    ["RAM", "الذاكرة", "RAM"],
    ["Model", "الموديل", "Modèle"],
    ["Capacity", "القدرة", "Capacité"]
  ];
  const PLACEHOLDER_IMAGE = "assets/products/smartphone-pro-128.svg";
  const PRODUCT_TYPES = ["Smartphone", "Macbook", "Laptop", "Tablets", "Apple Watch", "Playstation", "Accessories"];
  const PRODUCT_CONDITIONS = ["Like New", "Excellent", "Very Good", "Good", "Fair", "New"];
  const isColorName = (name) => /color|colour|couleur|لون/i.test(String(name || ""));
  const colorLabel = (name) => {
    const preset = PRESET_COLORS.find((c) => c[0].toLowerCase() === String(name).toLowerCase());
    return preset ? ctx.dt(preset[2], preset[3]) : name;
  };
  const axisLabel = (name) => {
    const axis = AXES.find((a) => a[0] === name);
    return axis ? ctx.dt(axis[1], axis[2]) : name;
  };

  /* ---------- derive the simple UI model from a product ---------- */

  /** Second axis (non-colour option) with its rows {value, delta, stock} and the colour×value stock grid. */
  function choicesOf(p) {
    const axis = (p.options || []).find((o) => !isColorName(o.name));
    const values = axis ? axis.values.slice() : [];
    const variants = p.variants || [];
    const base = Number(p.price || 0);
    const rows = values.map((value) => {
      const own = variants.filter((v) => (v.storage || v.o2 || v.o1) === value);
      const first = own[0];
      const delta = first
        ? first.price_delta != null
          ? Number(first.price_delta)
          : Number(first.price || base) - base
        : 0;
      return { value, delta: Math.round(delta) || 0, stock: own.reduce((n, v) => n + Number(v.stock || 0), 0) };
    });
    const grid = {};
    for (const v of variants)
      if (v.color && (v.storage || v.o2)) grid[`${v.color}|${v.storage || v.o2}`] = Number(v.stock || 0);
    return { axis: axis?.name || "Storage", rows, grid };
  }

  function uiFrom(p) {
    const colors = (p.colors || []).map((c) => ({ name: c.name, hex: c.hex || "#999999" }));
    const { axis, rows, grid } = choicesOf(p);
    const images = [p.image, ...(p.images || [])].filter((src, i, all) => src && all.indexOf(src) === i);
    return { colors, axis, rows, grid, images, hasChoices: rows.length > 0 };
  }
  let ui = uiFrom({});

  /* ---------- markup ---------- */

  const field = (label, body, cls = "") => `<div class="pe-field ${cls}"><label>${label}</label>${body}</div>`;
  const step = (inner, cls = "") => `<div class="pe-step ${cls}">${inner}</div>`;

  function imagesHTML() {
    const tiles = ui.images
      .map(
        (src, i) => `<figure class="pe-img${i === 0 ? " main" : ""}" data-pe-img="${i}">
          <img src="${ctx.esc(src)}" alt="">
          ${i === 0 ? `<figcaption>${ctx.dt("الرئيسية", "Principale")}</figcaption>` : ""}
          <button type="button" class="pe-x" data-pe-remove-img="${i}" aria-label="×">×</button>
        </figure>`
      )
      .join("");
    return `<div class="pe-images">${tiles}
      <label class="pe-add-img">${ctx.icon("upload")}<span>${ctx.dt("أضف صوراً", "Ajouter des photos")}</span><input type="file" accept="image/*" multiple data-pe-upload></label>
    </div>
    <p class="form-note">${ctx.dt("الصورة الأولى هي التي تظهر في المتجر. اضغط على صورة لجعلها الأولى.", "La première photo est celle de la boutique. Touchez une photo pour la mettre en premier.")}</p>`;
  }

  function colorsHTML() {
    const picked = new Set(ui.colors.map((c) => c.name.toLowerCase()));
    const chips = PRESET_COLORS.map(
      ([name, hex, ar, fr]) =>
        `<button type="button" class="pe-chip${picked.has(name.toLowerCase()) ? " on" : ""}" data-pe-color="${name}" data-pe-hex="${hex}" title="${ctx.dt(ar, fr)}" aria-label="${ctx.dt(ar, fr)}"><i class="u-tint" data-sv="bg:${hex}"></i></button>`
    ).join("");
    const custom = ui.colors
      .filter((c) => !PRESET_COLORS.some((p) => p[0].toLowerCase() === c.name.toLowerCase()))
      .map(
        (c) =>
          `<button type="button" class="pe-chip on" data-pe-color="${ctx.esc(c.name)}" data-pe-hex="${ctx.esc(c.hex)}" title="${ctx.esc(c.name)}" aria-label="${ctx.esc(c.name)}"><i class="u-tint" data-sv="bg:${ctx.esc(c.hex)}"></i></button>`
      )
      .join("");
    const pickedNames = ui.colors.map((c) => `<b>${ctx.esc(colorLabel(c.name))}</b>`).join("، ");
    return `<div class="pe-chips">${chips}${custom}
      <label class="pe-chip pe-chip-add" title="${ctx.dt("لون آخر", "Autre couleur")}">+<input type="color" value="#8b5cf6" data-pe-custom-color aria-label="${ctx.dt("لون آخر", "Autre couleur")}"></label>
    </div>
    <p class="pe-picked">${pickedNames ? `${ctx.dt("المختار", "Choisies")}: ${pickedNames}` : ctx.dt("اضغط على الألوان المتوفرة لهذا المنتج", "Touchez les couleurs disponibles pour ce produit")}</p>`;
  }

  function choiceRowsHTML() {
    return ui.rows
      .map(
        (r, i) => `<div class="pe-row" data-pe-row="${i}">
        <input data-pe-value="${i}" value="${ctx.esc(r.value)}" placeholder="${ctx.dt("مثل 128 GB", "ex. 128 GB")}" dir="auto">
        <input type="number" data-pe-delta="${i}" value="${r.delta}" placeholder="0" inputmode="numeric" title="${ctx.dt("زيادة السعر", "Supplément")}">
        <input type="number" data-pe-stock="${i}" value="${r.stock}" min="0" inputmode="numeric" title="${ctx.dt("المخزون", "Stock")}">
        <button type="button" class="pe-x" data-pe-remove-row="${i}" aria-label="×">×</button>
      </div>`
      )
      .join("");
  }

  function gridHTML() {
    if (!ui.colors.length || !ui.rows.length) return "";
    const head = ui.colors.map((c) => `<th>${ctx.esc(colorLabel(c.name))}</th>`).join("");
    const body = ui.rows
      .map((r) => {
        const cells = ui.colors
          .map((c) => {
            const key = `${c.name}|${r.value}`;
            const stock = ui.grid[key] ?? Math.floor(r.stock / ui.colors.length);
            return `<td><input type="number" min="0" inputmode="numeric" data-pe-grid="${ctx.esc(key)}" value="${stock}"></td>`;
          })
          .join("");
        return `<tr><th dir="auto">${ctx.esc(r.value)}</th>${cells}</tr>`;
      })
      .join("");
    return `<div class="pe-grid-wrap"><p class="form-note">${ctx.dt("كم قطعة من كل لون؟", "Combien de pièces par couleur ?")}</p>
      <table class="pe-grid"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function choicesHTML(buffer) {
    const axes = AXES.map(
      ([v, ar, fr]) => `<option value="${v}" ${ui.axis === v ? "selected" : ""}>${ctx.dt(ar, fr)}</option>`
    ).join("");
    const body = ui.hasChoices
      ? `<div class="pe-choices">
          <div class="pe-field"><label>${ctx.dt("نوع الخيار", "Type de choix")}</label><select data-pe-axis>${axes}</select></div>
          <div class="pe-row pe-row-head"><span>${ctx.dt("القيمة", "Valeur")}</span><span>${ctx.dt("+ سعر", "+ prix")}</span><span>${ctx.dt("المخزون", "Stock")}</span><span></span></div>
          <div data-pe-rows>${choiceRowsHTML()}</div>
          <button type="button" class="btn btn-soft btn-sm" data-pe-add-row>+ ${ctx.dt("أضف خياراً", "Ajouter un choix")}</button>
          <div data-pe-grid-wrap>${gridHTML()}</div>
        </div>`
      : field(
          ctx.dt("الكمية المتوفرة", "Quantité disponible"),
          `<input type="number" min="0" inputmode="numeric" data-edit-path="stock" value="${ctx.esc(buffer.stock)}">`
        );
    return `<div class="pe-step pe-section">
      <div class="pe-section-head"><h4>${ctx.dt("الخيارات والمخزون", "Choix et stock")}</h4>
        <label class="toggle"><input type="checkbox" data-pe-has-choices ${ui.hasChoices ? "checked" : ""}><span></span></label>
        <span class="pe-toggle-label">${ctx.dt("له سعات أو مقاسات مختلفة", "Plusieurs tailles / capacités")}</span></div>
      ${body}</div>`;
  }

  function moreHTML(buffer) {
    const opt = (list, cur) => list.map((v) => `<option ${v === cur ? "selected" : ""}>${v}</option>`).join("");
    return `<details class="pe-more"><summary>${ctx.dt("تفاصيل أكثر (اختياري)", "Plus de détails (facultatif)")}</summary>
      <div class="pe-more-body">
        ${field(ctx.dt("الاسم بالفرنسية", "Nom en français"), `<input data-edit-path="title.fr" value="${ctx.esc(buffer.title?.fr || "")}" dir="ltr">`)}
        ${field(ctx.dt("الوصف", "Description"), `<textarea data-edit-path="description.ar" rows="3">${ctx.esc(buffer.description?.ar || "")}</textarea>`)}
        ${field(ctx.dt("الوصف بالفرنسية", "Description en français"), `<textarea data-edit-path="description.fr" rows="3" dir="ltr">${ctx.esc(buffer.description?.fr || "")}</textarea>`)}
        <div class="pe-two">
          ${field(ctx.dt("النوع", "Type"), `<select data-edit-path="type">${opt(PRODUCT_TYPES, buffer.type)}</select>`)}
          ${field(ctx.dt("الحالة", "État"), `<select data-edit-path="condition">${opt(PRODUCT_CONDITIONS, buffer.condition)}</select>`)}
          ${field(ctx.dt("صحة البطارية %", "Batterie %"), `<input type="number" data-edit-path="battery" value="${ctx.esc(buffer.battery ?? "")}" inputmode="numeric">`)}
          ${field(ctx.dt("الضمان (أشهر)", "Garantie (mois)"), `<input type="number" data-edit-path="warrantyMonths" value="${ctx.esc(buffer.warrantyMonths || 12)}" inputmode="numeric">`)}
          ${field(ctx.dt("العلامة", "Marque"), `<input data-edit-path="vendor" value="${ctx.esc(buffer.vendor || "")}">`)}
        </div>
        <p class="form-note" dir="ltr">${ctx.dt("رابط المنتج", "Lien")}: product?handle=<b data-pe-handle>${ctx.esc(buffer.handle)}</b></p>
        <details class="pe-advanced"><summary>${ctx.dt("للمبرمج (JSON)", "Pour le développeur (JSON)")}</summary>
          ${field(ctx.dt("المواصفات", "Spécifications"), `<textarea data-edit-path="specs" rows="8" data-json="raw" dir="ltr">${ctx.esc(JSON.stringify(buffer.specs || {}, null, 2))}</textarea>`)}
          ${field(ctx.dt("ماذا في العلبة", "Contenu de la boîte"), `<textarea data-edit-path="includes" rows="4" data-json="raw" dir="ltr">${ctx.esc(JSON.stringify(buffer.includes || [], null, 2))}</textarea>`)}
          ${field(
            ctx.dt("صور الألوان (اسم:رابط)", "Images couleurs (nom:URL)"),
            `<textarea data-edit-path="colorImages" rows="3" data-colormap dir="ltr">${ctx.esc(
              Object.entries(buffer.colorImages || {})
                .map(([k, v]) => `${k}:${v}`)
                .join("\n")
            )}</textarea>`
          )}
        </details>
      </div></details>`;
  }

  /** @param {any} buffer @param {string} categoryOptions `<option>` list */
  function productEditorMarkup(buffer, categoryOptions) {
    ui = uiFrom(buffer);
    return `<div class="pe">
      ${step(
        `<div class="pe-two">${field(
          ctx.dt("اسم المنتج", "Nom du produit"),
          `<input data-edit-path="title.ar" value="${ctx.esc(buffer.title?.ar || "")}" placeholder="${ctx.dt("مثل: iPhone 13 128 GB", "ex. iPhone 13 128 Go")}" autofocus>`,
          "pe-title"
        )}${field(
          ctx.dt("الفئة", "Catégorie"),
          `<select data-edit-path="collections.0"><option value="">—</option>${categoryOptions}</select>`
        )}</div>`
      )}
      ${step(`<div class="pe-two">
        ${field(ctx.dt("السعر (أوقية)", "Prix (MRU)"), `<input type="number" min="0" inputmode="numeric" data-edit-path="price" value="${ctx.esc(buffer.price || "")}">`)}
        ${field(ctx.dt("السعر قبل الخصم", "Prix barré"), `<input type="number" min="0" inputmode="numeric" data-edit-path="compare" value="${ctx.esc(buffer.compare || "")}" placeholder="${ctx.dt("اختياري", "facultatif")}">`)}
      </div>`)}
      ${step(`<div class="pe-media">
        <div><h4>${ctx.dt("الصور", "Photos")}</h4><div data-pe-images>${imagesHTML()}</div></div>
        <div><h4>${ctx.dt("الألوان", "Couleurs")}</h4><div data-pe-colors>${colorsHTML()}</div></div>
      </div>`)}
      ${choicesHTML(buffer)}
      ${step(ctx.editToggle(ctx.dt("ظاهر للزبائن في المتجر", "Visible dans la boutique"), "active", buffer.active !== false))}
      ${moreHTML(buffer)}
    </div>`;
  }

  /* ---------- behaviour ---------- */

  function repaint(root, what) {
    const target = root.querySelector(`[data-pe-${what}]`);
    if (!target) return;
    if (what === "images") target.innerHTML = imagesHTML();
    if (what === "colors") target.innerHTML = colorsHTML();
    if (what === "rows") target.innerHTML = choiceRowsHTML();
    if (what === "grid-wrap") target.innerHTML = gridHTML();
  }
  function refreshGrid(root) {
    repaint(root, "grid-wrap");
  }

  function toggleColor(root, name, hex) {
    const i = ui.colors.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
    if (i >= 0) ui.colors.splice(i, 1);
    else ui.colors.push({ name, hex });
    repaint(root, "colors");
    refreshGrid(root);
  }

  function addCustomColor(root, hex) {
    const name = prompt(ctx.dt("اسم اللون (كما سيراه الزبون)", "Nom de la couleur (vu par le client)"), "");
    if (!name) return;
    ui.colors.push({ name: name.trim(), hex });
    repaint(root, "colors");
    refreshGrid(root);
  }

  async function uploadImages(root, input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    for (const file of files) {
      try {
        const data = await ctx.resizeImage(file);
        const url = ctx.R.remote ? await ctx.R.uploadMedia(data) : data;
        if (url) ui.images.push(url);
      } catch (error) {
        ctx.toast(`${ctx.dt("تعذر رفع الصورة", "Échec du téléversement")}: ${error.message}`, "error");
      }
    }
    repaint(root, "images");
    ctx.toast(ctx.dt("تمت إضافة الصور", "Photos ajoutées"), "good");
  }

  const CLICKS = [
    {
      sel: "[data-pe-remove-img]",
      run: (root, el) => {
        ui.images.splice(Number(el.dataset.peRemoveImg), 1);
        repaint(root, "images");
      }
    },
    {
      sel: "[data-pe-img]",
      run: (root, el) => {
        const i = Number(el.dataset.peImg);
        if (i > 0) ui.images.unshift(...ui.images.splice(i, 1));
        repaint(root, "images");
      }
    },
    { sel: "[data-pe-color]", run: (root, el) => toggleColor(root, el.dataset.peColor, el.dataset.peHex) },
    {
      sel: "[data-pe-add-row]",
      run: (root) => {
        syncRows(root);
        ui.rows.push({ value: "", delta: 0, stock: 1 });
        repaint(root, "rows");
        refreshGrid(root);
        /** @type {HTMLInputElement | null} */ (root.querySelector(`[data-pe-value="${ui.rows.length - 1}"]`))?.focus();
      }
    },
    {
      sel: "[data-pe-remove-row]",
      run: (root, el) => {
        syncRows(root);
        ui.rows.splice(Number(el.dataset.peRemoveRow), 1);
        repaint(root, "rows");
        refreshGrid(root);
      }
    }
  ];

  function forgetGridRow(value) {
    for (const key of Object.keys(ui.grid)) if (key.endsWith(`|${value}`)) delete ui.grid[key];
  }

  /** Copy what is typed in the choice rows back into `ui` before any repaint. */
  function syncRows(root) {
    ui.rows.forEach((r, i) => {
      const v = /** @type {HTMLInputElement | null} */ (root.querySelector(`[data-pe-value="${i}"]`));
      const d = /** @type {HTMLInputElement | null} */ (root.querySelector(`[data-pe-delta="${i}"]`));
      const s = /** @type {HTMLInputElement | null} */ (root.querySelector(`[data-pe-stock="${i}"]`));
      if (v) r.value = v.value.trim();
      if (d) r.delta = Number(d.value) || 0;
      if (s) r.stock = Math.max(0, Number(s.value) || 0);
    });
    root.querySelectorAll("[data-pe-grid]").forEach((node) => {
      const cell = /** @type {HTMLInputElement} */ (node);
      ui.grid[cell.dataset.peGrid] = Math.max(0, Number(cell.value) || 0);
    });
  }

  /** @param {HTMLElement} root */
  function mountProductEditor(root) {
    root.addEventListener("click", (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      for (const { sel, run } of CLICKS) {
        const el = /** @type {HTMLElement | null} */ (target.closest(sel));
        if (el && root.contains(el)) {
          event.preventDefault();
          run(root, el);
          return;
        }
      }
    });
    root.addEventListener("change", (event) => {
      const el = /** @type {HTMLInputElement} */ (event.target);
      if (el.matches("[data-pe-upload]")) return void uploadImages(root, el);
      if (el.matches("[data-pe-custom-color]")) return addCustomColor(root, el.value);
      if (el.matches("[data-pe-has-choices]")) {
        ui.hasChoices = el.checked;
        if (ui.hasChoices && !ui.rows.length)
          ui.rows.push({ value: "", delta: 0, stock: Number(ctx.editBuffer?.stock || 1) });
        const section = el.closest(".pe-section");
        if (section) section.outerHTML = choicesHTML(ctx.editBuffer || {});
        return;
      }
      if (el.matches("[data-pe-axis]")) ui.axis = el.value;
    });
    // Rows feed the grid on `input` (while typing), never on `change`: a change fires on blur, and rebuilding the grid
    // at that moment would swallow the tap that caused the blur (the merchant taps a grid cell right after typing).
    root.addEventListener("input", (event) => {
      const el = /** @type {HTMLInputElement} */ (event.target);
      if (el.matches("[data-pe-value],[data-pe-stock]")) {
        const row = ui.rows[Number(el.dataset.peValue ?? el.dataset.peStock)];
        const oldValue = row?.value;
        syncRows(root);
        forgetGridRow(oldValue);
        forgetGridRow(row?.value);
        refreshGrid(root);
        return;
      }
      if (el.matches('[data-edit-path="title.ar"]')) {
        const handleNode = root.querySelector("[data-pe-handle]");
        if (handleNode && ctx.editBuffer && !ctx.editBuffer.id)
          handleNode.textContent = ctx.slugify(el.value) || ctx.editBuffer.handle;
      }
    });
  }

  /* ---------- read back into the product ---------- */

  /** @param {any} item product being saved (ctx.editBuffer) @param {HTMLElement} root */
  function readProductEditor(item, root) {
    syncRows(root);
    // A product without a photo still needs a picture on the storefront: keep the old one, else a neutral placeholder.
    item.images = ui.images.length ? ui.images.slice() : [item.image || PLACEHOLDER_IMAGE].filter(Boolean);
    item.image = item.images[0];
    item.colors = ui.colors.map((c) => ({ name: c.name, hex: c.hex }));
    const rows = ui.hasChoices ? ui.rows.filter((r) => r.value) : [];
    if (!rows.length) {
      item.options = [];
      item.variants = [];
      return;
    }
    const colors = item.colors.map((c) => c.name);
    const base = Number(item.price || 0);
    const variants = [];
    for (const r of rows) {
      for (const color of colors.length ? colors : [""]) {
        const stock = colors.length ? (ui.grid[`${color}|${r.value}`] ?? Math.floor(r.stock / colors.length)) : r.stock;
        variants.push({
          id: `${item.handle}_${[color, r.value].filter(Boolean).join("_")}`.replace(/\s+/g, "-").toLowerCase(),
          title: [color, r.value].filter(Boolean).join(" / "),
          o1: colors.length ? color : r.value,
          o2: colors.length ? r.value : null,
          color: color || null,
          storage: r.value,
          price_delta: r.delta,
          price: base + r.delta,
          stock,
          available: stock > 0
        });
      }
    }
    item.optionName = ui.axis;
    item.options = [
      ...(colors.length ? [{ name: "Color", values: colors }] : []),
      { name: ui.axis, values: rows.map((r) => r.value) }
    ];
    item.variants = variants;
    item.stock = variants.reduce((n, v) => n + v.stock, 0);
  }

  /** Lowercase latin slug of a title; Arabic-only titles yield "" (caller falls back to a generated id). */
  function slugify(text) {
    return String(text || "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }
  /** URL handle for a new product: from the French/Latin title when possible, unique among `products`. */
  function handleFromTitle(title, products) {
    const base = slugify(title?.fr) || slugify(title?.ar) || `p-${Date.now().toString(36)}`;
    const taken = new Set((products || []).map((p) => p.handle));
    let handle = base.length < 2 ? `${base}-1` : base;
    for (let n = 2; taken.has(handle); n += 1) handle = `${base}-${n}`;
    return handle;
  }
  void axisLabel;
}
