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
  if (!item.name) errors.push(`صنف بدون اسم: ${label}`);
  if (!categoryIds.has(item.category)) errors.push(`"${label}": التصنيف "${item.category}" غير موجود`);

  const hasPrice = item.price !== undefined;
  const hasSizes = Array.isArray(item.sizes) && item.sizes.length > 0;
  if (hasPrice === hasSizes) errors.push(`"${label}": يجب أن يكون له price أو sizes (واحد فقط)`);
  if (hasPrice && !isPrice(item.price)) errors.push(`"${label}": السعر يجب أن يكون رقمًا بدون علامات تنصيص`);
  for (const s of item.sizes ?? []) {
    if (!s.label || !isPrice(s.price)) errors.push(`"${label}": حجم غير صالح ${JSON.stringify(s)}`);
  }
  if (item.available !== undefined && typeof item.available !== "boolean") {
    errors.push(`"${label}": available يجب أن تكون true أو false`);
  }
}

for (const x of data.extras ?? []) {
  if (!x.name || !isPrice(x.price)) errors.push(`إضافة غير صالحة: ${JSON.stringify(x)}`);
}

if (errors.length) {
  console.error("❌ وُجدت أخطاء:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`✅ المنيو سليمة: ${itemIds.size} صنف في ${categoryIds.size} تصنيفات`);
