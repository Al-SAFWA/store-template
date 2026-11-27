// @ts-check
/* state.js → Default content (part 2)
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */

export function install(ctx) {
  Object.assign(ctx, { applyDocument });
  const FONT_STACKS = {
    Montserrat: '"Cairo", "Montserrat", "Noto Sans Arabic", system-ui, sans-serif',
    Inter: '"Inter", "Noto Sans Arabic", system-ui, sans-serif',
    Roboto: '"Roboto", "Noto Sans Arabic", system-ui, sans-serif',
    "Open Sans": '"Open Sans", "Noto Sans Arabic", system-ui, sans-serif',
    Poppins: '"Poppins", "Noto Sans Arabic", system-ui, sans-serif',
    "Noto Sans": '"Noto Sans", "Noto Sans Arabic", system-ui, sans-serif',
    Tajawal: '"Tajawal", "Noto Sans Arabic", system-ui, sans-serif',
    Cairo: '"Cairo", "Noto Sans Arabic", system-ui, sans-serif',
    Amiri: '"Amiri", "Noto Naskh Arabic", serif',
    "System UI": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Arabic", sans-serif'
  };

  function resolvedColors() {
    const raw = window.BRAND && window.BRAND.colors;
    const brand = /** @type {{ primary?: string, purple?: string, lavender?: string, ink?: string }} */ (
      raw && typeof raw === "object" ? raw : {}
    );
    const saved = ctx.state.settings.colors || {};
    const primary = String(saved.primary || "").toLowerCase();
    if (primary && primary !== "#ff6400") return saved;
    return {
      primary: brand.primary || "#7c3aed",
      purple: brand.purple || "#d946ef",
      lavender: brand.lavender || "#f3e8ff",
      ink: brand.ink || "#1a1028"
    };
  }

  function applyDocument() {
    const html = document.documentElement;
    const dashboard = document.body?.dataset.page === "dashboard";
    if (!dashboard) {
      html.lang = ctx.lang;
      html.dir = ctx.lang === "ar" ? "rtl" : "ltr";
      html.dataset.lang = ctx.lang;
    }
    html.dataset.theme = ctx.theme;
    const colors = resolvedColors();
    if (colors.primary) html.style.setProperty("--orange", colors.primary);
    if (colors.ink && ctx.theme !== "dark") html.style.setProperty("--ink", colors.ink);
    else html.style.removeProperty("--ink");
    if (colors.purple) html.style.setProperty("--purple", colors.purple);
    if (colors.lavender && ctx.theme !== "dark") html.style.setProperty("--lav", colors.lavender);
    else html.style.removeProperty("--lav");
    if (ctx.state.settings.radius != null) html.style.setProperty("--radius", `${ctx.state.settings.radius}px`);
    const font = ctx.state.settings.font || "Montserrat";
    const fontStack = FONT_STACKS[font] || FONT_STACKS["Montserrat"];
    html.style.setProperty("--font-main", fontStack);
  }

  function isStaleRestoreDemo(saved) {
    if (!saved || !ctx.LOCAL_DEV || ctx.REMOTE) return false;
    if ((window.BRAND?.key || "") !== "demo") return false;
    const name = `${saved.settings?.storeName?.ar || ""} ${saved.settings?.storeName?.fr || ""}`;
    const legacyAr = String.fromCharCode(0x0631, 0x064a, 0x0633, 0x062a, 0x0648, 0x0631);
    return name.includes(legacyAr) || /\bRestore\b/i.test(name);
  }

  const savedState = ctx.readJSON(ctx.LS_STATE, null);
  const dropSaved = isStaleRestoreDemo(savedState);
  ctx.state = ctx.hydrate(dropSaved ? null : savedState);
  if (dropSaved) {
    ctx.writeJSON(ctx.LS_STATE, ctx.state);
    try {
      localStorage.removeItem(ctx.LS_DRAFT);
    } catch {}
  }
  ctx.draft = null;
  {
    const savedDraft = dropSaved ? null : ctx.readJSON(ctx.LS_DRAFT, null);
    if (savedDraft) ctx.draft = ctx.hydrate(savedDraft);
  }
  const startedAt = Date.now();
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(ctx.SYNC_CHANNEL) : null;
  Object.assign(ctx, { FONT_STACKS, savedState, startedAt, channel });
}
