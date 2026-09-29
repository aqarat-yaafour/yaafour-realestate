// اختبار حالة مفتوح/مغلق:  node tools/test-hours.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const Hours = createRequire(import.meta.url)("../assets/js/hours.js");
const RUH = "Asia/Riyadh"; // UTC+3 بلا توقيت صيفي
const at = (utc) => new Date(utc);
const tests = [];
const test = (n, f) => tests.push([n, f]);

test("نطاق عادي 06:00-24:00", () => {
  const s = { open: "06:00", close: "24:00" };
  assert.equal(Hours.isOpen(s, RUH, at("2026-09-29T03:00:00Z")), true);  // 06:00 الرياض
  assert.equal(Hours.isOpen(s, RUH, at("2026-09-29T02:59:00Z")), false); // 05:59
  assert.equal(Hours.isOpen(s, RUH, at("2026-09-29T20:59:00Z")), true);  // 23:59
  assert.equal(Hours.isOpen(s, RUH, at("2026-09-29T21:00:00Z")), false); // 00:00 (الإغلاق حصري)
});

test("دوام يعبر منتصف الليل 18:00-02:00", () => {
  const s = { open: "18:00", close: "02:00" };
  assert.equal(Hours.isOpen(s, RUH, at("2026-09-29T15:00:00Z")), true);  // 18:00
  assert.equal(Hours.isOpen(s, RUH, at("2026-09-29T22:30:00Z")), true);  // 01:30
  assert.equal(Hours.isOpen(s, RUH, at("2026-09-29T23:00:00Z")), false); // 02:00
  assert.equal(Hours.isOpen(s, RUH, at("2026-09-29T12:00:00Z")), false); // 15:00
});

test("المنطقة الزمنية للمطعم لا لجهاز الزبون", () => {
  const s = { open: "09:00", close: "17:00" };
  const t = at("2026-09-29T07:00:00Z"); // 10:00 الرياض، 03:00 نيويورك
  assert.equal(Hours.isOpen(s, RUH, t), true);
  assert.equal(Hours.isOpen(s, "America/New_York", t), false);
});

test("بيانات ناقصة أو غير صالحة تعطي null", () => {
  const now = at("2026-09-29T10:00:00Z");
  for (const [s, tz] of [
    [undefined, RUH], [{}, RUH], [{ open: "06:00" }, RUH],
    [{ open: "06:00", close: "06:00" }, RUH],
    [{ open: "25:00", close: "12:00" }, RUH],
    [{ open: "24:00", close: "12:00" }, RUH],
    [{ open: "6am", close: "12:00" }, RUH],
    [{ open: "06:00", close: "12:00" }, ""],
    [{ open: "06:00", close: "12:00" }, "Mars/Base"]
  ]) assert.equal(Hours.isOpen(s, tz, now), null, JSON.stringify([s, tz]));
});

test("validTimeZone", () => {
  assert.equal(Hours.validTimeZone(RUH), true);
  assert.equal(Hours.validTimeZone("Mars/Base"), false);
});

let failed = 0;
for (const [n, f] of tests) {
  try { f(); console.log("✅ " + n); } catch (e) { failed++; console.error("❌ " + n + "\n   " + e.message); }
}
if (failed) process.exit(1);
console.log(`\n✅ نجحت ${tests.length} اختبارات`);
