// @ts-check
/* Ctrl+Alt+Y — live storefront probe (avoids Brave tab shortcuts). */

/** @param {StorefrontCtx} ctx */
export function install(ctx) {
  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || !event.altKey || event.shiftKey) return;
    if (event.code !== "KeyY" && event.key !== "y" && event.key !== "Y") return;
    const typing = /** @type {HTMLElement | null} */ (event.target)?.closest?.(
      "input, textarea, select, [contenteditable]"
    );
    if (typing) return;
    event.preventDefault();
    showReport(buildReport(ctx));
  });

  function row(pass, id, detail) {
    return { pass: Boolean(pass), id, detail: String(detail ?? "") };
  }

  function textOf(sel) {
    return (document.querySelector(sel)?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function pageName() {
    return document.body?.dataset.page || "";
  }

  function brandCheck(c) {
    const name = c.L(c.SET.storeName);
    const legacyAr = String.fromCharCode(0x0631, 0x064a, 0x0633, 0x062a, 0x0648, 0x0631);
    return row(Boolean(name) && !name.includes(legacyAr), "brand-name", name);
  }

  function catCardsCheck() {
    const page = pageName();
    const cats = document.querySelectorAll(".cat-card");
    return row(
      cats.length > 0 || page !== "home",
      "cat-cards",
      page === "home" ? `${cats.length} on home` : `n/a on ${page}`
    );
  }

  function catAnimCheck() {
    const page = pageName();
    const card = document.querySelector(".cat-card");
    const anim = card ? getComputedStyle(card).animationName : "";
    const ready = Boolean(document.querySelector(".categories.is-in")) && Boolean(anim) && anim !== "none";
    return row(page !== "home" || ready, "cat-animation", page === "home" ? anim || "none" : `n/a on ${page}`);
  }

  function socialCheck() {
    const hrefs = [...document.querySelectorAll(".socials a[href]")]
      .map((a) => `${a.getAttribute("aria-label") || "social"}=${a.getAttribute("href")}`)
      .join(" ");
    const ok =
      pageName() === "dashboard" || (/facebook/i.test(hrefs) && /instagram/i.test(hrefs) && /tiktok/i.test(hrefs));
    return row(ok, "socials", hrefs || "none");
  }

  function dashCatCheck() {
    const page = pageName();
    const edit = document.querySelector(".ct-edit");
    const ok =
      page !== "dashboard" || !document.querySelector(".ct") || Boolean(edit && document.querySelector(".ct-del"));
    return row(ok, "dash-cat-buttons", edit ? "edit+delete" : page === "dashboard" ? "open #categories" : "n/a");
  }

  function probeRows(c) {
    const page = pageName();
    const nav = textOf(".main-nav");
    const trust = textOf(".trust-bar") || textOf(".home-trust");
    const forms = document.querySelectorAll("#checkout-form").length;
    const collections = (c.S.collections || []).filter((x) => x.visible !== false);
    return [
      brandCheck(c),
      catCardsCheck(),
      catAnimCheck(),
      row(!document.querySelector("a.renewed"), "no-renewed-strip", "ok"),
      row(!/anniversary/i.test(nav), "nav-offers", nav.slice(0, 120) || "(empty nav)"),
      row(page !== "home" || /إرجاع|retour|return/i.test(trust), "return-days", String(c.SET.returnDays)),
      row(collections.length > 0, "collections", collections.map((x) => x.handle).join(",") || "none"),
      socialCheck(),
      row(
        page !== "checkout" || forms === 1,
        "checkout-one-form",
        page === "checkout" ? `forms=${forms}` : "open checkout.html"
      ),
      row(!document.body.innerHTML.includes("RESTORE10"), "no-restore-coupon", window.BRAND?.couponPrefix || ""),
      row(
        Boolean(document.querySelector(".site-header") && document.querySelector(".footer")),
        "header-footer",
        "present"
      ),
      row(c.PRODUCTS.length > 0, "products", String(c.PRODUCTS.length)),
      dashCatCheck()
    ];
  }

  function buildReport(c) {
    const rows = probeRows(c);
    const pass = rows.filter((r) => r.pass).length;
    const fail = rows.length - pass;
    const lines = [
      "STORE PROBE",
      `time ${new Date().toISOString()}`,
      `page ${pageName()}  url ${location.href}`,
      `brand ${c.L(c.SET.storeName)}`,
      `score ${pass}/${rows.length}  fail ${fail}`,
      "",
      ...rows.map((r) => `${r.pass ? "PASS" : "FAIL"}  ${r.id}  ${r.detail}`),
      "",
      "Paste this block back in chat."
    ];
    return { text: lines.join("\n"), pass, fail, total: rows.length };
  }

  function showReport(report) {
    document.getElementById("store-probe")?.remove();
    const wrap = document.createElement("div");
    wrap.id = "store-probe";
    wrap.className = "store-probe";
    wrap.innerHTML = `<div class="store-probe-card" role="dialog" aria-modal="true" aria-labelledby="store-probe-title">
      <div class="store-probe-head">
        <h2 id="store-probe-title">${ctx.esc(ctx.R.lang === "ar" ? "تقرير الاختبار" : "Rapport de test")}</h2>
        <div class="store-probe-actions">
          <button type="button" class="btn btn-primary" data-probe-copy>${ctx.esc(ctx.R.lang === "ar" ? "نسخ" : "Copier")}</button>
          <button type="button" class="btn btn-outline" data-probe-close>${ctx.esc(ctx.R.lang === "ar" ? "إغلاق" : "Fermer")}</button>
        </div>
      </div>
      <pre>${ctx.esc(report.text)}</pre>
      <p class="store-probe-hint">${ctx.esc(ctx.R.lang === "ar" ? "Ctrl+Alt+Y — انسخ التقرير وأرسله." : "Ctrl+Alt+Y — copiez le rapport et envoyez-le.")}</p>
    </div>`;
    const close = () => wrap.remove();
    wrap.addEventListener("click", (event) => {
      const t = /** @type {HTMLElement} */ (event.target);
      if (t === wrap || t.closest("[data-probe-close]")) close();
      if (t.closest("[data-probe-copy]")) copyText(report.text, t.closest("[data-probe-copy]"));
    });
    document.addEventListener("keydown", function onEsc(event) {
      if (event.key !== "Escape") return;
      close();
      document.removeEventListener("keydown", onEsc);
    });
    document.body.appendChild(wrap);
  }

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.className = "store-probe-clip";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    if (btn) btn.textContent = ctx.R.lang === "ar" ? "تم النسخ" : "Copié";
  }
}
