// اختبار منطق السلة:  node tools/test-order.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const Order = createRequire(import.meta.url)("../assets/js/order.js");

const data = {
  items: [
    { id: "sand", name: "سندويش", sizes: [{ label: "عادي", price: 5 }, { label: "كبير", price: 8 }] },
    { id: "hummus", name: "حمص", price: 7.5 },
    { id: "fries", name: "بطاطس", price: 5, available: false },
    { id: "bad", name: "بلا سعر" }
  ],
  extras: [{ id: "cheese", name: "زيادة جبنة", price: 2.25 }, { name: "بلا id", price: 1 }]
};
const catalog = Order.buildCatalog(data);
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test("الكتالوج يستبعد غير المتوفر وغير المسعّر وإضافة بلا id", () => {
  assert.deepEqual(Object.keys(catalog).sort(), ["extra:cheese|", "hummus|", "sand|عادي", "sand|كبير"].sort());
});

test("المجموع بأسعار عشرية صحيح", () => {
  let lines = Order.addLine([], catalog["hummus|"], 1);
  lines = Order.addLine(lines, catalog["extra:cheese|"], 1);
  assert.equal(Order.totalMinor(lines), 975);
  // 0.1 + 0.2 لا يعطي 0.30000000000000004
  assert.equal(Order.totalMinor([{ unitMinor: Order.toMinor(0.1), qty: 1 }, { unitMinor: Order.toMinor(0.2), qty: 1 }]), 30);
});

test("حجمان لصنف واحد = سطران، والحجم نفسه يزيد الكمية", () => {
  let lines = Order.addLine([], catalog["sand|عادي"]);
  lines = Order.addLine(lines, catalog["sand|كبير"]);
  lines = Order.addLine(lines, catalog["sand|عادي"]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].qty, 2);
  assert.equal(Order.count(lines), 3);
});

test("حد الكمية 99 ولا يتجاوزه", () => {
  let lines = Order.addLine([], catalog["hummus|"], 98);
  lines = Order.addLine(lines, catalog["hummus|"], 5);
  assert.equal(lines[0].qty, 99);
});

test("setQty: صفر أو سالب أو NaN يحذف السطر", () => {
  const base = Order.addLine([], catalog["hummus|"], 3);
  assert.equal(Order.setQty(base, "hummus|", 0).length, 0);
  assert.equal(Order.setQty(base, "hummus|", -2).length, 0);
  assert.equal(Order.setQty(base, "hummus|", NaN).length, 0);
  assert.equal(Order.setQty(base, "hummus|", 5)[0].qty, 5);
});

test("addLine لا يعدّل المصفوفة الأصلية", () => {
  const base = Order.addLine([], catalog["hummus|"]);
  Order.addLine(base, catalog["hummus|"]);
  assert.equal(base[0].qty, 1);
});

test("reconcile: يحذف المفقود وغير المتوفر ويحدّث السعر ويدمج المكرر", () => {
  const saved = [
    { key: "hummus|", qty: 2 },
    { key: "hummus|", qty: 1 },
    { key: "fries|", qty: 1 },
    { key: "removed|", qty: 1 },
    { key: "__proto__|", qty: 1 },
    { key: "sand|عادي", qty: 500 },
    { key: "sand|كبير", qty: 0 },
    null,
    { qty: 1 }
  ];
  const lines = Order.reconcile(saved, catalog);
  assert.deepEqual(lines.map((l) => [l.key, l.qty]), [["hummus|", 3], ["sand|عادي", 99]]);
  assert.equal(Order.reconcile("garbage", catalog).length, 0);
  assert.equal(Order.reconcile(undefined, catalog).length, 0);
});

test("الرسالة: أسطر الأصناف والحجم والإجمالي", () => {
  let lines = Order.addLine([], catalog["sand|كبير"], 2);
  lines = Order.addLine(lines, catalog["hummus|"], 1);
  assert.equal(
    Order.buildMessage(lines, "ر.س"),
    "السلام عليكم، أرغب بالطلب:\n- 2 × سندويش (كبير) = 16 ر.س\n- 1 × حمص = 7.5 ر.س\nالإجمالي: 23.5 ر.س"
  );
});

test("الرابط يرمّز الأحرف الخاصة ولا ينكسر", () => {
  const msg = "طلب & خاص #1 ?x=y\n50%";
  const { url } = Order.buildUrl("966500000000", msg);
  assert.ok(url.startsWith("https://wa.me/966500000000?text="));
  const text = new URL(url).searchParams.get("text");
  assert.equal(text, msg);
});

test("الرقم غير الصالح يعطي url = null", () => {
  for (const bad of ["", "   ", "abc", "0966500000000", "123", "1".repeat(16), null, undefined]) {
    assert.equal(Order.buildUrl(bad, "x").url, null, String(bad));
  }
  assert.equal(Order.normalizeNumber("+966 50-000 0000"), "966500000000");
});

test("رسالة أطول من الحد: tooLong ولا رابط", () => {
  const r = Order.buildUrl("966500000000", "ب".repeat(Order.MAX_MESSAGE_CHARS + 1));
  assert.equal(r.url, null);
  assert.equal(r.tooLong, true);
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log("✅ " + name); }
  catch (e) { failed++; console.error("❌ " + name + "\n   " + e.message); }
}
if (failed) process.exit(1);
console.log(`\n✅ نجحت ${tests.length} اختبارات`);
