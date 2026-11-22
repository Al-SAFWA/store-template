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

  function buildReport(c) {
    const page = document.body?.dataset.page || "";
    const name = c.L(c.SET.storeName);
    const legacyAr = String.fromCharCode(0x0631, 0x064a, 0x0633, 0x062a, 0x0648, 0x0631);
    const cats = [...document.querySelectorAll(".cat-card")];
    const anim = cats[0] ? getComputedStyle(cats[0]).animationName : "";
    const animDur = cats[0] ? getComputedStyle(cats[0]).animationDuration : "";
    const socials = [...document.querySelectorAll(".socials a[href]")]
      .map((a) => `${a.getAttribute("aria-label") || "social"}=${a.getAttribute("href")}`)
      .filter((s) => !s.endsWith("="));
    const nav = textOf(".main-nav");
    const trust = textOf(".trust-bar") || textOf(".home-trust");
    const returnDays = c.SET.returnDays;
    const sections = (c.SET.pageSections || []).filter((s) => s.visible !== false).map((s) => s.id);
    const collections = (c.S.collections || []).filter((x) => x.visible !== false);
    const forms = document.querySelectorAll("#checkout-form").length;
    const rows = [
      row(Boolean(name) && !name.includes(legacyAr) && !/Resto\u0072e/i.test(name), "brand-name", name),
      row(
        cats.length > 0 || page !== "home",
        "cat-cards",
        page === "home" ? `${cats.length} on home` : `n/a on ${page}`
      ),
      row(
        page !== "home" || (Boolean(document.querySelector(".categories.is-in")) && Boolean(anim) && anim !== "none"),
        "cat-animation",
        page === "home"
          ? `in=${Boolean(document.querySelector(".categories.is-in"))} ${anim || "none"} ${animDur}`
          : `n/a on ${page}`
      ),
      row(!document.querySelector("a.renewed"), "no-renewed-strip", `pageSections=${sections.join(",")}`),
      row(!/anniversary/i.test(nav), "nav-offers", nav.slice(0, 120) || "(empty nav)"),
      row(
        page !== "home" || /إرجاع|retour|return/i.test(trust),
        "return-days",
        `returnDays=${returnDays} trust="${trust.slice(0, 80)}"`
      ),
      row(collections.length > 0, "collections", collections.map((x) => x.handle).join(",") || "none"),
      row(
        page === "dashboard" ||
          (/facebook/i.test(socials.join(" ")) &&
            /instagram/i.test(socials.join(" ")) &&
            /tiktok/i.test(socials.join(" "))),
        "socials",
        socials.join(" | ") || "none"
      ),
      row(
        page !== "checkout" || forms === 1,
        "checkout-one-form",
        page === "checkout" ? `forms=${forms}` : "open checkout.html to verify"
      ),
      row(!document.body.innerHTML.includes("RESTORE10"), "no-restore-coupon", window.BRAND?.couponPrefix || ""),
      row(
        Boolean(document.querySelector(".site-header")) && Boolean(document.querySelector(".footer")),
        "header-footer",
        "present"
      ),
      row(c.PRODUCTS.length > 0, "products", String(c.PRODUCTS.length)),
      row(
        page !== "dashboard" ||
          !document.querySelector(".ct") ||
          Boolean(document.querySelector(".ct-edit") && document.querySelector(".ct-del")),
        "dash-cat-buttons",
        document.querySelector(".ct-edit") ? "edit+delete" : page === "dashboard" ? "open #categories" : "n/a"
      )
    ];
    const pass = rows.filter((r) => r.pass).length;
    const fail = rows.filter((r) => !r.pass).length;
    const lines = [
      "STORE PROBE",
      `time ${new Date().toISOString()}`,
      `page ${page}  url ${location.href}`,
      `brand ${name}`,
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
      wrapSafe(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    if (btn) btn.textContent = ctx.R.lang === "ar" ? "تم النسخ" : "Copié";
  }

  function wrapSafe(area) {
    area.className = "store-probe-clip";
    document.body.appendChild(area);
  }
}
