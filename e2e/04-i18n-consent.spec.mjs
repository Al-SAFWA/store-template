import { test, expect } from "@playwright/test";
import { demoMode, watchConsole } from "./helpers.mjs";

test("language toggle switches dir/lang and persists across pages", async ({ page }) => {
  await demoMode(page);
  // The one-tap language flip reloads immediately; without this the service worker's background pre-cache of the
  // app shell gets aborted by that reload and surfaces as console "requestfailed" noise.
  await page.route("**/sw.js", (route) => route.fulfill({ status: 404, body: "" }));
  const errors = watchConsole(page);
  await page.goto("/index.html");
  const startLang = await page.evaluate(() => document.documentElement.lang);
  const target = startLang.startsWith("ar") ? "fr" : "ar";
  // 1.17.5 — the header control is a single button that flips AR <-> FR in one tap (no dropdown).
  await page.click(`.header-actions [data-set-lang="${target}"]`);
  await page.waitForTimeout(400);
  await page.waitForLoadState("networkidle"); // the flip reloads; navigating away mid-reload would abort module loads
  const nextLang = await page.evaluate(() => document.documentElement.lang);
  expect(nextLang).not.toBe(startLang);
  expect(await page.evaluate(() => document.documentElement.dir)).toBe(nextLang.startsWith("ar") ? "rtl" : "ltr");
  await page.goto("/collection.html");
  expect(await page.evaluate(() => document.documentElement.lang)).toBe(nextLang);
  expect(errors, errors.join("\n")).toEqual([]);
});
test("analytics pixels load only after explicit consent", async ({ page }) => {
  await demoMode(page);
  await page.route(/connect\.facebook\.net|analytics\.tiktok\.com|googletagmanager\.com/, (r) =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: "" })
  );
  await page.goto("/index.html");
  await page.evaluate(() => {
    localStorage.removeItem("restore_consent_v1");
    const st = window.RESTORE.state;
    st.settings.pixels = { meta: "123456789", tiktok: "", ga: "" };
    localStorage.setItem("restore_state_v1", JSON.stringify(st));
  });
  await page.reload();
  await expect(page.locator("#consent-banner")).toBeVisible();
  expect(await page.locator("script[data-restore-pixels]").count()).toBe(0);
  await page.click('#consent-banner [data-consent="denied"]');
  await expect(page.locator("#consent-banner")).toHaveCount(0);
  expect(await page.locator("script[data-restore-pixels]").count()).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("restore_consent_v1"))).toBe("denied");
  await page.evaluate(() => localStorage.setItem("restore_consent_v1", "granted"));
  await page.reload();
  await expect(page.locator("script[data-restore-pixels]")).toHaveCount(1, { timeout: 5000 });
});
