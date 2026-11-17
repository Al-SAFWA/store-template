// @ts-check
/* state.js → Staff session storage helpers (1.13)
   "Remember this device" (opt-in refresh token in localStorage) and the cross-tab channel that shares refreshed
   tokens / logout between open tabs. Used by 04-staff-auth.js. */

/** @param {any} ctx */
export function install(ctx) {
  function readRemembered() {
    try {
      const raw = localStorage.getItem(ctx.LS_REMEMBER);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.refreshToken && parsed?.meta?.mode === "supabase") return parsed;
    } catch {}
    return null;
  }
  function writeRemembered(session) {
    try {
      if (session && ctx.rememberDevice && session.mode === "supabase" && ctx.tokenVault.refreshToken) {
        localStorage.setItem(
          ctx.LS_REMEMBER,
          JSON.stringify({ meta: ctx.sessionMetaOf(session), refreshToken: ctx.tokenVault.refreshToken })
        );
      } else localStorage.removeItem(ctx.LS_REMEMBER);
    } catch {}
  }
  /** Cross-tab channel: a refreshed token in one tab must reach the others (Supabase rotates refresh tokens). */
  let channel = null;
  try {
    // Browser only: under Node (unit tests) an open channel would keep the process alive.
    channel =
      typeof window !== "undefined" && typeof BroadcastChannel === "function"
        ? new BroadcastChannel(ctx.SESSION_CHANNEL)
        : null;
    // Node's BroadcastChannel (jsdom tests) would otherwise keep the process alive.
    if (channel && typeof (/** @type {any} */ (channel).unref) === "function") /** @type {any} */ (channel).unref();
  } catch {}
  function broadcastSession(type, payload) {
    try {
      channel?.postMessage({ type, ...payload, from: ctx.tabId });
    } catch {}
  }
  ctx.tabId = Math.random().toString(36).slice(2);
  channel?.addEventListener("message", (event) => {
    const msg = event.data || {};
    if (msg.from === ctx.tabId) return;
    if (msg.type === "tokens" && ctx.session?.mode === "supabase") {
      ctx.tokenVault.accessToken = msg.accessToken || ctx.tokenVault.accessToken;
      ctx.tokenVault.refreshToken = msg.refreshToken || ctx.tokenVault.refreshToken;
      ctx.session = {
        ...ctx.session,
        accessToken: ctx.tokenVault.accessToken,
        refreshToken: ctx.tokenVault.refreshToken,
        expiresAt: msg.expiresAt || ctx.session.expiresAt
      };
      ctx.writeSessionMeta(ctx.sessionMetaOf(ctx.session));
      ctx.scheduleSessionRefresh();
    } else if (msg.type === "logout" && ctx.session) {
      ctx.persistSession(null, { silent: true });
      window.dispatchEvent(new CustomEvent("restore:logout", { detail: { reason: msg.reason || "other-tab" } }));
    }
  });

  function restoreRememberedSession() {
    ctx.session = ctx.readSessionMeta();
    ctx.rememberDevice = false;
    // Supabase tokens are never kept in sessionStorage; after a reload a remote session must re-authenticate —
    // unless the merchant opted in to "remember this device" (1.13): then the refresh token lives in localStorage
    // and the first remote call exchanges it for a fresh access token.
    if (ctx.session?.mode === "supabase" || (!ctx.session && ctx.REMOTE)) {
      const remembered = ctx.readRemembered();
      if (remembered) {
        ctx.rememberDevice = true;
        ctx.session = { ...remembered.meta, expiresAt: 1 };
        ctx.tokenVault.accessToken = "";
        ctx.tokenVault.refreshToken = remembered.refreshToken;
        ctx.writeSessionMeta(ctx.sessionMetaOf(ctx.session));
      } else {
        ctx.session = null;
        ctx.writeSessionMeta(null);
      }
    }
  }
  Object.assign(ctx, { readRemembered, writeRemembered, broadcastSession, restoreRememberedSession });
}
