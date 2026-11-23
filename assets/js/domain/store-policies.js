// @ts-check
/* Return window + “no-risk” badge — pure helpers over settings. */

import { siteSettingVisible, siteText } from "./site-settings.js";

const DEFAULT_DAYS = 10;
const MIN_DAYS = 1;
const MAX_DAYS = 90;

export function clampReturnDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < MIN_DAYS) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.round(n));
}

export function isReturnEnabled(settings) {
  return settings?.returnEnabled !== false;
}

export function isNoRiskVisible(settings) {
  return settings?.noRisk?.visible !== false;
}

/** Replaces `{returnDays}` and hardcoded “10 days” copy with the live setting. */
export function applyReturnDays(text, days) {
  const n = clampReturnDays(days);
  return String(text ?? "")
    .replaceAll("{returnDays}", String(n))
    .replaceAll("10 أيام", `${n} أيام`)
    .replaceAll("10 jours", `${n} jours`)
    .replaceAll("10 days", `${n} days`);
}

export function returnLabel(settings, lang) {
  if (!isReturnEnabled(settings)) return "";
  const n = clampReturnDays(settings?.returnDays);
  return lang === "fr" ? `Retour sous ${n} jours` : `إرجاع خلال ${n} أيام`;
}

const TRUST_ICON_SETTING = {
  truck: "free_delivery",
  shield: "warranty_label",
  badgeCheck: "checked_experts"
};

/** Trust-bar / footer line for one item, honouring dashboard show/hide. Empty = skip. */
export function trustItemText(settings, item, lang, fallback) {
  if (!item) return "";
  if (item.icon === "return") {
    if (!isReturnEnabled(settings)) return "";
    return returnLabel(settings, lang) || applyReturnDays(fallback, settings?.returnDays);
  }
  const key = TRUST_ICON_SETTING[item.icon];
  if (!key) return applyReturnDays(fallback, settings?.returnDays);
  if (!siteSettingVisible(settings, key)) return "";
  return siteText(settings, key, lang) || applyReturnDays(fallback, settings?.returnDays);
}
