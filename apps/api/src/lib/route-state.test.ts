import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionRoute } from "@viteg/shared";

test("permite el flujo operativo normal", () => {
  assert.equal(canTransitionRoute("DRAFT", "SCHEDULED"), true);
  assert.equal(canTransitionRoute("ASSIGNED", "IN_PROGRESS"), true);
  assert.equal(canTransitionRoute("IN_PROGRESS", "COMPLETED"), true);
});

test("impide reabrir rutas terminales", () => {
  assert.equal(canTransitionRoute("COMPLETED", "IN_PROGRESS"), false);
  assert.equal(canTransitionRoute("CANCELLED", "DRAFT"), false);
});
