import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../assets/css/restore.css", import.meta.url), "utf8");
const home = readFileSync(new URL("../assets/js/ui/storefront/09-home.js", import.meta.url), "utf8");
const sections = readFileSync(new URL("../assets/js/ui/storefront/10-home-sections.js", import.meta.url), "utf8");
const cats = readFileSync(new URL("../assets/js/ui/dashboard/08-categories.js", import.meta.url), "utf8");
const header = readFileSync(new URL("../assets/js/ui/storefront/04-header-footer.js", import.meta.url), "utf8");
const checkout = readFileSync(new URL("../assets/js/ui/storefront/12a-checkout-markup.js", import.meta.url), "utf8");
const products = readFileSync(new URL("../assets/js/ui/dashboard/07-products.js", import.meta.url), "utf8");
const orders = readFileSync(new URL("../assets/js/ui/dashboard/05b-orders-cards.js", import.meta.url), "utf8");
const restoreCss = css;
const probe = readFileSync(new URL("../assets/js/ui/storefront/17-store-probe.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../assets/js/app.js", import.meta.url), "utf8");

test("cat-bar animation starts only after .is-in (when the strip is on screen)", () => {
  assert.match(css, /@keyframes cat-in\b/);
  assert.match(css, /@keyframes cat-in-rtl\b/);
  const rest = css.slice(css.indexOf(".categories .cat-card {"), css.indexOf(".categories.is-in .cat-card"));
  assert.match(rest, /animation:\s*none/);
  assert.match(css, /\.categories\.is-in \.cat-card \{[^}]*animation:\s*cat-in/);
  assert.match(home, /section\.classList\.add\("is-in"\)/);
  assert.match(home, /IntersectionObserver/);
  assert.match(sections, /class="categories"/);
  assert.equal(sections.includes('class="categories reveal"'), false);
});

test("observeReveals waits two frames before .in so the fade can paint", () => {
  assert.match(home, /requestAnimationFrame\(\(\) => requestAnimationFrame/);
});

test("dashboard category cards expose labeled edit and delete", () => {
  assert.match(cats, /data-action="edit-category"/);
  assert.match(cats, /data-action="delete-category"/);
  assert.match(cats, /تعديل/);
  assert.match(cats, /حذف/);
});

test("renewed strip is cancelled and anniversary nav uses offers_label", () => {
  assert.match(sections, /function renewedHTML\(\) \{\s*return "";/);
  assert.match(header, /offers_label/);
  assert.match(header, /navLabel/);
  assert.equal(header.includes("ما معنى مجدد"), false);
});

test("hero photo sits on the left and footer uses payment app icons", () => {
  const heroInner = sections.slice(sections.indexOf("hero-inner"), sections.indexOf("hero-copy"));
  assert.match(heroInner, /hero-visual/);
  assert.match(header, /paymentIcon/);
  assert.match(header, /pay-badge pay-image/);
  assert.match(restoreCss, /direction:\s*ltr/);
  assert.match(checkout, /paymentIcon/);
});

test("category cards and payment methods use real image files", () => {
  const payments = readFileSync(new URL("../assets/js/domain/payments.js", import.meta.url), "utf8");
  assert.match(payments, /bankily\.png/);
  assert.match(payments, /masrvi\.jpg/);
  assert.match(payments, /sedad\.png/);
  assert.match(payments, /click\.png/);
  const photos = readFileSync(new URL("../assets/js/domain/category-images.js", import.meta.url), "utf8");
  assert.match(photos, /assets\/img\/cats\/phones\.jpg/);
  assert.match(photos, /restore-anniversary/);
  assert.match(photos, /stampCatalogImages/);
  assert.match(sections, /categoryPhoto/);
  const dash = readFileSync(new URL("../assets/js/dashboard.js", import.meta.url), "utf8");
  assert.match(dash, /bindBrokenImages/);
});

test("dashboard drops bulk prices and the in-progress orders tab", () => {
  assert.equal(products.includes("bulk-price"), false);
  assert.equal(products.includes("تعديل أسعار جماعي"), false);
  assert.equal(orders.includes("جارٍ"), false);
  assert.equal(orders.includes("En cours"), false);
  assert.match(orders, /الطلبات/);
});

test("checkout has one form and no Restore coupon", () => {
  assert.equal((checkout.match(/id="checkout-form"/g) || []).length, 1);
  assert.equal(checkout.includes("RESTORE10"), false);
  assert.equal(checkout.includes("checkout-redirect-note"), false);
  assert.match(checkout, /id="co-notes"/);
  const nameAt = checkout.indexOf('id="co-name"');
  const cityAt = checkout.indexOf('id="co-city"');
  assert.ok(nameAt > 0 && cityAt > nameAt);
  assert.equal(checkout.slice(nameAt, cityAt).includes("<section"), false);
});

test("Ctrl+Alt+Y probe is wired", () => {
  assert.match(probe, /KeyY/);
  assert.match(probe, /altKey/);
  assert.equal(probe.includes("KeyT"), false);
  assert.match(probe, /STORE PROBE/);
  assert.match(app, /17-store-probe\.js/);
});

test("account track is phone first with أو, newsletter is gone, orders tabs are two columns", () => {
  const account = readFileSync(new URL("../assets/js/ui/storefront/14-static-pages.js", import.meta.url), "utf8");
  const cart = readFileSync(new URL("../assets/js/ui/storefront/05-cart-drawer.js", import.meta.url), "utf8");
  assert.equal(account.includes("account-track"), false);
  assert.match(cart, /class="cart-track"/);
  assert.match(cart, /restore_has_order_v1/);
  assert.match(cart, /hidden = !customerHasOrdered/);
  assert.equal(account.includes("<details>"), false);
  const phoneAt = cart.indexOf('id="acc-phone"');
  const orderAt = cart.indexOf('id="acc-order"');
  assert.ok(phoneAt > 0 && orderAt > phoneAt);
  assert.match(cart, /track-or/);
  assert.equal(header.includes("newsletter-form"), false);
  const dashCss = readFileSync(new URL("../assets/css/dashboard.css", import.meta.url), "utf8");
  assert.match(dashCss, /\.orders-tabs \{ display: grid; grid-template-columns: repeat\(2,/);
  const styles = readFileSync(new URL("../assets/css/styles.css", import.meta.url), "utf8");
  assert.equal(styles.includes("min-height: 242px"), false);
});

test("no hamburger drawer; category toggles are tappable buttons; payments are four tiles", () => {
  assert.equal(header.includes("data-open-menu"), false);
  const menu = readFileSync(new URL("../assets/js/ui/storefront/07-mobile-menu.js", import.meta.url), "utf8");
  assert.equal(menu.includes("menu-chip"), false);
  assert.equal(menu.includes("menu-drawer"), false);
  const nav = readFileSync(new URL("../assets/js/services/01-default-texts.js", import.meta.url), "utf8");
  assert.equal(nav.includes('id: "samsung"'), false);
  assert.equal(nav.includes("كن بائعًا"), false);
  const actions = readFileSync(new URL("../assets/js/ui/dashboard/22c-actions-forms.js", import.meta.url), "utf8");
  assert.match(actions, /"toggle-category-visible"/);
  assert.match(cats, /<button type="button" class="toggle/);
  assert.match(checkout, /is-tile/);
  assert.match(checkout, /is-wide/);
  assert.equal(checkout.includes("<span>3</span>"), false);
  assert.equal(checkout.includes("co-email"), false);
  assert.equal(checkout.includes("country-readonly"), false);
  assert.equal(checkout.includes("breadcrumb"), false);
  assert.equal(checkout.includes("checkout-secure"), false);
  const css = readFileSync(new URL("../assets/css/restore.css", import.meta.url), "utf8");
  assert.equal(css.includes(".lang-current span { display: none; }"), false);
  assert.match(css, /\.payment-card\.is-tile/);
  assert.match(css, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /data-page="account"] \.search/);
  const editor = readFileSync(new URL("../assets/js/ui/dashboard/07b-product-editor.js", import.meta.url), "utf8");
  assert.match(editor, /pe-media/);
  assert.match(editor, /pe-two/);
  const styles = readFileSync(new URL("../assets/css/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.main-nav \{ display: block; \}/);
  assert.match(styles, /repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /justify-self: start/);
  const hydrate = readFileSync(new URL("../assets/js/services/01-default-content.js", import.meta.url), "utf8");
  assert.match(hydrate, /SHORT_NAV/);
  assert.match(hydrate, /عروض/);
  assert.match(hydrate, /ملحقات/);
  const headerJs = readFileSync(new URL("../assets/js/ui/storefront/04-header-footer.js", import.meta.url), "utf8");
  assert.match(headerJs, /\.slice\(0, 5\)/);
  assert.match(headerJs, /slimChrome/);
});

test("stale demo name and مجددة copy are scrubbed; apply-brand keeps the bag mark", () => {
  const hydrate = readFileSync(new URL("../assets/js/services/01-default-content.js", import.meta.url), "utf8");
  assert.match(hydrate, /withoutRenewedWord/);
  assert.match(hydrate, /المتجر/);
  assert.match(hydrate, /STALE_NAME/);
  const brand = readFileSync(new URL("../scripts/apply-brand.mjs", import.meta.url), "utf8");
  assert.match(brand, /never rewrite those files/);
  assert.equal(brand.includes('writeFileSync(P("assets/img/brand-logo'), false);
});

test("warranty badge is opt-in and Demo is stripped from vendor chips", () => {
  const settings = readFileSync(new URL("../assets/js/domain/site-settings.js", import.meta.url), "utf8");
  assert.match(settings, /key: "warranty_label"/);
  assert.match(settings, /defaultValue: \{ ar: "ضمان المتجر"/);
  assert.match(settings, /defaultVisible: false/);
  assert.match(sections, /replace\(\/\^Demo\\s\+\/i/);
  const productPage = readFileSync(new URL("../assets/js/ui/storefront/11-product-page.js", import.meta.url), "utf8");
  assert.equal(productPage.includes("ضمان 12 شهرًا يغطي"), false);
});
