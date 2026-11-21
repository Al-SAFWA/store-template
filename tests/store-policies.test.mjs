import test from "node:test";
import assert from "node:assert/strict";
import {
  applyReturnDays,
  clampReturnDays,
  isNoRiskVisible,
  isReturnEnabled,
  returnLabel
} from "../assets/js/domain/store-policies.js";

test("clampReturnDays: default 10, range 1–90", () => {
  assert.equal(clampReturnDays(undefined), 10);
  assert.equal(clampReturnDays(0), 10);
  assert.equal(clampReturnDays(14), 14);
  assert.equal(clampReturnDays(200), 90);
});

test("applyReturnDays: placeholder and hardcoded 10-day copy", () => {
  assert.equal(applyReturnDays("إرجاع خلال {returnDays} أيام", 14), "إرجاع خلال 14 أيام");
  assert.equal(applyReturnDays("إرجاع خلال 10 أيام", 7), "إرجاع خلال 7 أيام");
  assert.equal(applyReturnDays("Retour sous 10 jours", 7), "Retour sous 7 jours");
});

test("returnLabel / flags", () => {
  assert.equal(isReturnEnabled({}), true);
  assert.equal(isReturnEnabled({ returnEnabled: false }), false);
  assert.equal(returnLabel({ returnDays: 14 }, "ar"), "إرجاع خلال 14 أيام");
  assert.equal(returnLabel({ returnEnabled: false, returnDays: 14 }, "ar"), "");
  assert.equal(isNoRiskVisible({}), true);
  assert.equal(isNoRiskVisible({ noRisk: { visible: false } }), false);
});
