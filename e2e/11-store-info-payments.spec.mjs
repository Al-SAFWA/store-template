import { test, expect } from "@playwright/test";
import { demoMode, watchConsole, loginDashboard } from "./helpers.mjs";

test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });

test("1.15: my store + payments cards flow through to the storefront", async ({ page }) => {
  await demoMode(page);
  const errors = watchConsole(page);
  await loginDashboard(page);

  // --- My store: WhatsApp, address, hours
  await page.evaluate(() => {
    location.hash = "#store-info";
  });
  await expect(page.locator(".si .pe-step")).toHaveCount(4);
  const set = async (path, value) => {
    const el = page.locator(`[data-path="${path}"]`).first();
    await el.fill(String(value));
    await el.dispatchEvent("input");
    await el.dispatchEvent("change");
  };
  await set("settings.whatsapp", "22244123456");
  await set("settings.address.ar", "تفرغ زينة");
  await set("settings.mapUrl", "https://maps.app.goo.gl/x");
  await page.click('[data-store-day="5"]'); // close on Friday
  await expect(page.locator('[data-store-day="5"]')).not.toHaveClass(/on/);
  await expect(page.locator("[data-store-preview]")).toContainText("تفرغ زينة");

  // --- Payments: account number on Bankily, discount 0 → banner must disappear
  await page.evaluate(() => {
    location.hash = "#payments";
  });
  await expect(page.locator(".pc-card").first()).toBeVisible();
  await page.locator('[data-action="edit-payment"][data-index="0"]').click();
  const modal = page.locator(".dash-modal");
  const account = modal.locator('[data-edit-path="account"]');
  await account.fill("44 12 34 56");
  await account.dispatchEvent("input");
  const discount = modal.locator('[data-edit-path="discount"]');
  await discount.fill("0");
  await discount.dispatchEvent("input");
  await page.click('[data-action="save-editor"]');
  await expect(modal).toHaveCount(0);
  await expect(page.locator(".pc-card").first()).toContainText("44 12 34 56");
  // in-place city fee
  const fee = page.locator('[data-city-fee="1"]');
  await fee.fill("650");
  await fee.dispatchEvent("input");

  // --- Publish and check the storefront
  await page.click('[data-action="publish"]');
  const confirm = page.locator('[data-action="confirm-publish"]');
  if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click();
  await page.waitForTimeout(400);
  const live = await page.evaluate(() => window.RESTORE.state.settings);
  expect(live.whatsapp).toBe("22244123456");
  expect(live.payments[0].account).toBe("44 12 34 56");
  expect(live.cities[1].fee).toBe(650);
  expect(live.hours.days).not.toContain(5);

  await page.goto("/index.html");
  const anyDiscount = live.payments.some((p) => p.active !== false && Number(p.discount) > 0);
  if (!anyDiscount) await expect(page.locator(".bnpl")).toHaveCount(0);
  await expect(page.locator(".site-footer, footer")).toContainText("تفرغ زينة");

  const handle = await page.evaluate(() => window.RESTORE.state.products.find((p) => p.stock > 0 && p.active).handle);
  await page.goto(`/product.html?handle=${handle}`);
  await expect(page.locator("[data-add-cart]")).toBeVisible();
  await page.click("[data-add-cart]");
  await page.goto("/checkout.html");
  await expect(page.locator("#pay-account")).toBeVisible();
  await expect(page.locator("#pay-account-number")).toHaveText("44 12 34 56");
  expect(errors, errors.join("\n")).toEqual([]);
});
