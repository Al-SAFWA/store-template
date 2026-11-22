import test from "node:test";
import assert from "node:assert/strict";
import {
  COLLECTION_ALIASES,
  collectionHandleFromHref,
  isCollectionVisible,
  productInCollection,
  resolveCollectionHandle,
  visibleBarEntries
} from "../assets/js/domain/collection-aliases.js";

test("resolveCollectionHandle: maps legacy Restore slugs onto the demo catalog", () => {
  assert.equal(resolveCollectionHandle("restore-anniversary"), "special-offers");
  assert.equal(resolveCollectionHandle("refurbished-iphones"), "phones");
  assert.equal(resolveCollectionHandle("used-samsung"), "android");
  assert.equal(resolveCollectionHandle("ipads"), "tablets");
  assert.equal(resolveCollectionHandle("apple-watches"), "watches");
  assert.equal(resolveCollectionHandle("chargers-power-banks-cables"), "chargers");
  assert.equal(resolveCollectionHandle("cases-screen-protectors"), "accessories");
});

test("resolveCollectionHandle: keeps real handles, all, and empty", () => {
  assert.equal(resolveCollectionHandle("phones"), "phones");
  assert.equal(resolveCollectionHandle("all"), "all");
  assert.equal(resolveCollectionHandle(""), "all");
  assert.equal(resolveCollectionHandle("  special-offers  "), "special-offers");
});

test("every alias target is a distinct catalog handle, not another alias", () => {
  for (const [from, to] of Object.entries(COLLECTION_ALIASES)) {
    assert.equal(COLLECTION_ALIASES[to], undefined, `${from} → ${to} must not chain`);
  }
});

test("productInCollection matches both live handles and legacy slugs", () => {
  const product = { collections: ["refurbished-iphones", "special-offers"] };
  assert.equal(productInCollection(product, "phones"), true);
  assert.equal(productInCollection(product, "refurbished-iphones"), true);
  assert.equal(productInCollection(product, "android"), false);
  assert.equal(productInCollection(product, "all"), true);
});

test("collectionHandleFromHref and isCollectionVisible", () => {
  assert.equal(collectionHandleFromHref("collection.html?handle=restore-anniversary"), "special-offers");
  assert.equal(collectionHandleFromHref("page.html?slug=about"), "");
  const collections = [
    { handle: "phones", visible: true },
    { handle: "android", visible: false }
  ];
  assert.equal(isCollectionVisible(collections, "refurbished-iphones"), true);
  assert.equal(isCollectionVisible(collections, "used-samsung"), false);
  assert.equal(isCollectionVisible(collections, "all"), true);
});

test("visibleBarEntries: hidden or missing collections stay off the bar", () => {
  const theme = [
    { handle: "special-offers", label: "عروض", image: "a.svg" },
    { handle: "phones", label: "هواتف", image: "b.svg" },
    { handle: "android", label: "أندرويد", image: "c.svg" }
  ];
  const collections = [
    { handle: "special-offers", title: { ar: "عروض" }, visible: true },
    { handle: "phones", title: { ar: "هواتف" }, visible: false }
  ];
  const cards = visibleBarEntries(theme, collections);
  assert.deepEqual(
    cards.map((c) => c.handle),
    ["special-offers"]
  );
  assert.equal(
    visibleBarEntries([{ handle: "restore-anniversary" }], [{ handle: "special-offers", visible: true }])[0].handle,
    "special-offers"
  );
});

test("visibleBarEntries: empty theme falls back to live collections", () => {
  const collections = [
    { handle: "phones", title: { ar: "هواتف" }, visible: true },
    { handle: "android", title: { ar: "أندرويد" }, visible: true },
    { handle: "laptops", title: { ar: "حواسيب" }, visible: false }
  ];
  assert.deepEqual(
    visibleBarEntries([], collections).map((c) => c.handle),
    ["phones", "android"]
  );
  assert.deepEqual(
    visibleBarEntries(null, collections).map((c) => c.handle),
    ["phones", "android"]
  );
});
