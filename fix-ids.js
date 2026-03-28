/**
 * سكريبت تحديث: يحول Number(id) إلى id (string) في جميع الـ controllers
 */
import fs from "fs";
import path from "path";

const files = [
  "src/controllers/dashboardApiController.js",
  "src/controllers/designController.js",
  "src/controllers/visitRequestController.js",
  "src/controllers/productController.js",
  "src/controllers/selectionController.js",
  "src/controllers/painterController.js",
  "src/controllers/authController.js",
];

const replacements = [
  // where: { id: Number(id) }  →  where: { id: id }
  [/where:\s*\{\s*id:\s*Number\(id\)\s*\}/g, "where: { id: id }"],
  // where: { id: Number(something) }  →  where: { id: something }
  [/\bwhere:\s*\{\s*id:\s*Number\((\w+)\)\s*\}/g, "where: { id: $1 }"],
  // safeId: parseInt → just trim+validate string
  [
    /const safeId = \(id\) => \{\s*const n = parseInt\(id, 10\);\s*return Number\.isFinite\(n\) \? n : null;\s*\};/g,
    `const safeId = (id) => {
  const s = id != null ? String(id).trim() : "";
  return s.length > 0 ? s : null;
};`,
  ],
  // where: { id: safeId(id) }  stays, safeId now returns string
  // order.id % 2  →  deterministic from id hash
  [/order\.id % 2 === 0 \? "pos" : "app"/g, '(parseInt(order.id.replace(/-/g,"").slice(-4),16)%2===0?"pos":"app")'],
  [/o\.id % 2 === 0 \? "pos" : "app"/g, '(parseInt(o.id.replace(/-/g,"").slice(-4),16)%2===0?"pos":"app")'],
  // Number(id) in raw SQL params  →  id (string is fine for VARCHAR)
  [/\bprisma\.\$queryRawUnsafe\(\s*(["'`][^"'`]*["'`]),\s*Number\(id\)\s*\)/g, "prisma.$queryRawUnsafe($1, id)"],
  [/\bprisma\.\$executeRawUnsafe\(\s*(["'`][^"'`]*["'`]),\s*Number\(id\)\s*\)/g, "prisma.$executeRawUnsafe($1, id)"],
];

for (const rel of files) {
  const filepath = path.join(process.cwd(), rel);
  if (!fs.existsSync(filepath)) {
    console.log(`SKIP (not found): ${rel}`);
    continue;
  }
  let src = fs.readFileSync(filepath, "utf8");
  const orig = src;
  for (const [pattern, replacement] of replacements) {
    src = src.replace(pattern, replacement);
  }
  if (src !== orig) {
    fs.writeFileSync(filepath, src, "utf8");
    console.log(`UPDATED: ${rel}`);
  } else {
    console.log(`no change: ${rel}`);
  }
}
console.log("done");
