import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../assets/css/dashboard.css", import.meta.url), "utf8");
const helpers = readFileSync(new URL("../assets/js/ui/dashboard/04-modal-helpers.js", import.meta.url), "utf8");

test("product editor grids can shrink: minmax(0,1fr) and min-width 0 on fields", () => {
  assert.match(css, /\.pe-two \{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /\.pe-media \{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /\.pe-field input, \.pe-field select, \.pe-field textarea \{[^}]*min-width:\s*0/);
  assert.match(css, /\.pe-field input, \.pe-field select, \.pe-field textarea \{[^}]*width:\s*100%/);
  assert.equal(css.includes("grid-template-columns: 1fr 1fr !important"), false);
});

test("dash-modal is a shrinkable flex item and the phone editor is a column with a scrolling body", () => {
  assert.match(css, /\.dash-modal \{[^}]*min-width:\s*0/);
  assert.match(css, /\.dash-modal \{[^}]*max-width:\s*100%/);
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /\.dash-modal:has\(\.pe\) \{[\s\S]*?display:\s*flex;\s*flex-direction:\s*column/);
  assert.match(css, /\.dash-modal-body:has\(\.pe\) \{[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /position:\s*static;\s*flex:\s*0 0 auto/);
  assert.match(css, /env\(safe-area-inset-bottom/);
});

test("opening a dashboard modal locks html and body scroll", () => {
  assert.match(helpers, /document\.documentElement\.classList\.add\("no-scroll"\)/);
  assert.match(helpers, /document\.body\.classList\.add\("no-scroll"\)/);
  assert.match(helpers, /document\.documentElement\.classList\.remove\("no-scroll"\)/);
});

test("saving coupons keeps the dashboard draft instead of reverting to published defaults", () => {
  const misc = readFileSync(new URL("../assets/js/ui/dashboard/23-events-misc.js", import.meta.url), "utf8");
  const save = readFileSync(new URL("../assets/js/ui/dashboard/22d-actions-settings.js", import.meta.url), "utf8");
  const catalog = readFileSync(new URL("../assets/js/services/08-catalog.js", import.meta.url), "utf8");
  const publish = readFileSync(new URL("../assets/js/services/07-publish.js", import.meta.url), "utf8");
  assert.match(misc, /ctx\.dirty \|\| ctx\.R\.draft/);
  assert.match(save, /finalizeCouponBuffer\(ctx\)/);
  assert.match(save, /ctx\.saveDraftNow\(\)/);
  assert.match(catalog, /if \(Array\.isArray\(coupons\)\) \{/);
  assert.equal(catalog.includes("coupons.length"), false);
  assert.match(publish, /remoteIsNewer\(remote\) && !ctx\.draft/);
});
