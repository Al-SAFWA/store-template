// @ts-check
/* Return window + “no-risk” badge — pure helpers over settings. */

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
