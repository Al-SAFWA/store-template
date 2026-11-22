import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../assets/css/restore.css", import.meta.url), "utf8");
const home = readFileSync(new URL("../assets/js/ui/storefront/09-home.js", import.meta.url), "utf8");
const sections = readFileSync(new URL("../assets/js/ui/storefront/10-home-sections.js", import.meta.url), "utf8");
const cats = readFileSync(new URL("../assets/js/ui/dashboard/08-categories.js", import.meta.url), "utf8");
const header = readFileSync(new URL("../assets/js/ui/storefront/04-header-footer.js", import.meta.url), "utf8");
const checkout = readFileSync(new URL("../assets/js/ui/storefront/12a-checkout-markup.js", import.meta.url), "utf8");
const probe = readFileSync(new URL("../assets/js/ui/storefront/17-store-probe.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../assets/js/app.js", import.meta.url), "utf8");
const brand = readFileSync(new URL("../assets/js/brand.config.js", import.meta.url), "utf8");

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
});

test("checkout has one form and no Restore coupon", () => {
  assert.equal((checkout.match(/id="checkout-form"/g) || []).length, 1);
  assert.equal(checkout.includes("RESTORE10"), false);
  assert.equal(checkout.includes("checkout-redirect-note"), false);
});

test("demo socials and Ctrl+Alt+Y probe are wired", () => {
  assert.match(brand, /facebook\.com\/demo\.store/);
  assert.match(brand, /instagram\.com\/demo\.store/);
  assert.match(brand, /tiktok\.com\/@demo\.store/);
  assert.match(probe, /KeyY/);
  assert.match(probe, /altKey/);
  assert.equal(probe.includes("KeyT"), false);
  assert.match(probe, /STORE PROBE/);
  assert.match(app, /17-store-probe\.js/);
});
