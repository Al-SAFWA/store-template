// @ts-check
/* state.js → Published state, drafts and remote polling
   Extracted mechanically from the former monolith; shared state lives on `ctx` (see state.js). */

import {
  applySiteSettingsToState,
  mergeSiteSettings,
  SITE_SETTING_DEFS,
  siteSettingsToRows
} from "../domain/site-settings.js";

export function install(ctx) {
  Object.assign(ctx, {
    pushPublishedState,
    publish,
    saveDraft,
    discardDraft,
    useDraft,
    resetLocalDemo,
    loadRemoteState
  });
  async function pushPublishedState(next) {
    if (!ctx.REMOTE) return;
    if (!(await ctx.remoteSessionValid())) throw new Error(ctx.sessionLostMessage());
    const rows = await ctx.supa(
      `/rest/v1/${ctx.CFG.stateTable}?select=updated_at`,
      {
        method: "POST",
        body: JSON.stringify({ id: "main", data: next, updated_at: next.updatedAt }),
        headers: { Prefer: "resolution=merge-duplicates,return=representation" }
      },
      true
    );
    // The DB trigger restore_set_updated_at replaces updated_at with the server clock. Return that stamp so the
    // caller stores it locally; otherwise the next poll sees "remote newer than local" forever (demo1 reload loop).
    const stamp = Array.isArray(rows) ? rows[0]?.updated_at : null;
    if (stamp) next.updatedAt = stamp;
    return stamp || null;
  }

  async function pushSiteSettings(settings) {
    const table = ctx.CFG.siteSettingsTable || "site_settings";
    try {
      await ctx.supa(
        `/rest/v1/${table}`,
        {
          method: "POST",
          body: JSON.stringify(siteSettingsToRows(settings)),
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" }
        },
        true
      );
    } catch (error) {
      console.warn("Restore: site_settings sync skipped", error);
    }
  }

  async function overlaySiteSettingsTable(staff) {
    // A draft means the merchant still has unpublished banner/text edits. Overlaying
    // public.site_settings (often still the seed copy) would snap those fields back.
    if (ctx.draft) return false;
    const table = ctx.CFG.siteSettingsTable || "site_settings";
    try {
      const rows = await ctx.supa(`/rest/v1/${table}?select=key,value,is_visible`, {}, staff);
      if (!Array.isArray(rows) || !rows.length) return false;
      const before = JSON.stringify(ctx.state.settings.siteSettings);
      const fromTable = {};
      for (const row of rows) {
        if (!row?.key) continue;
        fromTable[row.key] = { value: row.value, is_visible: row.is_visible !== false };
      }
      const merged = mergeSiteSettings(ctx.state.settings.siteSettings);
      for (const [key, row] of Object.entries(fromTable)) merged[key] = row;
      if (!staff) {
        for (const def of SITE_SETTING_DEFS) {
          if (!(def.key in fromTable)) merged[def.key] = { ...merged[def.key], is_visible: false };
        }
      }
      ctx.state.settings.siteSettings = merged;
      applySiteSettingsToState(ctx.state.settings, ctx.lang);
      return before !== JSON.stringify(ctx.state.settings.siteSettings);
    } catch {
      return false;
    }
  }

  async function publish(next = ctx.state) {
    const candidate = ctx.hydrate(ctx.clone(next));
    candidate.updatedAt = ctx.nowISO();
    candidate.version = Number(candidate.version || 0) + 1;
    if (ctx.REMOTE) {
      if (!(await ctx.remoteSessionValid())) throw new Error(ctx.sessionLostMessage());
      // Catalog entities live in relational tables; never write them into restore_state.data.
      const stamp = await pushPublishedState(
        ctx.catalogInfo.source === "tables" ? ctx.stripCatalog(candidate) : candidate
      );
      if (stamp) candidate.updatedAt = stamp;
      candidate.publishedAt = candidate.updatedAt;
      await pushSiteSettings(candidate.settings);
    }
    if (ctx.catalogInfo.source === "tables") {
      // keep the in-memory/published copy consistent with the tables, not with the draft
      candidate.products = ctx.state.products;
      candidate.collections = ctx.state.collections;
      candidate.settings = { ...candidate.settings, coupons: ctx.state.settings?.coupons || [] };
    }
    ctx.state = candidate;
    const stored = ctx.writeJSON(ctx.LS_STATE, ctx.state);
    if (!stored) throw new Error("تعذر حفظ البيانات محليًا. مساحة التخزين ممتلئة.");
    localStorage.removeItem(ctx.LS_DRAFT);
    ctx.draft = null;
    ctx.applyDocument();
    ctx.channel?.postMessage({ type: "state", updatedAt: ctx.state.updatedAt });
    window.dispatchEvent(new CustomEvent("restore:changed", { detail: { source: "publish" } }));
    return ctx.state;
  }
  function saveDraft(next = ctx.state) {
    const candidate = ctx.hydrate(ctx.clone(next));
    candidate.updatedAt = ctx.nowISO();
    ctx.draft = candidate;
    ctx.writeJSON(ctx.LS_DRAFT, ctx.draft);
    return ctx.draft;
  }
  function discardDraft() {
    localStorage.removeItem(ctx.LS_DRAFT);
    ctx.draft = null;
  }
  function useDraft() {
    if (!ctx.draft) return ctx.state;
    ctx.state = ctx.hydrate(ctx.clone(ctx.draft));
    ctx.applyDocument();
    return ctx.state;
  }
  function resetLocalDemo() {
    [
      ctx.LS_STATE,
      ctx.LS_DRAFT,
      ctx.LS_MANAGERS,
      ctx.LS_ORDERS,
      ctx.LS_ABANDONED,
      ctx.LS_AUDIT,
      ctx.LS_SESSION,
      ctx.LS_REMEMBER,
      ctx.LS_CUSTOMERS,
      ctx.LS_REVIEWS,
      ctx.LS_CUSTOMER,
      ctx.LS_CUSTOMER_SESSION,
      ctx.LS_LOGIN_ATTEMPTS
    ].forEach((key) => localStorage.removeItem(key));
    try {
      sessionStorage.removeItem(ctx.LS_SESSION);
    } catch {}
    ctx.tokenVault.accessToken = "";
    ctx.tokenVault.refreshToken = "";
    location.reload();
  }
  /** Server stamp of a published row (trigger-set updated_at, falling back to the publisher's clock). */
  function remoteStampOf(remote) {
    return remote.updated_at || remote.data?.updatedAt || "";
  }
  /** True when the published row is newer than the publish this browser last APPLIED. The comparison is
      against publishedAt, never updatedAt: the built-in demo state, a stock decrement after an order and the
      catalog overlay all stamp updatedAt with "now", which made every publish look older and left fresh
      visitors on the demo WhatsApp/phone forever. */
  function remoteIsNewer(remote) {
    const remoteStamp = Date.parse(remoteStampOf(remote)) || 0;
    const appliedStamp = Date.parse(ctx.state.publishedAt || 0) || 0;
    return !appliedStamp || remoteStamp > appliedStamp;
  }
  /** Replaces the local state with the published row and records which publish was applied. */
  function adoptRemoteState(remote) {
    ctx.state = ctx.hydrate(remote.data);
    // Adopt the SERVER stamp: data.updatedAt is the publishing browser's clock and is always older than the
    // trigger-set updated_at, so keeping it would make the poll fire on every tick.
    if (remote.updated_at) ctx.state.updatedAt = remote.updated_at;
    ctx.state.publishedAt = remoteStampOf(remote) || ctx.nowISO();
    ctx.writeJSON(ctx.LS_STATE, ctx.state);
  }
  async function loadRemoteState() {
    if (!ctx.REMOTE) return false;
    try {
      const rows = await ctx.supa(`/rest/v1/${ctx.CFG.stateTable}?id=eq.main&select=id,data,updated_at`);
      const remote = Array.isArray(rows) ? rows[0] : null;
      const staff = ctx.session?.mode === "supabase";
      let adopted = false;
      if (remote?.data && remoteIsNewer(remote) && !ctx.draft) {
        adoptRemoteState(remote);
        adopted = true;
      }
      const overlayed = await overlaySiteSettingsTable(staff);
      if (adopted && ctx.catalogInfo.source !== "state") await ctx.loadCatalog({ staff, silent: true });
      if (adopted || overlayed) {
        ctx.applyDocument();
        window.dispatchEvent(new CustomEvent("restore:changed", { detail: { source: "remote" } }));
      }
      return adopted || overlayed;
    } catch (error) {
      console.warn("Restore: state sync failed", error);
      return false;
    }
  }
}
