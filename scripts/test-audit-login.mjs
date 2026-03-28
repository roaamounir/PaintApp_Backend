/**
 * Test audit logs for login flow.
 *
 * Run:
 *   node scripts/test-audit-login.mjs
 * or:
 *   npm run test:audit-login
 */
import assert from "node:assert/strict";

const API_BASE = process.env.API_URL || "http://localhost:5000";
const ADMIN_PHONE = "01000000000";
const ADMIN_PASS = "Admin@123";
const USER_PHONE = "01001110001";
const USER_PASS = "User@123";

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
  return { ok: res.ok, status: res.status, data };
}

async function login(phone, password) {
  const out = await req("/login", {
    method: "POST",
    body: { phone, password },
  });
  if (!out.ok) throw new Error(`Login failed (${phone}): ${out.status} ${JSON.stringify(out.data)}`);
  if (!out.data?.token) throw new Error("No token returned from login");
  return out.data.token;
}

function hasAction(logs, action, matcher = () => true) {
  return logs.some((l) => l?.action === action && matcher(l));
}

async function main() {
  // 1) Success login (should create LOGIN_SUCCESS)
  const userLogin = await req("/login", {
    method: "POST",
    body: { phone: USER_PHONE, password: USER_PASS },
  });
  assert.equal(userLogin.ok, true, "Expected successful user login");

  // 2) Failed login (wrong password) (should create LOGIN_FAILED)
  const failed = await req("/login", {
    method: "POST",
    body: { phone: USER_PHONE, password: "WrongPassword#123" },
  });
  assert.equal(failed.ok, false, "Expected failed login response");
  assert.equal(failed.status, 401, "Expected 401 for wrong password");

  // 3) Read audit logs (admin token)
  const adminToken = await login(ADMIN_PHONE, ADMIN_PASS);
  const logsResp = await req("/audit-logs", { token: adminToken });
  assert.equal(logsResp.ok, true, "Expected audit logs endpoint to succeed");
  const logs = Array.isArray(logsResp.data) ? logsResp.data : [];
  assert.ok(logs.length > 0, "Audit logs should not be empty");

  const hasLoginSuccess = hasAction(
    logs,
    "LOGIN_SUCCESS",
    (l) => String(l?.details || "").includes(USER_PHONE)
  );
  const hasLoginFailed = hasAction(
    logs,
    "LOGIN_FAILED",
    (l) => String(l?.details || "").includes("invalid_password")
  );

  assert.ok(hasLoginSuccess, "Missing LOGIN_SUCCESS entry for test user login");
  assert.ok(hasLoginFailed, "Missing LOGIN_FAILED entry for wrong password");

  console.log("✅ Audit login test passed.");
  console.log("- Found LOGIN_SUCCESS for user login");
  console.log("- Found LOGIN_FAILED for wrong password");
}

main().catch((err) => {
  console.error("❌ Audit login test failed:", err.message);
  process.exit(1);
});

