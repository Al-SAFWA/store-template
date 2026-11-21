// @ts-check
/* dashboard.js → Publish (one tap since 1.17.2), preview and draft lifecycle
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see dashboard.js). */

/** @param {DashboardCtx} ctx */
export function install(ctx) {
  Object.assign(ctx, { publishNow });
  /** 1.17.2 — one tap: no confirmation modal (merchants publish many times a day; preview is a separate button). */
  async function publishNow() {
    if (ctx.publishing) return;
    ctx.publishing = true;
    ctx.saveDraftNow();
    const buttons = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll("[data-action='publish']")]);
    buttons.forEach((b) => {
      b.disabled = true;
      b.dataset.label = b.innerHTML;
      b.textContent = ctx.dt("جارٍ النشر...", "Publication...");
    });
    const restore = () =>
      buttons.forEach((b) => {
        b.disabled = false;
        if (b.dataset.label) b.innerHTML = b.dataset.label;
      });
    try {
      const published = await ctx.R.publish(ctx.model);
      ctx.model = ctx.clone(published);
      ctx.dirty = false;
      ctx.closeModal();
      restore();
      ctx.renderRoute();
      ctx.updateDraftState();
      ctx.R.addAudit(ctx.dt("نشر تحديث المتجر", "Publication de la boutique"));
      ctx.toast(ctx.dt("تم نشر التغييرات في المتجر", "Changements publiés sur la boutique"), "good");
    } catch (error) {
      ctx.toast(error.message || String(error), "error");
      restore();
    } finally {
      ctx.publishing = false;
    }
  }
}
