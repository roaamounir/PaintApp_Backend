/**
 * Test offer checkout flow for:
 * 1) user1 buys offered + non-offered product
 * 2) user2 buys non-offered product only
 * 3) vendor buys offered + non-offered product
 *
 * Run:
 *   node scripts/test-offer-checkout-flow.mjs
 */
import assert from "node:assert/strict";
import prisma from "../src/prismaClient.js";

const API_BASE = process.env.API_URL || "http://localhost:5000";
const TODAY = new Date();

const USERS = {
  admin: { phone: "01000000000", password: "Admin@123", label: "admin" },
  user1: { phone: "01001110001", password: "User@123", label: "user1" },
  user2: { phone: "01001110002", password: "User@123", label: "user2" },
  vendor: { phone: "01001110003", password: "User@123", label: "vendor1" },
};

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function login(phone, password) {
  const out = await req("/login", {
    method: "POST",
    body: { phone, password },
  });
  if (!out?.token) throw new Error(`Login failed for ${phone}`);
  return out.token;
}

function normalizeScopeType(v) {
  const x = String(v || "").trim().toLowerCase();
  return x === "product" || x === "category" ? x : null;
}

function normalizeTarget(v) {
  const x = String(v || "both").trim().toLowerCase();
  return x === "retail" || x === "wholesale" || x === "both" ? x : "both";
}

function isActiveOffer(offer) {
  if (!offer?.isActive) return false;
  const start = new Date(offer.startDate);
  const end = new Date(offer.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return start <= TODAY && end >= TODAY;
}

function offerAppliesToPaint(offer, paint, priceType) {
  if (!isActiveOffer(offer)) return false;
  const scopeType = normalizeScopeType(offer.scopeType);
  const scopeId = offer.scopeId != null ? String(offer.scopeId) : "";
  if (!scopeType || !scopeId) return false;
  const paintId = String(paint.id);
  const categoryId = String(paint.categoryId || "");
  if (scopeType === "product" && scopeId !== paintId) return false;
  if (scopeType === "category" && scopeId !== categoryId) return false;
  const target = normalizeTarget(offer.targetPriceType);
  if (target === "both") return true;
  return target === priceType;
}

function pickPlainPaint(paints, offers, excludedPaintId) {
  return paints.find((p) => {
    if (String(p.id) === String(excludedPaintId)) return false;
    const retailHit = offers.some((o) => offerAppliesToPaint(o, p, "retail"));
    const wholesaleHit = offers.some((o) => offerAppliesToPaint(o, p, "wholesale"));
    return !retailHit && !wholesaleHit;
  });
}

async function clearCart(token) {
  const cart = await req("/cart", { token });
  const items = Array.isArray(cart?.items) ? cart.items : [];
  for (const it of items) {
    await req(`/cart/items/${it.id}`, { method: "DELETE", token });
  }
}

async function checkoutScenario({ token, label, items }) {
  await clearCart(token);
  for (const line of items) {
    await req("/cart/items", {
      method: "POST",
      token,
      body: { paintId: line.paintId, quantity: line.quantity },
    });
  }
  const out = await req("/checkout", {
    method: "POST",
    token,
    body: { paymentMethod: "visa" },
  });
  console.log(`\n[${label}] orderId=${out.orderId} invoice=${out.invoiceNumber}`);
  for (const it of out.items || []) {
    console.log(
      `  - ${it.paintName} qty=${it.quantity} base=${it.baseUnitPrice} final=${it.unitPrice} offer=${it.appliedOfferId || "none"}`
    );
  }
  return out;
}

async function main() {
  const adminToken = await login(USERS.admin.phone, USERS.admin.password);
  const user1Token = await login(USERS.user1.phone, USERS.user1.password);
  const user2Token = await login(USERS.user2.phone, USERS.user2.password);
  const vendorToken = await login(USERS.vendor.phone, USERS.vendor.password);

  // Deterministic setup: create two fresh temporary products
  // - offeredPaint: سيأخذ عرض product-scoped
  // - plainPaint: بدون أي عرض
  const vendor = await prisma.vendor.findFirst({ where: { isApproved: true } });
  if (!vendor) throw new Error("No approved vendor found for test data");
  const ts = Date.now();
  const category = await prisma.category.create({
    data: { name: `[TEST] Offer Category ${ts}`, description: "Temporary test category" },
  });
  const offeredPaint = await prisma.paint.create({
    data: {
      name: `[TEST] Offered Paint ${ts}`,
      price: 240,
      wholesalePrice: 180,
      description: "Temp offered paint",
      categoryId: category.id,
      vendorId: vendor.id,
      base: "water",
      coatHours: 3,
      coverage: 10,
      dryDays: 1,
      finish: "matte",
      unit: "liter",
      usage: "indoor",
      stock: 80,
      inStock: true,
      isActive: true,
      weightKg: 1,
      type: "paint",
      sku: `TEST-OFFERED-${ts}`,
    },
  });
  const plainPaint = await prisma.paint.create({
    data: {
      name: `[TEST] Plain Paint ${ts}`,
      price: 210,
      wholesalePrice: 160,
      description: "Temp plain paint",
      categoryId: category.id,
      vendorId: vendor.id,
      base: "water",
      coatHours: 3,
      coverage: 10,
      dryDays: 1,
      finish: "matte",
      unit: "liter",
      usage: "indoor",
      stock: 80,
      inStock: true,
      isActive: true,
      weightKg: 1,
      type: "paint",
      sku: `TEST-PLAIN-${ts}`,
    },
  });

  const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const title = `[TEST] Dual flow ${Date.now()}`;
  await req("/offers", {
    method: "POST",
    token: adminToken,
    body: {
      title,
      discount: 15,
      discountType: "percentage",
      isActive: true,
      startDate,
      endDate,
      scopeType: "product",
      scopeId: offeredPaint.id,
      targetPriceType: "both",
    },
  });

  console.log("Using products:");
  console.log(`- Offered: ${offeredPaint.name} (${offeredPaint.id})`);
  console.log(`- Plain:   ${plainPaint.name} (${plainPaint.id})`);

  const user1 = await checkoutScenario({
    token: user1Token,
    label: "user1 (offered + plain)",
    items: [
      { paintId: offeredPaint.id, quantity: 1 },
      { paintId: plainPaint.id, quantity: 1 },
    ],
  });

  const user2 = await checkoutScenario({
    token: user2Token,
    label: "user2 (plain only)",
    items: [{ paintId: plainPaint.id, quantity: 1 }],
  });

  const vendorOrder = await checkoutScenario({
    token: vendorToken,
    label: "vendor (offered + plain)",
    items: [
      { paintId: offeredPaint.id, quantity: 1 },
      { paintId: plainPaint.id, quantity: 1 },
    ],
  });

  // Assertions
  const u1Offered = user1.items.find((i) => String(i.paintId) === String(offeredPaint.id));
  const u1Plain = user1.items.find((i) => String(i.paintId) === String(plainPaint.id));
  const u2Plain = user2.items.find((i) => String(i.paintId) === String(plainPaint.id));
  const vOffered = vendorOrder.items.find((i) => String(i.paintId) === String(offeredPaint.id));
  const vPlain = vendorOrder.items.find((i) => String(i.paintId) === String(plainPaint.id));

  assert.ok(u1Offered, "user1 offered item missing");
  assert.ok(u1Plain, "user1 plain item missing");
  assert.ok(u2Plain, "user2 plain item missing");
  assert.ok(vOffered, "vendor offered item missing");
  assert.ok(vPlain, "vendor plain item missing");

  assert.ok(u1Offered.appliedOfferId, "user1 offered product should have offer");
  assert.ok(vOffered.appliedOfferId, "vendor offered product should have offer");
  assert.equal(u1Plain.appliedOfferId, null, "user1 plain product should not have offer");
  assert.equal(u2Plain.appliedOfferId, null, "user2 plain product should not have offer");
  assert.equal(vPlain.appliedOfferId, null, "vendor plain product should not have offer");
  assert.ok(Number(u1Offered.unitPrice) <= Number(u1Offered.baseUnitPrice), "user1 offered price not reduced");
  assert.ok(Number(vOffered.unitPrice) <= Number(vOffered.baseUnitPrice), "vendor offered price not reduced");

  console.log("\n✅ Test passed:");
  console.log("- user1 bought offered + plain");
  console.log("- user2 bought plain only");
  console.log("- vendor bought offered + plain");
}

main()
  .catch((err) => {
  console.error("\n❌ Test failed:", err.message);
  process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

