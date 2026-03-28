/**
 * تيست تكاملي: عميل يقدّم طلب جملة → الأدمن يوافق → شراء بسعر الجملة من السلة.
 * ثم مصمم يسجّل دخول ويشتري نفس المنتج بسعر الجملة (بدون طلب جملة).
 *
 * تشغيل: node scripts/test-wholesale-approval-flow.mjs
 * يتطلب: السيرفر على PORT (افتراضي 5000) وقاعدة البيانات مع منتج واحد على الأقل.
 */
import assert from "node:assert/strict";
import prisma from "../src/prismaClient.js";

const BASE = process.env.API_URL || "http://localhost:5000";

async function api(method, path, { token, body } = {}) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body != null) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!r.ok) {
    throw new Error(`${method} ${path} -> ${r.status}: ${text}`);
  }
  return data;
}

function assertApprox(a, b, msg) {
  assert.ok(Math.abs(Number(a) - Number(b)) < 0.01, `${msg}: got ${a} expected ${b}`);
}

async function main() {
  const paint = await prisma.paint.findFirst({
    where: { stock: { gte: 5 } },
    orderBy: { createdAt: "asc" },
  });
  assert.ok(paint, "لا يوجد منتج في قاعدة البيانات");
  const retail = Number(paint.price);
  const wholesale = retail > 30 ? retail - 25 : retail * 0.7;
  await prisma.paint.update({
    where: { id: paint.id },
    data: { wholesalePrice: wholesale },
  });

  const suffix = Date.now();
  const phone = `010${String(suffix).slice(-8).padStart(8, "0")}`;
  const email = `wt-flow-${suffix}@example.com`;

  await api("POST", "/signup", {
    body: {
      name: `Wholesale Flow ${suffix}`,
      email,
      phone,
      password: "User@123",
      role: "user",
    },
  });

  const loginUser = await api("POST", "/login", {
    body: { phone, password: "User@123" },
  });
  assert.ok(loginUser.token, "login user");
  const userId = loginUser.user.id;

  await prisma.cart.deleteMany({ where: { userId } });

  const wholesalePayload = {
    userId,
    shopName: "محل تجربة الجملة",
    taxRegistration: `${suffix}`,
    companyType: "individual",
    fullName: loginUser.user.name,
    email,
    phone,
    companyAddress: "القاهرة - شارع التجربة",
    city: "القاهرة",
  };

  const wr = await api("POST", "/wholesale-requests", { body: wholesalePayload });
  const vendorId = wr.request?.id;
  assert.ok(vendorId, "استجابة طلب الجملة يجب أن تحتوي request.id");

  await api("POST", "/cart/items", {
    token: loginUser.token,
    body: { paintId: paint.id, quantity: 2 },
  });

  let cartBefore = await api("GET", "/cart", { token: loginUser.token });
  assert.equal(cartBefore.canBuyWholesale, false, "قبل الموافقة: لا يجوز شراء الجملة");
  assertApprox(
    cartBefore.items[0].unitPrice,
    retail,
    "قبل الموافقة: سعر الوحدة تجزئة"
  );

  const adminLogin = await api("POST", "/login", {
    body: { phone: "01000000000", password: "Admin@123" },
  });
  assert.ok(adminLogin.token, "login admin");

  await api("PUT", `/vendors/approve/${vendorId}`, {
    token: adminLogin.token,
    body: { isApproved: true },
  });

  const cartAfter = await api("GET", "/cart", { token: loginUser.token });
  assert.equal(cartAfter.canBuyWholesale, true, "بعد الموافقة: canBuyWholesale");
  assertApprox(
    cartAfter.items[0].unitPrice,
    wholesale,
    "بعد الموافقة: سعر الوحدة جملة"
  );
  assertApprox(
    cartAfter.subtotal,
    wholesale * 2,
    "إجمالي السطر جملة"
  );

  const orderRes = await api("POST", "/checkout", { token: loginUser.token });
  assert.ok(orderRes.orderId, "checkout يعيد orderId");
  assertApprox(orderRes.totalPrice, wholesale * 2, "إجمالي الطلب بسعر الجملة");

  const designerLogin = await api("POST", "/login", {
    body: { phone: "01000000031", password: "User@123" },
  });
  assert.equal(designerLogin.user.role, "designer");
  const designerId = designerLogin.user.id;
  await prisma.cart.deleteMany({ where: { userId: designerId } });

  await api("POST", "/cart/items", {
    token: designerLogin.token,
    body: { paintId: paint.id, quantity: 1 },
  });

  const cartDesigner = await api("GET", "/cart", { token: designerLogin.token });
  assert.equal(cartDesigner.canBuyWholesale, true, "المصمم: صلاحية جملة بالدور");
  assertApprox(
    cartDesigner.items[0].unitPrice,
    wholesale,
    "المصمم: سعر الوحدة جملة"
  );

  const designerOrder = await api("POST", "/checkout", {
    token: designerLogin.token,
  });
  assertApprox(
    designerOrder.totalPrice,
    wholesale,
    "طلب المصمم بسعر الجملة"
  );

  console.log("✓ فلو طلب الجملة + موافقة الأدمن + شراء عميل بالجملة: نجح");
  console.log("✓ فلو مصمم يشتري بالجملة بدون طلب منفصل: نجح");
  console.log(`  منتج: ${paint.name} (${paint.id}) — تجزئة ${retail} / جملة ${wholesale}`);
}

main()
  .catch((e) => {
    console.error("فشل التيست:", e.message || e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
