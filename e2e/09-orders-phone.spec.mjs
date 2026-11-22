import { test, expect } from "@playwright/test";
import { demoMode, loginDashboard, watchConsole } from "./helpers.mjs";

/** Phone-sized dashboard: an order walks new → confirmed → preparing → shipped → delivered with one button per step. */
// serviceWorkers blocked: after a storefront visit the SW would serve the cached (non-demo) config.js around our route().
test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });

/** Places an order through the storefront checkout and returns its id. */
async function placeOrder(page, phone = "22246123456") {
  // The success screen redirects to WhatsApp after ~1 s; answer that URL locally so the page settles.
  await page.route(/https:\/\/(api\.whatsapp\.com|wa\.me)\//, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<title>wa</title>" })
  );
  await page.goto("/index.html");
  const handle = await page.evaluate(() => window.RESTORE.state.products.find((p) => p.stock > 0 && p.active).handle);
  await page.goto(`/product.html?handle=${handle}`);
  await page.click("[data-add-cart]");
  await page.goto("/checkout.html");
  await page.fill("#co-name", "زبون الهاتف");
  await page.fill("#co-phone", phone);
  await page.fill("#co-address", "تفرغ زينة");
  await page.waitForTimeout(1000); // let the abandoned-lead timer fire while the form still exists
  const before = await page.evaluate(() => window.RESTORE.getOrders().length);
  await page.locator("#place-order").dispatchEvent("click");
  // The success screen redirects to wa.me after ~1.1 s (unreachable here); read the id before that navigation.
  let id = "";
  for (let i = 0; i < 40 && !id; i += 1) {
    await page.waitForTimeout(50);
    id = await page
      .evaluate((n) => (window.RESTORE.getOrders().length > n ? window.RESTORE.getOrders()[0].id : ""), before)
      .catch(() => "");
  }
  expect(id, "order created").toBeTruthy();
  await page.waitForURL(/whatsapp|wa\.me/, { timeout: 10_000 });
  return id;
}

test("orders on a phone: groups, next-step button, WhatsApp link, cancel", async ({ page }) => {
  await demoMode(page);
  const errors = watchConsole(page);
  const id = await placeOrder(page);
  await loginDashboard(page);
  await page.evaluate(() => {
    location.hash = "#orders";
  });
  const card = page.locator(`.order-card[data-id="${id}"]`);
  await expect(card).toBeVisible();
  // Cards are the phone layout; the desktop table is hidden.
  await expect(page.locator(".orders-desk")).toBeHidden();
  // Open orders tab is selected and carries an urgent counter while the order is still new.
  await expect(page.locator('[data-order-filter="new"].active .oc-count.urgent')).toBeVisible();
  await expect(page.locator('[data-order-filter="active"]')).toHaveCount(0);
  // Customer, place, total and a WhatsApp link with a prefilled message.
  await expect(card).toContainText("زبون الهاتف");
  await expect(card).toContainText("تفرغ زينة");
  const wa = await card.locator("a.oc-wa").getAttribute("href");
  expect(wa).toMatch(/^https:\/\/wa\.me\/22246123456\?text=/);
  expect(decodeURIComponent(wa)).toContain(id);
  const statusOf = () => page.evaluate((i) => window.RESTORE.getOrders().find((o) => o.id === i).status, id);

  // new → confirmed stays on the open-orders tab (the in-progress tab was removed).
  await card.locator('[data-action="order-next"]').click();
  expect(await statusOf()).toBe("confirmed");
  await expect(card).toBeVisible();
  await expect(card.locator('[data-action="order-next"]')).toContainText("جاهز للشحن");
  await card.locator('[data-action="order-next"]').click();
  expect(await statusOf()).toBe("preparing");
  await card.locator('[data-action="order-next"]').click();
  expect(await statusOf()).toBe("shipped");
  // Shipped → WhatsApp template switches to the "shipped" message.
  const waShipped = decodeURIComponent((await card.locator("a.oc-wa").getAttribute("href")) || "");
  expect(waShipped).toMatch(/شحن|expédi/i);
  await card.locator('[data-action="order-next"]').click();
  expect(await statusOf()).toBe("delivered");
  await expect(card).toHaveCount(0);
  await page.click('[data-order-filter="done"]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-action="order-next"]')).toHaveCount(0);

  // Detail modal from a card: next-step bar on top, manual status under "more".
  await page.click('[data-order-filter="done"]');
  await card.click();
  const modal = page.locator(".dash-modal");
  await expect(modal).toBeVisible();
  await expect(modal.locator(".order-step")).toBeVisible();
  await expect(modal.locator("[data-order-status]")).toBeHidden(); // inside a closed <details>
  await modal.locator(".order-more > summary").click();
  await expect(modal.locator("[data-order-status]")).toBeVisible();
  await page.click('[data-action="close-modal"]');

  // Cancel from a fresh order: confirm dialog, then status cancelled.
  const id2 = await placeOrder(page, "22236555444"); // another number: same phone is rate-limited for 60 s
  await page.goto("/dashboard.html#orders");
  await page.evaluate(() => {
    location.hash = "#orders";
  });
  const card2 = page.locator(`.order-card[data-id="${id2}"]`);
  await expect(card2).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await card2.locator('[data-action="order-cancel"]').click();
  expect(await page.evaluate((i) => window.RESTORE.getOrders().find((o) => o.id === i).status, id2)).toBe("cancelled");
  expect(errors, errors.join("\n")).toEqual([]);
});
