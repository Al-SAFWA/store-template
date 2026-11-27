import test from "node:test";
import assert from "node:assert/strict";
import {
  applySiteSettingsToState,
  defaultSiteSettings,
  mergeSiteSettings,
  siteSettingVisible,
  siteText,
  SITE_SETTING_DEFS
} from "../assets/js/domain/site-settings.js";

test("defaults include required keys; trusted_by is hidden", () => {
  const ss = defaultSiteSettings();
  for (const key of ["return_days", "no_risk", "refurbished_label", "offers_label", "trusted_by"]) {
    assert.ok(ss[key], key);
  }
  assert.equal(ss.trusted_by.is_visible, false);
  assert.equal(ss.refurbished_label.is_visible, false);
  assert.equal(ss.return_days.value, 10);
  assert.equal(ss.offers_label.value.ar, "عروض");
  assert.equal(ss.categories_title.value.ar.includes("مجدد"), false);
  assert.equal(SITE_SETTING_DEFS.length >= 8, true);
});

test("siteText respects visibility", () => {
  const settings = {
    siteSettings: mergeSiteSettings({ trusted_by: { value: { ar: "X", fr: "Y" }, is_visible: false } })
  };
  assert.equal(siteSettingVisible(settings, "trusted_by"), false);
  assert.equal(siteText(settings, "trusted_by", "ar"), "");
  settings.siteSettings.trusted_by.is_visible = true;
  assert.equal(siteText(settings, "trusted_by", "ar"), "X");
});

test("applySiteSettingsToState copies return days and offers title", () => {
  const settings = {
    storeName: { ar: "متجر", fr: "Shop" },
    homeSections: [{ id: "anniversary", collection: "special-offers", title: { ar: "old", fr: "old" } }],
    siteSettings: mergeSiteSettings({
      return_days: { value: 14, is_visible: true },
      offers_label: { value: { ar: "عروض", fr: "Offres" }, is_visible: true }
    })
  };
  applySiteSettingsToState(settings, "ar");
  assert.equal(settings.returnDays, 14);
  assert.equal(settings.homeSections[0].title.ar, "عروض");
});

test("applySiteSettingsToState does not overlay default announcement over typed copy", () => {
  const settings = {
    announcement: { ar: "عرض العيد", fr: "Offre Aid" },
    siteSettings: mergeSiteSettings({
      announcement: {
        value: {
          ar: "توصيل مجاني داخل نواكشوط • الدفع عند الاستلام أو عبر بنكيلي",
          fr: "Livraison gratuite à Nouakchott • Paiement à la livraison ou Bankily"
        },
        is_visible: true
      }
    })
  };
  applySiteSettingsToState(settings, "ar");
  assert.equal(settings.announcement.ar, "عرض العيد");
  assert.equal(settings.siteSettings.announcement.value.ar, "عرض العيد");
});

test("mergeSiteSettings keeps custom legacy announcement over a default saved row", () => {
  const merged = mergeSiteSettings(
    {
      announcement: {
        value: {
          ar: "توصيل مجاني داخل نواكشوط • الدفع عند الاستلام أو عبر بنكيلي",
          fr: "Livraison gratuite à Nouakchott • Paiement à la livraison ou Bankily"
        },
        is_visible: true
      }
    },
    { announcement: { ar: "عرض العيد", fr: "Offre Aid" } }
  );
  assert.equal(merged.announcement.value.ar, "عرض العيد");
});
