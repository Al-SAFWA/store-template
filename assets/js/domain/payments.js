// @ts-check
/** App-icon artwork for Mauritanian payment methods (footer, checkout, dashboard). */

export const PAYMENT_ICONS = {
  bankily: "assets/img/payments/bankily.png",
  masrvi: "assets/img/payments/masrvi.jpg",
  sedad: "assets/img/payments/sedad.png",
  click: "assets/img/payments/click.png",
  cash: "assets/img/payments/cod.svg",
  cod: "assets/img/payments/cod.svg"
};

const GENERIC_MARK = /assets\/img\/payments\/(bankily|masrvi|sedad|click)\.svg$/i;

/** @param {{ id?: string, image?: string, logo?: string } | null | undefined} payment */
export function paymentIcon(payment) {
  if (!payment) return "";
  const branded = PAYMENT_ICONS[payment.id] || "";
  const raw = payment.image || payment.logo || "";
  if (raw && !GENERIC_MARK.test(raw)) return raw;
  return branded || raw;
}
