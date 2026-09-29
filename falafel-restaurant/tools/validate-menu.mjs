// فحص ملف المنيو قبل النشر:  node tools/validate-menu.mjs
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const Hours = createRequire(import.meta.url)("../assets/js/hours.js");

const path = fileURLToPath(new URL("../data/menu.json", import.meta.url));
const errors = [];
const MAX_IMAGE_BYTES = 150 * 1024;

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

const r = data.restaurant ?? {};
if (r.schedule !== undefined) {
  if (Hours.parseTime(r.schedule?.open, false) === null || Hours.parseTime(r.schedule?.close, true) === null) {
    errors.push('ساعات الدوام (restaurant.schedule) يجب أن تكون بصيغة {"open":"06:00","close":"24:00"}');
  } else if (r.schedule.open === r.schedule.close) {
    errors.push("restaurant.schedule: وقت الفتح والإغلاق متطابقان");
  }
  if (!Hours.validTimeZone(r.timezone)) errors.push('المنطقة الزمنية (restaurant.timezone) غير صالحة، مثل "Asia/Riyadh"');
} else {
  warnings.push("restaurant.schedule غير موجود: لن تظهر شارة «مفتوح الآن / مغلق»");
}
if (r.mapsUrl && !/^https:\/\//.test(r.mapsUrl)) errors.push("restaurant.mapsUrl يجب أن يبدأ بـ https://");
if (r.phone && !/^\+?\d{6,15}$/.test(String(r.phone).replace(/[\s-]/g, ""))) {
  errors.push("restaurant.phone يجب أن يكون أرقامًا فقط (يمكن أن يبدأ بـ +)");
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

  if (item.badge !== undefined && (typeof item.badge !== "string" || !item.badge.trim() || item.badge.length > 20)) {
    errors.push(`"${label}": badge يجب أن يكون نصًا قصيرًا (حتى 20 حرفًا)`);
  }
  if (item.image !== undefined) {
    if (typeof item.image !== "string" || !/^[\w.-]+\.(webp|jpe?g|png)$/i.test(item.image) || item.image.includes("..")) {
      errors.push(`"${label}": image يجب أن يكون اسم ملف فقط بامتداد webp أو jpg أو png (بدون مسار)`);
    } else {
      const imgPath = fileURLToPath(new URL("../assets/img/items/" + item.image, import.meta.url));
      if (!existsSync(imgPath)) errors.push(`"${label}": الصورة غير موجودة في assets/img/items/: ${item.image}`);
      else if (statSync(imgPath).size > MAX_IMAGE_BYTES) {
        errors.push(`"${label}": الصورة ${item.image} أكبر من 150KB (${Math.round(statSync(imgPath).size / 1024)}KB)`);
      }
    }
  }

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
