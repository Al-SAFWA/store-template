import { test, expect } from "@playwright/test";
import { demoMode, watchConsole, loginDashboard } from "./helpers.mjs";

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });

test("1.14: categories cards/editor and coupons flow through to the storefront", async ({ page }) => {
  await demoMode(page);
  const errors = watchConsole(page);
  await loginDashboard(page);

  // --- Categories
  await page.evaluate(() => {
    location.hash = "#categories";
  });
  const cards = page.locator(".ct-card");
  await expect(cards.first()).toBeVisible();
  const before = await cards.count();
  await page.click('[data-action="add-category"]');
  const modal = page.locator(".dash-modal");
  await expect(modal.locator(".pe-step")).toHaveCount(4);
  const name = modal.locator('[data-edit-path="title.ar"]');
  await name.fill("عروض العيد");
  await name.dispatchEvent("input");
  await modal.locator("[data-cat-product]").first().click();
  await modal.locator("[data-cat-product]").nth(1).click();
  await expect(modal.locator("[data-cat-count]")).toContainText("2");
  await modal.locator('[data-cat-flag="menu"]').click(); // menu off, home stays on
  await page.click('[data-action="save-editor"]');
  await expect(modal).toHaveCount(0);
  await expect(cards).toHaveCount(before + 1);
  await expect(cards.last()).toContainText("عروض العيد");
  await expect(cards.last()).toContainText("2");
  // move it up
  await cards.last().locator('[data-dir="-1"]').click();
  await expect(cards.nth(before - 1)).toContainText("عروض العيد");

  // --- Coupons
  await page.evaluate(() => {
    location.hash = "#marketing";
  });
  await page.click('[data-action="add-coupon"]');
  const code = modal.locator('[data-edit-path="code"]');
  await code.fill("eid 20");
  await code.dispatchEvent("input");
  await modal.locator('[data-coupon-type="percent"]').click();
  const value = modal.locator('[data-edit-path="value"]');
  await value.fill("20");
  await value.dispatchEvent("input");
  const promo = modal.locator('[data-edit-path="promo"]');
  if (!(await promo.isChecked())) await promo.check({ force: true });
  await page.click('[data-action="save-coupon"]');
  await expect(modal).toHaveCount(0);
  await expect(page.locator(".cp-card").last()).toContainText("EID20");
  await expect(page.locator(".cp-card").last()).toContainText("في بانر الرئيسية");

  // --- Publish → storefront
  await page.click('[data-action="publish"]');
  const confirm = page.locator('[data-action="confirm-publish"]');
  if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click();
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => {
    const m = window.RESTORE.state;
    const c = m.collections.find((x) => x.title?.ar === "عروض العيد");
    return {
      handle: c.handle,
      home: m.theme.categories.some((x) => x.handle === c.handle),
      menu: m.settings.navigation.some((x) => x.href.includes(c.handle)),
      members: m.products.filter((p) => (p.collections || []).includes(c.handle)).length
    };
  });
  expect(state.home).toBe(true);
  expect(state.menu).toBe(false);
  expect(state.members).toBe(2);

  await page.goto("/index.html");
  await expect(page.locator(".offer-banner")).toContainText("EID20");
  await expect(page.locator(".cat-card", { hasText: "عروض العيد" })).toHaveCount(1);
  await page.goto(`/collection.html?handle=${state.handle}`);
  await expect(page.locator(".product-card")).toHaveCount(2);

  const handle = await page.evaluate(() => window.RESTORE.state.products.find((p) => p.stock > 0 && p.active).handle);
  await page.goto(`/product.html?handle=${handle}`);
  await expect(page.locator("[data-add-cart]")).toBeVisible();
  await page.click("[data-add-cart]");
  await page.goto("/checkout.html");
  await page.fill("#co-coupon", "eid20");
  await page.click("#apply-coupon");
  await expect(page.locator("#sum-coupon").locator("..")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});
