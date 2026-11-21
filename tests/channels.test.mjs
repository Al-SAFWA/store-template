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
