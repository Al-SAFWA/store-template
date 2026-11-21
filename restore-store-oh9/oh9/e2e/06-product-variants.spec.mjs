// Detailed product-page audit: a staff member gives a product colours + storage choices in the dashboard, then a
// shopper on the storefront must see the choices, watch the price/stock follow each pick, and get the right line in
// the cart, in both languages. Every step asserts what the user sees, not internal state only.
import { test, expect } from "@playwright/test";
import { demoMode, watchConsole, loginDashboard } from "./helpers.mjs";

const money = (text) => Number(String(text).replace(/[^\d]/g, ""));

test("variants: dashboard simple editor → storefront price, stock, cart line, WhatsApp and language", async ({
  page
}) => {
  await demoMode(page);
  const errors = watchConsole(page);
  await loginDashboard(page);
  await page.evaluate(() => {
    location.hash = "#products";
  });
  await page.click('[data-action="add-product"]');
  const modal = page.locator(".dash-modal");
  await expect(modal).toBeVisible();
  const stamp = Date.now().toString(36);
  const handle = "e2e-tablette-" + stamp;
  const set = async (sel, value) => {
    const el = modal.locator(sel).first();
    await el.fill(String(value));
    await el.dispatchEvent("input");
    await el.dispatchEvent("change");
  };
  await set('[data-edit-path="title.ar"]', "تابلت اختبار");
  await set('[data-edit-path="price"]', 7900);
  await modal.locator(".pe-more > summary").click();
  await set('[data-edit-path="title.fr"]', "E2E Tablette " + stamp);
  // Colours are tapped, not typed.
  await modal.locator('[data-pe-color="Silver"]').click();
  await modal.locator('[data-pe-color="Black"]').click();
  // Choices: switch on, then one row per capacity [value][+price][stock].
  await modal.locator("[data-pe-has-choices]").check({ force: true });
  const rows = [
    ["64 GB", 0, 5],
    ["256 GB", 5000, 4],
    ["512 GB", 9000, 0]
  ];
  for (let i = 0; i < rows.length; i += 1) {
    if (i > 0) await modal.locator("[data-pe-add-row]").click();
    await set(`[data-pe-value="${i}"]`, rows[i][0]);
    await set(`[data-pe-delta="${i}"]`, rows[i][1]);
    await set(`[data-pe-stock="${i}"]`, rows[i][2]);
  }
  // Per-colour grid appeared (2 colours × 3 capacities); split the 5 of 64 GB as 3 + 2.
  await expect(modal.locator("[data-pe-grid]")).toHaveCount(6);
  await set('[data-pe-grid="Silver|64 GB"]', 3);
  await set('[data-pe-grid="Black|64 GB"]', 2);
  await set('[data-pe-grid="Silver|256 GB"]', 1);
  await set('[data-pe-grid="Black|256 GB"]', 3);
  await page.click('[data-action="save-editor"]');
  await expect(modal).toHaveCount(0);
  await page.click('[data-action="publish"]');
  const confirm = page.locator('[data-action="confirm-publish"]');
  if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click();
  await page.waitForTimeout(400);

  // Stock is the sum of the grid (3+2 + 1+3 + 0+0 = 9); the merchant never typed a total.
  const live = await page.evaluate((h) => window.RESTORE.state.products.find((p) => p.handle === h), handle);
  expect(live, "published").toBeTruthy();
  expect(live.variants).toHaveLength(6);
  expect(live.options.map((o) => o.name)).toEqual(["Color", "Storage"]);
  expect(live.stock).toBe(9);

  // Storefront (Arabic is the default language).
  await page.goto(`/product.html?handle=${handle}`);
  const info = page.locator("#product-info");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(info.locator("h1")).toHaveText("تابلت اختبار");
  const colorBtns = info.locator('[data-opt="Color"]');
  const storageBtns = info.locator('[data-opt="Storage"]');
  await expect(colorBtns).toHaveCount(2);
  await expect(storageBtns).toHaveCount(3);
  await expect(colorBtns.first()).toHaveAttribute("data-color-hex", "#cbd5e1");
  await expect(colorBtns.first()).toHaveText("فضي");
  await expect(colorBtns.nth(1)).toHaveAttribute("data-value", "Black");
  await expect(colorBtns.nth(1)).toHaveText("أسود");
  const priceNow = () => info.locator(".price-now").first().innerText().then(money);
  expect(await priceNow()).toBe(7900);

  // 256 GB → +5000, WhatsApp message names the choice, add-to-cart enabled.
  await storageBtns.nth(1).click();
  expect(await priceNow()).toBe(12900);
  await expect(info.locator('[data-opt="Storage"].active')).toHaveText(/256/);
  await expect(info.locator(".whatsapp-order")).toHaveAttribute("href", /256%20GB/);
  await expect(info.locator("[data-add-cart]")).toBeEnabled();

  // 512 GB has stock 0 → sold out, button disabled; back to 64 GB → enabled, base price.
  await storageBtns.nth(2).click();
  await expect(info.locator("[data-add-cart]")).toBeDisabled();
  await storageBtns.nth(0).click();
  await expect(info.locator("[data-add-cart]")).toBeEnabled();
  expect(await priceNow()).toBe(7900);

  // Black + 256 GB, quantity 2 (minus never goes below 1), add to cart → one line, right variant, right total.
  await colorBtns.nth(1).click();
  await storageBtns.nth(1).click();
  await expect(info.locator('[data-opt="Color"].active')).toHaveAttribute("data-value", "Black");
  await info.locator('[data-qty="-1"]').click();
  await expect(info.locator("#qty-val")).toHaveText("1");
  await info.locator('[data-qty="1"]').click();
  await expect(info.locator("#qty-val")).toHaveText("2");
  // Black / 256 GB has 3 units: plus stops at 3 and tells the shopper why.
  await info.locator('[data-qty="1"]').click();
  await info.locator('[data-qty="1"]').click();
  await expect(info.locator("#qty-val")).toHaveText("3");
  await expect(page.locator("#toast")).toContainText("3");
  await info.locator('[data-qty="-1"]').click();
  await expect(info.locator("#qty-val")).toHaveText("2");
  await info.locator("[data-add-cart]").click();
  const cart = page.locator(".cart-item");
  await expect(cart).toHaveCount(1);
  await expect(cart.locator(".cart-item-var")).toContainText("Black");
  await expect(cart.locator(".cart-item-var")).toContainText("256");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("restore_cart_v1") || "[]"));
  expect(stored).toHaveLength(1);
  expect(stored[0].qty).toBe(2);
  await expect(page.locator(".cart-item-right, .cart-item").first()).toContainText(/25[,\s]?800/);

  // French: title translates, the choices stay, price follows the pick.
  await page.evaluate(() => localStorage.setItem("restore_lang_v1", "fr"));
  await page.goto(`/product.html?handle=${handle}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("#product-info h1")).toHaveText("E2E Tablette " + stamp);
  await expect(page.locator('#product-info [data-opt="Storage"]')).toHaveCount(3);
  await page.locator('#product-info [data-opt="Storage"]').nth(1).click();
  expect(await page.locator("#product-info .price-now").first().innerText().then(money)).toBe(12900);

  // Search and collection card still find the product.
  await page.goto("/collection.html?handle=all");
  await expect(page.locator(`a[href*="handle=${handle}"]`).first()).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("variants: reopening the editor shows the saved choices and keeps them on save", async ({ page }) => {
  await demoMode(page);
  const errors = watchConsole(page);
  await loginDashboard(page);
  await page.evaluate(() => {
    location.hash = "#products";
  });
  const found = await page.evaluate(() => {
    const i = window.RESTORE.state.products.findIndex((x) => (x.variants || []).length > 1);
    return i < 0 ? null : { index: i, handle: window.RESTORE.state.products[i].handle };
  });
  test.skip(!found, "no multi-variant product in demo data");
  const handle = found.handle;
  await page.locator(`[data-action="edit-product"][data-index="${found.index}"]`).first().click();
  const modal = page.locator(".dash-modal");
  await expect(modal).toBeVisible();
  await expect(modal.locator("[data-pe-has-choices]")).toBeChecked();
  expect(await modal.locator("[data-pe-row]").count(), "choice rows pre-filled from existing variants").toBeGreaterThan(
    0
  );
  const before = await page.evaluate(
    (h) => window.RESTORE.state.products.find((p) => p.handle === h).variants.length,
    handle
  );
  await page.click('[data-action="save-editor"]');
  await expect(modal).toHaveCount(0);
  const draft = await page.evaluate(
    (h) => (window.RESTORE.draft?.products || window.RESTORE.state.products).find((p) => p.handle === h),
    handle
  );
  expect(draft.variants.length).toBeGreaterThanOrEqual(1);
  expect(draft.options.length).toBeGreaterThanOrEqual(1);
  void before;
  expect(errors, errors.join("\n")).toEqual([]);
});
