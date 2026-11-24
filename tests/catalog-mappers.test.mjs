import test from "node:test";
import assert from "node:assert/strict";
import {
  productToRow,
  rowToProduct,
  collectionToRow,
  rowToCollection,
  couponToRow,
  rowToCoupon,
  validateProduct,
  validateCoupon,
  bulkAdjustPrice
} from "../assets/js/domain/catalog-mappers.js";

const product = {
  handle: "iphone-13-128",
  title: { ar: "آيفون 13", fr: "iPhone 13" },
  vendor: "Apple",
  type: "phone",
  condition: "like-new",
  price: 125000,
  compare: 140000,
  stock: 4,
  battery: 91,
  active: true,
  image: "a.jpg",
  images: ["a.jpg", "b.jpg"],
  description: { ar: "وصف", fr: "desc" },
  includes: ["cable"],
  specs: { ram: "4GB" },
  colors: [{ name: "Noir", hex: "#000" }],
  colorImages: {},
  variants: [{ id: "v1", sku: "IP13-128-BLK", color: "Noir", storage: "128", price: 125000, stock: 2 }],
  collections: ["iphone", "deals"],
  sku: "IP13",
  warrantyMonths: 6
};

test("productToRow keeps relational columns and pushes the rest into extra", () => {
  const { row, variants, collectionHandles } = productToRow(product);
  assert.equal(row.id, "iphone-13-128");
  assert.equal(row.price, 125000);
  assert.equal(row.compare_at, 140000);
  assert.equal(row.stock, 4);
  assert.equal(row.brand, "Apple");
  assert.deepEqual(row.images, ["a.jpg", "b.jpg"]);
  assert.equal(row.extra.battery, 91);
  assert.equal(row.extra.warrantyMonths, 6);
  assert.deepEqual(row.extra.description, { ar: "وصف", fr: "desc" });
  assert.ok(!("price" in row.extra), "price must never be duplicated in extra");
  assert.ok(!("stock" in row.extra));
  assert.deepEqual(collectionHandles, ["iphone", "deals"]);
  assert.equal(variants.length, 1);
  assert.equal(variants[0].price_delta, 0);
  assert.equal(variants[0].product_id, "iphone-13-128");
});

test("row → product → row round-trips", () => {
  const m = productToRow(product);
  const back = rowToProduct({ ...m.row, updated_at: "2026-10-29T00:00:00Z" }, m.variants, m.collectionHandles);
  assert.equal(back.handle, product.handle);
  assert.equal(back.price, product.price);
  assert.equal(back.compare, product.compare);
  assert.equal(back.vendor, "Apple");
  assert.equal(back.battery, 91);
  assert.equal(back.image, "a.jpg");
  assert.deepEqual(back.collections, ["iphone", "deals"]);
  assert.equal(back.variants[0].price, 125000);
  assert.equal(back._source, "restore_products");
  const again = productToRow(back);
  assert.deepEqual(again.row.extra.description, m.row.extra.description);
  assert.equal(again.row.price, m.row.price);
});

test("rowToProduct tolerates missing extra / null columns", () => {
  const p = rowToProduct({
    id: "x",
    handle: "x",
    title: { ar: "x", fr: "x" },
    price: 10,
    stock: null,
    images: null,
    extra: null
  });
  assert.equal(p.stock, 0);
  assert.deepEqual(p.images, []);
  assert.deepEqual(p.collections, []);
  assert.equal(p.compare, 0);
});

test("validateProduct catches bad handle / price", () => {
  assert.deepEqual(validateProduct(product), []);
  assert.ok(validateProduct({ ...product, handle: "Bad Handle!" }).includes("handle_invalid"));
  assert.ok(validateProduct({ ...product, price: -1 }).includes("price_invalid"));
  assert.ok(validateProduct({ ...product, title: { ar: "", fr: "" } }).includes("title_required"));
});

test("collection mapping keeps visible ↔ active", () => {
  const row = collectionToRow({
    handle: "iphone",
    title: { ar: "آيفون", fr: "iPhone" },
    visible: false,
    image: "c.png"
  });
  assert.equal(row.active, true);
  assert.equal(row.extra.visible, false);
  assert.equal(row.extra.image, "c.png");
  assert.equal(row.id, "iphone");
  const back = rowToCollection(row);
  assert.equal(back.visible, false);
  assert.equal(back.image, "c.png");
});

test("coupon mapping: code uppercased, minTotal ↔ min_total, expiresAt ↔ expires_at", () => {
  const row = couponToRow({
    id: "coupon-1",
    code: "restore10",
    type: "percent",
    value: 10,
    active: true,
    minTotal: 5000,
    expiresAt: "2026-12-31"
  });
  assert.equal(row.code, "RESTORE10");
  assert.equal(row.min_total, 5000);
  assert.ok(row.expires_at.startsWith("2026-12-31"));
  const back = rowToCoupon({ ...row, used_count: 3 });
  assert.equal(back.minTotal, 5000);
  assert.equal(back.expiresAt, "2026-12-31");
  assert.equal(back.id, "coupon-1");
  assert.equal(back.usedCount, 3);
  assert.deepEqual(validateCoupon(back), []);
  assert.ok(validateCoupon({ code: "x", type: "percent", value: 150 }).includes("value_invalid"));
});

test("bulkAdjustPrice rounds to nearest 5", () => {
  assert.equal(bulkAdjustPrice(1000, 10, "up"), 1100);
  assert.equal(bulkAdjustPrice(1003, 10, "down"), 905);
  assert.equal(bulkAdjustPrice(100, 200, "down"), 0);
});

test("rowToProduct: with variants, product.stock is the live sum of variant stocks (sales decrement variants)", () => {
  const row = { id: "p", handle: "p", title: { ar: "x", fr: "x" }, price: 100, stock: 13, active: true };
  const withVariants = rowToProduct(
    row,
    [
      { id: "v1", stock: 5 },
      { id: "v2", stock: 2 }
    ],
    []
  );
  assert.equal(withVariants.stock, 7);
  const noVariants = rowToProduct(row, [], []);
  assert.equal(noVariants.stock, 13);
});

test("rowToProduct: options and o1/o2 are derived from variant rows so the product page can price each choice", () => {
  const row = {
    id: "t",
    handle: "t",
    title: { ar: "x", fr: "x" },
    price: 7900,
    stock: 0,
    active: true,
    extra: { colors: [{ name: "Silver", hex: "#ccc" }] }
  };
  const p = rowToProduct(
    row,
    [
      { id: "v1", color: "Silver", storage: "64 GB", price_delta: 0, stock: 5 },
      { id: "v2", color: "Silver", storage: "256 GB", price_delta: 5000, stock: 3 }
    ],
    []
  );
  assert.deepEqual(
    p.options.map((o) => o.name),
    ["Color", "Storage"]
  );
  assert.deepEqual(p.options[1].values, ["64 GB", "256 GB"]);
  const big = p.variants.find((v) => v.o2 === "256 GB");
  assert.equal(big.o1, "Silver");
  assert.equal(big.price, 12900);
  assert.equal(big.title, "Silver / 256 GB");
  assert.equal(p.stock, 8);
});

test("rowToProduct: early-seed variant rows (no color/storage columns) get their axes back by position", () => {
  const row = {
    id: "tablet-10",
    handle: "tablet-10",
    title: { ar: "t", fr: "t" },
    price: 83740,
    stock: 16,
    active: true,
    extra: { options: [{ name: "Storage", values: ["64 GB", "256 GB"] }], colors: [{ name: "Black", hex: "#111827" }] }
  };
  const p = rowToProduct(
    row,
    [
      { id: "1023", color: null, storage: null, price_delta: 0, stock: 8 },
      { id: "1024", color: null, storage: null, price_delta: 10050, stock: 8 }
    ],
    []
  );
  assert.deepEqual(
    p.options.map((o) => o.name),
    ["Color", "Storage"]
  );
  const big = p.variants[1];
  assert.equal(big.o1, null, "no colour on the row → any colour");
  assert.equal(big.o2, "256 GB");
  assert.equal(big.price, 93790);
  assert.equal(p.variants[0].o2, "64 GB");
});

test("productToRow: legacy o1/o2 variants are written into the color/storage columns (two non-colour axes join)", () => {
  const { variants } = productToRow({
    handle: "laptop",
    title: { ar: "l", fr: "l" },
    price: 15900,
    stock: 4,
    options: [
      { name: "RAM", values: ["8 GB", "16 GB"] },
      { name: "SSD", values: ["256 GB", "512 GB"] }
    ],
    variants: [
      { id: 1015, o1: "8 GB", o2: "256 GB", price: 15900 },
      { id: 1018, o1: "16 GB", o2: "512 GB", price: 19716 }
    ]
  });
  assert.equal(variants[0].storage, "8 GB / 256 GB");
  assert.equal(variants[0].color, null);
  assert.equal(variants[1].price_delta, 3816);
  const back = rowToProduct(
    {
      id: "laptop",
      handle: "laptop",
      title: { ar: "l", fr: "l" },
      price: 15900,
      stock: 4,
      extra: {
        options: [
          { name: "RAM", values: ["8 GB", "16 GB"] },
          { name: "SSD", values: ["256 GB", "512 GB"] }
        ]
      }
    },
    variants,
    []
  );
  assert.equal(back.variants[1].o1, "16 GB");
  assert.equal(back.variants[1].o2, "512 GB");
});

test("rowToProduct: positional axes do not depend on the order PostgREST returns the rows (demo1 tablet-10)", () => {
  const row = {
    id: "tablet-10",
    handle: "tablet-10",
    title: { ar: "t", fr: "t" },
    price: 83740,
    stock: 13,
    active: true,
    extra: { options: [{ name: "Storage", values: ["64 GB", "256 GB"] }] }
  };
  const p = rowToProduct(
    row,
    [
      { id: "1024", color: null, storage: null, price_delta: 10050, stock: 8 },
      { id: "1023", color: null, storage: null, price_delta: 0, stock: 5 }
    ],
    []
  );
  assert.deepEqual(
    p.variants.map((v) => [v.id, v.o1, v.price]),
    [
      ["1023", "64 GB", 83740],
      ["1024", "256 GB", 93790]
    ]
  );
});
