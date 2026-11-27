import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { demoMode, loginDashboard, watchConsole } from "./helpers.mjs";

/** 1.13 — hero slides on a phone: visual list, 4-step editor (presets, destination list), live preview,
    reorder; and the session guard: a lost session sends the merchant to the login screen and keeps the draft. */
test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });

async function openHeroTab(page) {
  await page.evaluate(() => {
    location.hash = "#homepage";
  });
  await page.click('[data-dash-tab="home-hero"]');
  await expect(page.locator(".hs-list")).toBeVisible();
}

test("hero slides: list preview, editor steps, presets, destination, reorder", async ({ page }) => {
  await demoMode(page);
  const errors = watchConsole(page);
  await loginDashboard(page);
  await openHeroTab(page);

  // The list renders each slide as the store does: background gradient from the data, title, photo.
  const cards = page.locator(".hs-card");
  await expect(cards).toHaveCount(2);
  const firstBg = await cards
    .nth(0)
    .locator(".hs-preview")
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(firstBg).toContain("linear-gradient");
  await expect(cards.nth(0).locator(".hs-preview img")).toHaveAttribute("src", /hero-1\.webp/);

  // Open the first slide: four numbered steps, no raw CSS / href fields visible.
  await cards.nth(0).locator(".hs-open").click();
  const modal = page.locator(".dash-modal");
  await expect(modal.locator(".pe-step")).toHaveCount(4);
  await expect(modal.locator('input[data-edit-path="bg"]')).toHaveCount(0);
  await expect(modal.locator(".hs-custom-href")).toBeHidden();
  // The current gradient is matched to a preset swatch (default slide uses the violet night preset).
  await expect(modal.locator(".hs-swatch.is-on")).toHaveAttribute("data-hero-bg", "night");

  // Typing the title updates the live preview.
  await modal.locator('input[data-edit-path="title.ar"]').fill("هواتف مضمونة لسنة");
  await expect(modal.locator(".hs-image-field .hs-preview strong")).toHaveText("هواتف مضمونة لسنة");

  // Picking the light preset flips the preview to dark text.
  await modal.locator('[data-hero-bg="sky"]').click();
  await expect(modal.locator(".hs-image-field .hs-preview")).toHaveClass(/is-light/);

  // Destination from a list (a collection), then a custom link reveals the URL field.
  const dest = modal.locator("[data-hero-dest]");
  const collectionValue = await dest.locator("optgroup:nth-of-type(2) option").first().getAttribute("value");
  expect(collectionValue).toMatch(/^collection\.html\?handle=/);
  await dest.selectOption(collectionValue);
  await dest.selectOption("__custom");
  await expect(modal.locator(".hs-custom-href")).toBeVisible();
  await dest.selectOption(collectionValue);

  await modal.locator('[data-action="save-editor"]').click();
  await expect(modal).toBeHidden();
  const saved = await page.evaluate(() => window.RESTORE.useDraft().settings.heroSlides[0]);
  expect(saved.title.ar).toBe("هواتف مضمونة لسنة");
  expect(saved.dark).toBe(false);
  expect(saved.bg).toContain("#eef3ff");
  expect(saved.href).toBe(collectionValue);
  await expect(page.locator(".hs-card").nth(0)).toContainText("هواتف مضمونة لسنة");

  // Reorder: slide 2 moves up.
  const secondTitle = await page.locator(".hs-card").nth(1).locator(".hs-copy strong").textContent();
  await page.locator('.hs-card:nth-child(2) [data-action="hero-up"]').click();
  await expect(page.locator(".hs-card").nth(0).locator(".hs-copy strong")).toHaveText(secondTitle);

  // New slide requires a title.
  await page.click('[data-action="add-hero"]');
  await modal.locator('[data-action="save-editor"]').click();
  await expect(page.locator(".dash-modal")).toBeVisible();
  await modal.locator('input[data-edit-path="title.ar"]').fill("شريحة ثالثة");
  await modal.locator('[data-action="save-editor"]').click();
  await expect(page.locator(".hs-card")).toHaveCount(3);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("login screen offers an opt-out 'remember this device' box only for remote stores", async ({ page }) => {
  await demoMode(page); // local demo → no Supabase → no checkbox
  await page.goto("/dashboard.html");
  await expect(page.locator("#login-form")).toBeVisible();
  await expect(page.locator(".login-remember")).toHaveCount(0);
});

test("a lost session (idle / other tab) returns to the login screen and keeps the open slide", async ({ page }) => {
  await demoMode(page);
  const errors = watchConsole(page);
  await loginDashboard(page);
  await openHeroTab(page);
  await page.click('[data-action="add-hero"]');
  await page.locator('input[data-edit-path="title.ar"]').fill("مسودة لم تُحفظ");
  // Simulate the idle timer / another tab logging out.
  await page.evaluate(() => window.RESTORE.logout({ reason: "idle" }));
  await expect(page.locator("#login-form")).toBeVisible();
  await expect(page.locator("#login-error")).toContainText("عدم النشاط");
  await expect(page.locator(".dash-modal")).toHaveCount(0);
  // Logging in again restores the slide that was being edited.
  for (const password of ["Owner#12345", "Owner#123456"]) {
    if (
      !(await page
        .locator("#login-form")
        .isVisible()
        .catch(() => false))
    )
      break;
    await page.fill('#login-form input[name="username"]', "owner");
    await page.fill('#login-form input[name="password"]', password);
    await page.click('#login-form button[type="submit"]');
    await page.waitForTimeout(300);
  }
  await expect(page.locator(".dash-modal")).toBeVisible();
  await expect(page.locator('.dash-modal input[data-edit-path="title.ar"]')).toHaveValue("مسودة لم تُحفظ");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("hero photo clean-up: white studio background becomes transparent, a real photo becomes a card", async ({
  page
}) => {
  await demoMode(page);
  const errors = watchConsole(page);
  await loginDashboard(page);
  await openHeroTab(page);
  const fixtures = new URL("./fixtures/", import.meta.url);

  // Slide 1 ← product shot on white: background removed, floats on the gradient.
  await page.locator(".hs-card").nth(0).locator(".hs-open").click();
  await page
    .locator('.hs-image-field input[type="file"]')
    .setInputFiles(fileURLToPath(new URL("iphone-white-bg.jpg", fixtures)));
  await expect(page.locator(".hs-image-field .hs-preview img:not(.is-card)")).toBeVisible();

  const corner = await page.locator(".hs-image-field .hs-preview img").evaluate(async (img) => {
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    return x.getImageData(1, 1, 1, 1).data[3];
  });
  expect(corner, "top-left pixel is transparent").toBe(0);
  await page.locator('[data-action="save-editor"]').click();
  let slides = await page.evaluate(() => window.RESTORE.useDraft().settings.heroSlides);
  expect(slides[0].imageStyle).toBe("float");
  expect(slides[0].image).toMatch(/^data:image\/(webp|png)/);

  // Slide 2 ← a photo with a coloured background: kept as is, flagged as a card.
  await page.locator(".hs-card").nth(1).locator(".hs-open").click();
  await page
    .locator('.hs-image-field input[type="file"]')
    .setInputFiles(fileURLToPath(new URL("macbook-photo.jpg", fixtures)));
  await expect(page.locator(".hs-image-field .hs-preview img.is-card")).toBeVisible();
  await page.locator('[data-action="save-editor"]').click();
  slides = await page.evaluate(() => window.RESTORE.useDraft().settings.heroSlides);
  expect(slides[1].imageStyle).toBe("card");

  // Publish (one tap since 1.17.2 — no confirmation modal), then the storefront renders the card class.
  await page.click('[data-action="publish"]');
  await page.waitForTimeout(600);
  await page.goto("/index.html");
  await expect(page.locator(".hero-slide").nth(1).locator("img.hero-img-card")).toHaveCount(1);
  await expect(page.locator(".hero-slide").nth(0).locator("img.hero-img-card")).toHaveCount(0);
  expect(errors, errors.join("\n")).toEqual([]);
});
