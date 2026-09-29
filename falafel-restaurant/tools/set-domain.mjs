// تغيير نطاق الموقع في وسوم المعاينة وrobots وsitemap:
//   node tools/set-domain.mjs https://دومينك.com
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const files = ["index.html", "menu/index.html", "robots.txt", "sitemap.xml"];

let next;
try {
  const u = new URL(process.argv[2] ?? "");
  if (u.protocol !== "https:" || u.pathname !== "/" || u.search || u.hash) throw new Error();
  next = u.origin;
} catch {
  console.error("الاستخدام: node tools/set-domain.mjs https://example.com  (https بدون مسار)");
  process.exit(1);
}

const m = /<link rel="canonical" href="(https:\/\/[^"\/]+)\/"/.exec(readFileSync(root("index.html"), "utf8"));
if (!m) { console.error("لم أجد وسم canonical في index.html"); process.exit(1); }
const prev = m[1];
if (prev === next) { console.log("النطاق هو نفسه، لا تغيير."); process.exit(0); }

for (const f of files) {
  const text = readFileSync(root(f), "utf8");
  writeFileSync(root(f), text.split(prev).join(next));
  console.log(`✅ ${f}`);
}
console.log(`النطاق: ${prev} ← ${next}`);
