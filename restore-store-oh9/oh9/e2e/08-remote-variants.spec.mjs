import { test, expect } from "@playwright/test";
import fs from "node:fs";
const money = (t) => Number(String(t).replace(/[^\d]/g, ""));
// Remote mode against a mocked Supabase: the exact demo1 rows (seed variants without color/storage, returned in
// reverse order by PostgREST, stale restore_state from 1.10.1). 64 GB must be 83,740 and 256 GB 93,790.
test("remote: seeded tablet-10 rows price per storage whatever the row order", async ({ page }) => {
  const original = fs.readFileSync("assets/js/config.js", "utf8");
  const patched = original
    .replace('supabaseUrl: ""', 'supabaseUrl: "https://fake.supabase.co"')
    .replace('supabaseAnonKey: ""', 'supabaseAnonKey: "anon"')
    .replace(/mode:\s*"[^"]*"/, 'mode: "supabase"');
  await page.route("**/assets/js/config.js", (r) =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: patched })
  );
  const product = {
    id: "tablet-10",
    handle: "tablet-10",
    title: { ar: "تابلت 10", fr: "Tablette 10" },
    brand: "Demo",
    price: 83740,
    compare_at: 104940,
    stock: 13,
    condition: "Excellent",
    specs: {},
    images: ["assets/products/tablet-10.svg"],
    active: true,
    sku: null,
    sort_order: 1,
    created_at: "2026-01-01",
    updated_at: "2026-02-02",
    extra: {
      options: [{ name: "Storage", values: ["64 GB", "256 GB"] }],
      colors: [
        { name: "#111827", hex: "#999999" },
        { name: "#cbd5e1", hex: "#999999" }
      ],
      collections: ["tablets"],
      image: "assets/products/tablet-10.svg"
    },
    restore_product_variants: [
      { id: "1024", product_id: "tablet-10", sku: null, color: null, storage: null, price_delta: 10050, stock: 8 },
      { id: "1023", product_id: "tablet-10", sku: null, color: null, storage: null, price_delta: 0, stock: 5 }
    ],
    restore_collection_products: []
  };
  const log = [];
  await page.route("https://fake.supabase.co/**", (route) => {
    const url = route.request().url();
    log.push(url.slice(0, 120));
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.includes("/rest/v1/restore_products")) return json([product]);
    if (url.includes("restore_catalog_meta") || url.includes("meta"))
      return json([{ version: 7, updated_at: "2026-01-01" }]);
    if (url.includes("restore_collections"))
      return json([
        { id: "tablets", handle: "tablets", title: { ar: "آيباد", fr: "Tablettes" }, sort_order: 1, active: true }
      ]);
    if (url.includes("restore_coupons")) return json([]);
    if (url.includes("restore_state"))
      return json([
        {
          id: "main",
          updated_at: "2026-01-01",
          data: {
            products: [
              {
                handle: "tablet-10",
                title: { ar: "تابلت 10", fr: "Tablette 10" },
                price: 83740,
                stock: 13,
                updatedAt: "2026-02-02",
                options: [
                  { name: "Color", values: ["#111827", "#cbd5e1"] },
                  { name: "Storage", values: ["64 GB", "256 GB"] }
                ],
                colors: [
                  { name: "#111827", hex: "#999999" },
                  { name: "#cbd5e1", hex: "#999999" }
                ],
                variants: [
                  {
                    id: "1023",
                    o1: null,
                    o2: null,
                    title: "",
                    color: "",
                    storage: "",
                    price: 83740,
                    stock: 5,
                    available: true
                  },
                  {
                    id: "1024",
                    o1: null,
                    o2: null,
                    title: "",
                    color: "",
                    storage: "",
                    price: 93790,
                    stock: 8,
                    available: true
                  }
                ],
                collections: ["tablets"],
                image: "assets/products/tablet-10.svg",
                images: ["assets/products/tablet-10.svg"],
                active: true
              }
            ]
          }
        }
      ]);
    return json([]);
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/product.html?handle=tablet-10");
  const info = page.locator("#product-info");
  await expect(info).toBeVisible();
  await page.waitForTimeout(1500);
  expect(money(await info.locator(".price-now").first().innerText())).toBe(83740);
  await info.locator('[data-opt="Storage"]').nth(1).click();
  expect(money(await page.locator("#product-info .price-now").first().innerText())).toBe(93790);
  await page.locator('#product-info [data-opt="Storage"]').nth(0).click();
  expect(money(await page.locator("#product-info .price-now").first().innerText())).toBe(83740);
  expect(log.some((u) => u.includes("restore_products?handle=eq.tablet-10"))).toBeTruthy();
  expect(errors, errors.join("\n")).toEqual([]);
});
