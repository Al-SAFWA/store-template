// @ts-check
/* dashboard.js → Texts & badges (site_settings keys). One list: value + show/hide. */

import { SITE_SETTING_DEFS, mergeSiteSettings } from "../../domain/site-settings.js";

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { viewSiteTexts });

  function rows() {
    const settings = ctx.model.settings;
    settings.siteSettings = mergeSiteSettings(settings.siteSettings);
    return settings.siteSettings;
  }

  function input(path, value, { type = "text", dir = "", placeholder = "", inputmode = "" } = {}) {
    const attrs = [
      `data-path="${ctx.esc(path)}"`,
      `type="${type}"`,
      `value="${ctx.esc(value ?? "")}"`,
      dir ? `dir="${dir}"` : "",
      placeholder ? `placeholder="${ctx.esc(placeholder)}"` : "",
      inputmode ? `inputmode="${inputmode}"` : ""
    ]
      .filter(Boolean)
      .join(" ");
    return `<input ${attrs}>`;
  }

  function field(def) {
    const row = rows()[def.key] || { value: def.defaultValue, is_visible: def.defaultVisible };
    const base = `settings.siteSettings.${def.key}`;
    const valueFields =
      def.kind === "number"
        ? `<label class="si-field"><span>${ctx.esc(ctx.dt(def.ar, def.fr))}</span>${input(`${base}.value`, row.value ?? def.defaultValue, { type: "number", dir: "ltr", inputmode: "numeric" })}</label>`
        : `<label class="si-field"><span>${ctx.esc(ctx.dt(def.ar, def.fr))} · AR</span>${input(`${base}.value.ar`, row.value?.ar || "", { dir: "rtl" })}</label>
           <label class="si-field"><span>${ctx.esc(ctx.dt(def.ar, def.fr))} · FR</span>${input(`${base}.value.fr`, row.value?.fr || "", { dir: "ltr" })}</label>`;
    return `<section class="pe-step">
      <h4>${ctx.esc(ctx.dt(def.ar, def.fr))}</h4>
      ${ctx.directToggle(ctx.dt("إظهار في المتجر", "Afficher sur la boutique"), `${base}.is_visible`, row.is_visible !== false)}
      ${valueFields}
      ${def.hintAr ? `<p class="form-note">${ctx.esc(ctx.dt(def.hintAr, def.hintFr || def.hintAr))}</p>` : ""}
    </section>`;
  }

  function viewSiteTexts() {
    return `
      <div class="dash-view-head">
        <div><h2>${ctx.dt("النصوص والشارات", "Textes et badges")}</h2><p>${ctx.dt("كل شارة أو نص تسويقي: غيّر النص، أخفه، أو اتركه. يُحفظ في المسودة؛ اضغط «نشر» ليظهر للزبون.", "Chaque badge ou texte : modifiez, masquez ou laissez. Enregistré en brouillon ; publiez pour le client.")}</p></div>
      </div>
      <div class="pe si">${SITE_SETTING_DEFS.map(field).join("")}</div>`;
  }
}
