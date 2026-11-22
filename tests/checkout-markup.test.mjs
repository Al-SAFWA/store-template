import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../assets/js/ui/storefront/12a-checkout-markup.js", import.meta.url), "utf8");
const start = src.indexOf("export function checkoutPageHTML");
const tpl = src.slice(src.indexOf("return `", start), src.indexOf("`;", src.indexOf("return `", start)));

test("checkout form is closed before the order summary (no duplicated layout)", () => {
  assert.ok(tpl.includes("</form>"), "form must close");
  const formClose = tpl.indexOf("</form>");
  const aside = tpl.indexOf('<aside class="order-summary">');
  assert.ok(formClose > 0 && aside > formClose, "summary sits after the form, not inside it");
  assert.equal(tpl.includes("</section>\n          </div>\n          <aside"), false);
});

test("checkout has one form, no Restore coupon, no premature redirect note", () => {
  assert.equal((tpl.match(/id="checkout-form"/g) || []).length, 1);
  assert.equal(tpl.includes("RESTORE10"), false);
  assert.equal(tpl.includes("checkout-redirect-note"), false);
  assert.equal(tpl.includes("accepted-pay"), false);
});
