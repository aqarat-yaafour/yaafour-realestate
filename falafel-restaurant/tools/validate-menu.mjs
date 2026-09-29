// فحص ملف المنيو قبل النشر:  node tools/validate-menu.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../data/menu.json", import.meta.url));
const errors = [];

let data;
try {
  data = JSON.parse(readFileSync(path, "utf8"));
} catch (e) {
  console.error("❌ الملف ليس JSON صالحًا (غالبًا فاصلة ناقصة أو زائدة):\n" + e.message);
  process.exit(1);
}

const isPrice = (p) => typeof p === "number" && Number.isFinite(p) && p >= 0;

if (!data.restaurant?.name) errors.push("اسم المطعم (restaurant.name) مفقود");
if (!data.restaurant?.currency) errors.push("العملة (restaurant.currency) مفقودة");

const warnings = [];
const wa = data.restaurant?.whatsapp;
if (wa === undefined || wa === "" || wa === null) {
  warnings.push("رقم واتساب (restaurant.whatsapp) فارغ: الطلب عبر واتساب غير مفعّل");
} else if (typeof wa !== "string" || !/^[1-9]\d{7,14}$/.test(wa)) {
  errors.push('رقم واتساب يجب أن يكون نصًا من 8 إلى 15 رقمًا بالصيغة الدولية بدون + ولا أصفار بادئة (مثل "9665XXXXXXXX")');
}

const categoryIds = new Set();
for (const c of data.categories ?? []) {
  if (!c.id || !c.name) errors.push(`تصنيف ناقص: ${JSON.stringify(c)}`);
  if (categoryIds.has(c.id)) errors.push(`تصنيف مكرر: ${c.id}`);
  categoryIds.add(c.id);
}

const itemIds = new Set();
for (const item of data.items ?? []) {
  const label = item.name || item.id || JSON.stringify(item);
  if (!item.id) errors.push(`صنف بدون id: ${label}`);
  else if (itemIds.has(item.id)) errors.push(`id مكرر: ${item.id}`);
  itemIds.add(item.id);
  if (typeof item.id === "string" && item.id.includes("|")) errors.push(`id لا يجوز أن يحتوي "|": ${item.id}`);
  if (!item.name) errors.push(`صنف بدون اسم: ${label}`);
  if (!categoryIds.has(item.category)) errors.push(`"${label}": التصنيف "${item.category}" غير موجود`);

  const hasPrice = item.price !== undefined;
  const hasSizes = Array.isArray(item.sizes) && item.sizes.length > 0;
  if (hasPrice === hasSizes) errors.push(`"${label}": يجب أن يكون له price أو sizes (واحد فقط)`);
  if (hasPrice && !isPrice(item.price)) errors.push(`"${label}": السعر يجب أن يكون رقمًا بدون علامات تنصيص`);
  const sizeLabels = new Set();
  for (const s of item.sizes ?? []) {
    if (!s.label || !isPrice(s.price)) errors.push(`"${label}": حجم غير صالح ${JSON.stringify(s)}`);
    if (sizeLabels.has(s.label)) errors.push(`"${label}": حجم مكرر "${s.label}"`);
    sizeLabels.add(s.label);
  }
  if (item.available !== undefined && typeof item.available !== "boolean") {
    errors.push(`"${label}": available يجب أن تكون true أو false`);
  }
}

const extraIds = new Set();
for (const x of data.extras ?? []) {
  if (!x.name || !isPrice(x.price)) errors.push(`إضافة غير صالحة: ${JSON.stringify(x)}`);
  if (!x.id) errors.push(`إضافة بدون id: ${x.name || JSON.stringify(x)}`);
  else if (extraIds.has(x.id)) errors.push(`id إضافة مكرر: ${x.id}`);
  else if (String(x.id).includes("|")) errors.push(`id لا يجوز أن يحتوي "|": ${x.id}`);
  extraIds.add(x.id);
}

for (const w of warnings) console.warn("⚠️  " + w);

if (errors.length) {
  console.error("❌ وُجدت أخطاء:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`✅ المنيو سليمة: ${itemIds.size} صنف في ${categoryIds.size} تصنيفات`);
