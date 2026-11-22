import test from "node:test";
import assert from "node:assert/strict";
import { applyChannelsToSettings, visibleChannel, whatsappDigits } from "../assets/js/domain/channels.js";

test("empty or hidden channels are omitted", () => {
  const settings = applyChannelsToSettings({
    whatsapp: "22244123456",
    email: "",
    channels: {
      whatsapp: { value: "22244123456", visible: true },
      email: { value: "old@x.com", visible: true },
      instagram: { value: "https://instagram.com/x", visible: false }
    }
  });
  assert.equal(whatsappDigits(settings), "22244123456");
  assert.equal(visibleChannel(settings, "email"), null);
  assert.equal(visibleChannel(settings, "instagram"), null);
  assert.equal(
    settings.social.some((item) => item.id === "instagram"),
    false
  );
});

test("hidden whatsapp is not used for the order button", () => {
  const settings = applyChannelsToSettings({
    channels: { whatsapp: { value: "22200000000", visible: false } }
  });
  assert.equal(whatsappDigits(settings), "");
});

test("fake merchant socials appear when filled", () => {
  const settings = applyChannelsToSettings(
    {},
    {
      social: {
        facebook: "https://facebook.com/demo.store",
        instagram: "https://instagram.com/demo.store",
        tiktok: "https://www.tiktok.com/@demo.store"
      }
    }
  );
  assert.equal(visibleChannel(settings, "facebook")?.value, "https://facebook.com/demo.store");
  assert.equal(visibleChannel(settings, "instagram")?.value, "https://instagram.com/demo.store");
  assert.equal(visibleChannel(settings, "tiktok")?.value, "https://www.tiktok.com/@demo.store");
  assert.deepEqual(
    settings.social.map((item) => item.id),
    ["facebook", "instagram", "tiktok"]
  );
});

test("empty brand social strings do not hide a saved URL", () => {
  const settings = applyChannelsToSettings(
    { social: [{ id: "facebook", href: "https://facebook.com/shop" }] },
    { social: { facebook: "", instagram: "", tiktok: "" } }
  );
  assert.equal(visibleChannel(settings, "facebook")?.value, "https://facebook.com/shop");
  assert.equal(visibleChannel(settings, "instagram"), null);
});

test("empty saved socials do not hide brand URLs", () => {
  const settings = applyChannelsToSettings(
    { channels: { facebook: { value: "", visible: true }, tiktok: { value: "", visible: true } } },
    {
      social: {
        facebook: "https://facebook.com/demo.store",
        instagram: "https://instagram.com/demo.store",
        tiktok: "https://www.tiktok.com/@demo.store"
      }
    }
  );
  assert.equal(visibleChannel(settings, "facebook")?.value, "https://facebook.com/demo.store");
  assert.equal(visibleChannel(settings, "instagram")?.value, "https://instagram.com/demo.store");
  assert.equal(visibleChannel(settings, "tiktok")?.value, "https://www.tiktok.com/@demo.store");
});
