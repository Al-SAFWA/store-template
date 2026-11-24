#!/usr/bin/env node
/* Renders everything static from assets/js/brand.config.js:
   <title>/<meta description> of every page, manifest, robots, sitemap, text logos, favicon, theme colour.
   Idempotent — safe to run any time (npm run brand). */
import fs from "node:fs";
import vm from "node:vm";
const root = process.argv[2] || ".";
const P = (f) => `${root}/${f}`;
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(P("assets/js/brand.config.js"), "utf8"), ctx);
const B = ctx.window.BRAND;
const ar = B.name.ar,
  fr = B.name.fr,
  tag = B.tagline?.ar || "",
  site = B.domain ? `https://${B.domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : "";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const pages = {
  "index.html": [`${ar} | ${tag}`.replace(/ \| $/, ""), `${ar} — ${tag}. ${B.city?.ar || ""}`],
  "collection.html": [`تسوق | ${ar}`, `تسوق منتجات ${ar}.`],
  "product.html": [`المنتج | ${ar}`, `تفاصيل المنتج من ${ar}.`],
  "checkout.html": [`إتمام الطلب | ${ar}`, `أكمل طلبك من ${ar}.`],
  "wishlist.html": [`المفضلة | ${ar}`, `المنتجات المحفوظة في مفضلة ${ar}.`],
  "account.html": [`حسابي | ${ar}`, `تتبع طلباتك من ${ar}.`],
  "page.html": [`معلومات | ${ar}`, `معلومات ${ar}.`],
  "dashboard.html": [`لوحة تحكم ${ar} | ${fr} Dashboard`, `لوحة تحكم متجر ${ar}.`]
};
for (const [file, [title, desc]] of Object.entries(pages)) {
  if (!fs.existsSync(P(file))) continue;
  let h = fs.readFileSync(P(file), "utf8");
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  h = h.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`);
  h = h.replace(
    /<meta name="theme-color" content="[^"]*">/,
    `<meta name="theme-color" content="${B.colors?.primary || "#2563eb"}">`
  );
  fs.writeFileSync(P(file), h);
}
// manifest
const m = JSON.parse(fs.readFileSync(P("manifest.webmanifest"), "utf8"));
m.name = `${ar}${tag ? " | " + tag : ""}`;
m.short_name = ar;
m.description = tag || ar;
m.theme_color = B.colors?.primary || "#2563eb";
fs.writeFileSync(P("manifest.webmanifest"), JSON.stringify(m, null, 2) + "\n");
// robots + sitemap
fs.writeFileSync(
  P("robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /dashboard.html
Disallow: /guide.html\n${site ? `\nSitemap: ${site}/sitemap.xml\n` : ""}`
);
const dataSrc = fs.readFileSync(P("assets/js/data.js"), "utf8");
const data = JSON.parse(dataSrc.slice(dataSrc.indexOf("{"), dataSrc.lastIndexOf("}") + 1));
const url = (u, pr, cf = "weekly") =>
  `  <url><loc>${site}/${u}</loc><changefreq>${cf}</changefreq><priority>${pr}</priority></url>`;
const sm = site
  ? [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      url("", "1.0"),
      url("collection.html?handle=all", "0.9"),
      ...["about-us", "help", "contact"].map((s) => url(`page.html?slug=${s}`, "0.5")),
      ...data.collections.map((c) => url(`collection.html?handle=${c.handle}`, "0.8")),
      ...data.products.map((p) => url(`product.html?handle=${p.handle}`, "0.7")),
      `</urlset>`
    ].join("\n") + "\n"
  : `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Set BRAND.domain in assets/js/brand.config.js and run: npm run brand -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`;
fs.writeFileSync(P("sitemap.xml"), sm);
// Keep bag-mark artwork in assets/img/brand-logo*.svg — never rewrite those files here
// (client updates used to stamp a letter + the merchant name over the mark).
// _headers (Cloudflare Pages / Netlify) — always regenerated from vercel.json so both hosts share one policy
const vercel = JSON.parse(fs.readFileSync(P("vercel.json"), "utf8"));
fs.writeFileSync(
  P("_headers"),
  vercel.headers
    .map(
      (h) =>
        `${h.source.replace(/\(\.\*\)/g, "*").replace(/\/\(([^)]+)\)/, (m, g) => "/" + g.split("|")[0])}\n` +
        h.headers.map((x) => `  ${x.key}: ${x.value}`).join("\n")
    )
    .join("\n\n") + "\n"
);
console.log(`brand applied: ${ar} / ${fr}${site ? " @ " + site : " (no domain yet)"}`);
