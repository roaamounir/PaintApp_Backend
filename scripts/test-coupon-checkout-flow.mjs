import assert from "node:assert/strict";

const API_BASE = process.env.API_URL || "http://localhost:5000";
const USERS = {
  admin: { phone: "01000000000", password: "Admin@123" },
  user1: { phone: "01001110001", password: "User@123" },
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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function login(phone, password) {
  const out = await req("/login", { method: "POST", body: { phone, password } });
  if (!out?.token) throw new Error(`Login failed for ${phone}`);
  return out.token;
}

async function clearCart(token) {
  const cart = await req("/cart", { token });
  const items = Array.isArray(cart?.items) ? cart.items : [];
  for (const it of items) {
    await req(`/cart/items/${it.id}`, { method: "DELETE", token });
  }
}

async function main() {
  const adminToken = await login(USERS.admin.phone, USERS.admin.password);
  const userToken = await login(USERS.user1.phone, USERS.user1.password);

  const paints = await req("/paints");
  const paint = Array.isArray(paints) ? paints.find((p) => Number(p.stock || 0) > 5 && Number(p.price || 0) > 0) : null;
  if (!paint) throw new Error("No suitable paint found for coupon flow test");

  const code = `CPN${Date.now()}`;
  const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

  await req("/coupons", {
    method: "POST",
    token: adminToken,
    body: {
      code,
      discount: 10,
      discountType: "percentage",
      isActive: true,
      startDate,
      endDate,
      scopeType: "product",
      scopeId: paint.id,
      targetPriceType: "both",
    },
  });

  await clearCart(userToken);
  await req("/cart/items", {
    method: "POST",
    token: userToken,
    body: { paintId: paint.id, quantity: 1 },
  });

  const checkout = await req("/checkout", {
    method: "POST",
    token: userToken,
    body: { paymentMethod: "visa", couponCode: code },
  });

  assert.ok(checkout.orderId, "orderId should exist");
  assert.equal(checkout.couponCode, code, "couponCode should match");
  assert.ok(Number(checkout.discountValue) > 0, "discountValue should be > 0");
  assert.ok(Number(checkout.totalPrice) < Number(checkout.subtotalPrice), "totalPrice should be less than subtotal");

  const order = await req(`/orders/${checkout.orderId}`, { token: userToken });
  assert.equal(order.couponCode, code, "order couponCode should match");
  assert.ok(Number(order.discountValue) > 0, "order discountValue should be > 0");

  console.log("✅ Coupon flow passed");
  console.log(`orderId=${checkout.orderId} subtotal=${checkout.subtotalPrice} discount=${checkout.discountValue} total=${checkout.totalPrice}`);
}

main().catch((err) => {
  console.error("❌ Coupon flow failed:", err.message);
  process.exit(1);
});
