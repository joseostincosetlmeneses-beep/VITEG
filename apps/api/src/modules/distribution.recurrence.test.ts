import assert from "node:assert/strict";
import test from "node:test";
import { nextRecurringDate } from "./distribution.js";

test("calcula la siguiente jornada del mismo día semanal", () => {
  const next = nextRecurringDate(new Date("2026-10-26T12:00:00"), [1]);
  assert.equal(next?.toISOString().slice(0, 10), "2026-11-02");
});

test("elige el siguiente día entre varios días fijos", () => {
  const next = nextRecurringDate(new Date("2026-10-26T12:00:00"), [1, 3, 5]);
  assert.equal(next?.toISOString().slice(0, 10), "2026-10-28");
});

test("respeta la fecha final de recurrencia", () => {
  const next = nextRecurringDate(new Date("2026-10-26T12:00:00"), [1], new Date("2026-10-30T23:59:59"));
  assert.equal(next, null);
});
