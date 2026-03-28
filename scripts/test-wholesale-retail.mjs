/**
 * تيست: تاجر يشتري بنفس المنتج بسعر جملة، وعميل يشتريه بسعر تجزئة
 * تشغيل: npm test   أو   node scripts/test-wholesale-retail.mjs
 */
import assert from "node:assert/strict";
import { getUnitPriceForBuyer, getLineTotal } from "../src/utils/buyerPricing.js";
import prisma from "../src/prismaClient.js";

const paintBoth = {
  price: 150,
  wholesalePrice: 100,
};

const paintRetailOnly = {
  price: 80,
  wholesalePrice: null,
};

console.log("— اختبارات منطق السعر (بدون قاعدة بيانات) —\n");

// تاجر + جملة وتجزئة
assert.equal(getUnitPriceForBuyer("vendor", paintBoth), 100);
assert.equal(getLineTotal("vendor", paintBoth, 2), 200);

// مصمم مثل التاجر
assert.equal(getUnitPriceForBuyer("designer", paintBoth), 100);

// عميل = تجزئة دائماً
assert.equal(getUnitPriceForBuyer("user", paintBoth), 150);
assert.equal(getLineTotal("user", paintBoth, 2), 300);

// تاجر بدون سعر جملة → يدفع التجزئة
assert.equal(getUnitPriceForBuyer("vendor", paintRetailOnly), 80);
assert.equal(getUnitPriceForBuyer("user", paintRetailOnly), 80);

console.log("✓ كل اختبارات المنطق نجحت.\n");

// ——— سيناريو من قاعدة البيانات (إن وُجد منتج له جملة + تجزئة) ———
async function dbScenario() {
  console.log("— سيناريو من قاعدة البيانات (منتج حقيقي) —\n");
  let rows;
  try {
    rows = await prisma.$queryRawUnsafe(
      "SELECT `id`, `name`, `price`, `wholesalePrice` FROM `paint` WHERE `wholesalePrice` IS NOT NULL LIMIT 1"
    );
  } catch (e) {
    console.warn("تعذر قراءة الجدول:", e.message);
    await prisma.$disconnect();
    return;
  }

  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!row) {
    console.log(
      "⚠ لا يوجد منتج بسعر جملة في DB. أضف wholesalePrice لمنتج أو شغّل seed.\n"
    );
    await prisma.$disconnect();
    return;
  }

  const paint = {
    price: Number(row.price),
    wholesalePrice:
      row.wholesalePrice != null ? Number(row.wholesalePrice) : null,
  };

  const qty = 2;
  const vendorTotal = getLineTotal("vendor", paint, qty);
  const customerTotal = getLineTotal("user", paint, qty);

  assert.equal(getUnitPriceForBuyer("user", paint), paint.price);
  assert.equal(getUnitPriceForBuyer("vendor", paint), paint.wholesalePrice);

  console.log(`المنتج: ${row.name} (${row.id})`);
  console.log(`  سعر التجزئة: ${paint.price} | سعر الجملة: ${paint.wholesalePrice ?? "—"}`);
  console.log(`  الكمية: ${qty}`);
  console.log(`  إجمالي التاجر (وحدة جملة × كمية): ${vendorTotal}`);
  console.log(`  إجمالي العميل (وحدة تجزئة × كمية): ${customerTotal}`);
  assert.equal(customerTotal, paint.price * qty);
  assert.equal(vendorTotal, paint.wholesalePrice * qty);
  console.log("\n✓ السيناريو متسق مع المنطق المتفق عليه.\n");
  await prisma.$disconnect();
}

await dbScenario();
console.log("انتهى التشغيل بنجاح.");
