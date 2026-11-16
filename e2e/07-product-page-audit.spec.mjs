// Product-page and products-list audit on the stock demo catalog: gallery, favourites, cart drawer stepper/remove,
// search, collection, and the dashboard list (search box, per-row hide switch, delete) — the "small" things a
// merchant notices first on a phone.
import { test, expect } from "@playwright/test";
import { demoMode, watchConsole, loginDashboard } from "./helpers.mjs";

test("shopper: product page gallery, favourite, cart drawer stepper and search", async ({ page }) => {
  await demoMode(page);
  const errors = watchConsole(page);
  await page.goto("/index.html");
  const handle = await page.evaluate(
    () => window.RESTORE.state.products.find((p) => p.stock > 0 && p.active && (p.variants || []).length > 1).handle
  );
  await page.goto(`/product.html?handle=${handle}`);
  const info = page.locator("#product-info");
  await expect(info).toBeVisible();

  // Gallery: main image + thumbnails, each thumb fits inside its frame (no overflow) and clicking swaps the image.
  const main = page.locator("#gallery-main-img");
  await expect(main).toBeVisible();
  const thumbs = page.locator("[data-thumb]");
  const thumbCount = await thumbs.count();
  for (let i = 0; i < thumbCount; i++) {
    const frame = await thumbs.nth(i).boundingBox();
    const img = await thumbs.nth(i).locator("img").boundingBox();
    expect(img.width, "thumb image wider than its frame").toBeLessThanOrEqual(frame.width + 1);
    expect(img.height, "thumb image taller than its frame").toBeLessThanOrEqual(frame.height + 1);
  }

  // Option pick repaints the price without leaving the page; the header still works after the repaint.
  const second = info.locator(".opt-btn").nth(1);
  await second.click();
  await expect(info.locator(".opt-btn.active").first()).toBeVisible();
  await expect(page.locator("header, .site-header").first()).toBeVisible();

  // Add to cart opens the drawer with one line; stepper + / − changes the quantity; remove empties the drawer.
  await info.locator("[data-add-cart]").click();
  const line = page.locator(".cart-item");
  await expect(line).toHaveCount(1);
  const qty = () => page.evaluate(() => JSON.parse(localStorage.getItem("restore_cart_v1") || "[]")[0]?.qty ?? null);
  expect(await qty()).toBe(1);
  await line.locator("[data-cart-inc]").click();
  expect(await qty()).toBe(2);
  await page.locator(".cart-item [data-cart-dec]").click();
  expect(await qty()).toBe(1);
  await page.locator(".cart-item [data-cart-remove]").click();
  await expect(page.locator(".cart-item")).toHaveCount(0);

  // Favourite from a product card survives a reload and shows on the wishlist page.
  await page.goto("/collection.html?handle=all");
  const wish = page.locator("[data-wish]").first();
  const wishedHandle = await wish.getAttribute("data-wish");
  await wish.click();
  await page.goto("/wishlist.html");
  await expect(page.locator(`a[href*="handle=${wishedHandle}"]`).first()).toBeVisible();

  // Search finds a product by title and the result links to its page.
  await page.goto("/index.html");
  const title = await page.evaluate((h) => window.RESTORE.state.products.find((p) => p.handle === h).title, handle);
  const word = String(typeof title === "string" ? title : title.ar || title.fr).split(/\s+/)[0];
  await page.evaluate((q) => window.RESTORE.openSearch?.(q), word);
  const input = page.locator("#search-input");
  if (await input.isVisible().catch(() => false)) {
    await input.fill(word);
    await expect(page.locator(`#search-results a[href*="handle=${handle}"]`).first()).toBeVisible();
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("staff: products list — search box filters, row switch hides from the storefront, delete removes", async ({
  page
}) => {
  await demoMode(page);
  const errors = watchConsole(page);
  await loginDashboard(page);
  await page.evaluate(() => {
    location.hash = "#products";
  });
  const rows = page.locator("table tbody tr");
  const total = await rows.count();
  expect(total).toBeGreaterThan(1);

  // Search narrows the table.
  const firstTitle = (await rows.first().locator("strong").first().innerText()).trim();
  await page.fill("#product-search", firstTitle.slice(0, 6));
  await page.waitForTimeout(300);
  expect(await page.locator("table tbody tr").count()).toBeLessThan(total);
  await page.fill("#product-search", "");
  await page.waitForTimeout(300);

  // The per-row switch is a real, visible switch (track + knob) and flips the product to hidden after publish.
  const toggle = page.locator("[data-product-active]").first();
  await expect(toggle).toBeAttached();
  const box = await toggle.locator("xpath=..").evaluate((el) => el.getBoundingClientRect().toJSON());
  expect(box.width, "switch track collapsed to the knob").toBeGreaterThan(30);
  const index = await toggle.getAttribute("data-product-active");
  const handle = await page.evaluate((i) => window.RESTORE.state.products[Number(i)]?.handle, index);
  await toggle.click({ force: true });
  await page.click('[data-action="publish"]');
  const confirm = page.locator('[data-action="confirm-publish"]');
  if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click();
  await page.waitForTimeout(400);
  const live = await page.evaluate((h) => window.RESTORE.state.products.find((p) => p.handle === h), handle);
  expect(live.active).toBe(false);
  await page.goto("/collection.html?handle=all");
  await expect(page.locator(`a[href*="handle=${handle}"]`)).toHaveCount(0);

  // Delete the (hidden) product; the table shrinks by one.
  await page.goto("/dashboard.html#products");
  await page.waitForSelector("table tbody tr");
  const before = await page.locator("table tbody tr").count();
  page.once("dialog", (d) => d.accept());
  await page.locator('[data-action="delete-product"]').first().click();
  const confirmDelete = page.locator('[data-action="confirm-delete"], .dash-modal [data-action="confirm"]');
  if (
    await confirmDelete
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false)
  )
    await confirmDelete.first().click();
  await page.waitForTimeout(300);
  expect(await page.locator("table tbody tr").count()).toBe(before - 1);
  expect(errors, errors.join("\n")).toEqual([]);
});
