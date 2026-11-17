import { test, expect } from "@playwright/test";
import { demoMode, watchConsole, loginDashboard } from "./helpers.mjs";

test("staff: create a product in the dashboard, publish, and see it on the storefront", async ({ page }) => {
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
  const handle = "e2e-produit-" + stamp;
  const set = async (path, value) => {
    const el = modal.locator(`[data-edit-path="${path}"]`).first();
    await el.fill(String(value));
    await el.dispatchEvent("input");
    await el.dispatchEvent("change");
  };
  // No handle field any more: the URL slug comes from the French name ("E2E Produit <stamp>" → "e2e-produit-<stamp>").
  await set("title.ar", "منتج اختبار");
  await modal.locator(".pe-more > summary").click();
  await set("title.fr", "E2E Produit " + stamp);
  await set("price", 12345);
  await set("stock", 7);
  await page.click('[data-action="save-editor"]');
  await expect(modal).toHaveCount(0);
  await page.click('[data-action="publish"]');
  const confirm = page.locator('[data-action="confirm-publish"]');
  if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click();
  await page.waitForTimeout(400);
  const live = await page.evaluate((h) => window.RESTORE.state.products.find((p) => p.handle === h), handle);
  expect(live, "product published to live state").toBeTruthy();
  expect(live.price).toBe(12345);
  expect(live.stock).toBe(7);
  await page.goto(`/product.html?handle=${handle}`);
  const h1 = page.locator("h1").first();
  await expect(h1).toContainText(/E2E Produit|منتج اختبار/);
  await expect(h1).not.toContainText("[object Object]");
  await expect(page.locator("[data-add-cart]")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});
