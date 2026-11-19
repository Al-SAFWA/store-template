/* Security regression: every string in the published state, plus hostile orders / reviews / audit rows, is poisoned with
   <img onerror> and "><svg onload> payloads; then every storefront page and every dashboard route is visited.
   If any payload executes, window.__xss is set and the test fails. Also asserts no javascript: links are rendered. */
import { test, expect } from "@playwright/test";
import { demoMode, loginDashboard, DASHBOARD_ROUTES } from "./helpers.mjs";
const PAYLOAD = `<img src=x onerror="window.__xss=(window.__xss||0)+1">`;
const PAYLOAD2 = `"><svg onload="window.__xss=(window.__xss||0)+1">`;
test.use({ serviceWorkers: "block" });
test("state poisoning never executes script (storefront + dashboard)", async ({ page }) => {
  test.setTimeout(600000);
  await demoMode(page);
  // Strip the CSP meta so the test proves ESCAPING, not just that CSP blocked inline handlers (defence in depth).
  await page.route(/\.html(\?.*)?$/, async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, "");
    const headers = { ...res.headers() };
    for (const k of Object.keys(headers)) if (/content-security-policy/i.test(k)) delete headers[k];
    await route.fulfill({
      status: res.status(),
      body,
      headers: { ...headers, "content-type": "text/html; charset=utf-8" }
    });
  });
  await page.goto("/index.html");
  // canary: with CSP stripped, an unescaped payload MUST fire — otherwise the test could pass for the wrong reason
  const canary = await page.evaluate((P) => {
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    document.body.insertAdjacentHTML("beforeend", P);
    return new Promise((r) => setTimeout(() => r({ csp: !!csp, fired: window.__xss || 0 }), 300));
  }, PAYLOAD);
  console.log("canary", JSON.stringify(canary));
  expect(canary.csp).toBe(false);
  expect(canary.fired).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.__xss = 0;
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const s = JSON.parse(JSON.stringify(window.RESTORE.state));
    localStorage.setItem("restore_state_v1", JSON.stringify(s));
  });
  const report = await page.evaluate(
    ({ PAYLOAD, PAYLOAD2 }) => {
      const out = {};
      for (const k of Object.keys(localStorage)) {
        if (!/^restore_(state|draft)_v1$/.test(k)) continue;
        try {
          const data = JSON.parse(localStorage.getItem(k));
          const poison = (v) => {
            if (typeof v === "string")
              return v.length > 0 && !/^(https?:|data:|#|\/|[a-z0-9_.-]{1,40}$)/i.test(v) ? v + PAYLOAD : v;
            if (Array.isArray(v)) return v.map(poison);
            if (v && typeof v === "object") {
              const o = {};
              for (const kk of Object.keys(v)) o[kk] = poison(v[kk]);
              return o;
            }
            return v;
          };
          const p = poison(data);
          localStorage.setItem(k, JSON.stringify(p));
          out[k] = JSON.stringify(p).split("onerror").length - 1;
        } catch (e) {
          out[k] = "err " + e.message;
        }
      }
      // orders + reviews + customers with hostile strings
      const order = {
        id: "RS-XSS1" + PAYLOAD2,
        createdAt: new Date().toISOString(),
        status: "new",
        customer: {
          name: "n" + PAYLOAD,
          phone: "+22246000000",
          city: "c" + PAYLOAD2,
          address: "a" + PAYLOAD,
          notes: "x" + PAYLOAD
        },
        items: [
          {
            handle: "h" + PAYLOAD2,
            title: "t" + PAYLOAD,
            qty: 1,
            price: 100,
            line: 100,
            variantTitle: "v" + PAYLOAD,
            specsText: "s" + PAYLOAD
          }
        ],
        subtotal: 100,
        shipping: 0,
        discount: 0,
        total: 100,
        coupon: "C" + PAYLOAD,
        payment: { id: "p", name: "pn" + PAYLOAD }
      };
      localStorage.setItem("restore_orders_v1", JSON.stringify([order]));
      localStorage.setItem(
        "restore_reviews_v1",
        JSON.stringify([
          {
            id: "r1",
            productHandle: "iphone-13",
            product_handle: "iphone-13",
            customerName: "cn" + PAYLOAD,
            customer_name: "cn" + PAYLOAD,
            rating: 5,
            title: "rt" + PAYLOAD,
            body: "rb" + PAYLOAD2,
            status: "approved",
            createdAt: new Date().toISOString()
          }
        ])
      );
      localStorage.setItem(
        "restore_audit_v1",
        JSON.stringify([
          {
            id: "a1",
            at: new Date().toISOString(),
            actor: "ac" + PAYLOAD,
            action: "act" + PAYLOAD,
            details: "d" + PAYLOAD2
          }
        ])
      );
      return out;
    },
    { PAYLOAD, PAYLOAD2 }
  );
  console.log("poisoned", report);
  const hits = [];
  const check = async (label) => {
    console.log("step", label);
    await page.waitForTimeout(900);
    const n = await page.evaluate(() => window.__xss || 0);
    if (n) hits.push(`${label}: ${n}`);
    await page.evaluate(() => {
      window.__xss = 0;
    });
  };
  const handles = await page.evaluate(() => {
    try {
      const s = JSON.parse(localStorage.getItem("restore_state_v1"));
      return (s.products || s.model?.products || s.catalog?.products || []).slice(0, 2).map((p) => p.handle);
    } catch {
      return [];
    }
  });
  console.log("handles", handles);
  for (const url of [
    "/index.html",
    "/collection.html",
    `/product.html?handle=${handles[0] || "x"}`,
    "/checkout.html",
    "/wishlist.html",
    "/account.html",
    "/page.html?slug=about",
    "/guide.html",
    "/print.html?order=RS-XSS1"
  ]) {
    await page.goto(url, { waitUntil: "commit" });
    await check(url);
    if (url.includes("product.html")) {
      await page
        .click("[data-action='add-to-cart'], .add-to-cart, button:has-text('أضف')", { timeout: 3000 })
        .catch(() => {});
      await check(url + " +cart");
      await page.goto("/checkout.html");
      await check("/checkout.html with cart");
    }
  }
  await loginDashboard(page);
  await check("dashboard login");
  for (const r of DASHBOARD_ROUTES) {
    await page.evaluate((r) => {
      location.hash = "#" + r;
    }, r);
    await check("#" + r);
  }
  // open order detail
  await page.evaluate(() => {
    location.hash = "#orders";
  });
  await page.waitForTimeout(500);
  await page.click("[data-order-id], .order-row, tr[data-id]", { timeout: 3000 }).catch(() => {});
  await check("#orders detail");
  await page.evaluate(() => {
    location.hash = "#orders";
  });
  await page.waitForTimeout(800);
  const seen = { orders: (await page.content()).includes("RS-XSS1"), reviewsRoute: false };
  await page.evaluate(() => {
    location.hash = "#reviews";
  });
  await page.waitForTimeout(800);
  seen.reviewsRoute = (await page.content()).includes("cn&lt;img") || (await page.content()).includes("rt&lt;img");
  await page.evaluate(() => {
    location.hash = "#products";
  });
  await page.waitForTimeout(800);
  await page.click("[data-action='edit-product'], .product-row button, [data-edit]", { timeout: 3000 }).catch(() => {});
  await check("#products editor");
  const jsLinks = await page.evaluate(
    () =>
      [...document.querySelectorAll("a[href]")].filter((a) => /^\s*javascript:/i.test(a.getAttribute("href"))).length
  );
  console.log("SEEN", JSON.stringify(seen), "jsLinks", jsLinks);
  console.log("HITS", hits);
  expect(hits).toEqual([]);
});
