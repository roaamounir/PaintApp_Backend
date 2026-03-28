import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import prisma from "../prismaClient.js";
import bcrypt from "bcrypt";
import chroma from "chroma-js";
import { authenticate } from "../utils/auth.js";
import { getUnitPriceForBuyer, getCanBuyWholesaleForUser } from "../utils/buyerPricing.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "..", "..", "uploads");
import { colorSystems, systemPalettes } from "../data/colorPalettes.js";

const json = (res, code, data) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

/** من كائن chroma إلى صيغة الاستجابة: hex, rgb, cmyk, hsl, lab_* */
function chromaToFormats(c) {
  if (!c) return null;
  const [r, g, b] = c.rgb();
  const [cyan, magenta, yellow, black] = c.cmyk();
  const [h, s, l] = c.hsl();
  const [labL, labA, labB] = c.lab();
  return {
    hex: c.hex(),
    rgb: { r: Math.round(r), g: Math.round(g), b: Math.round(b) },
    cmyk: {
      c: Math.round(cyan * 100),
      m: Math.round(magenta * 100),
      y: Math.round(yellow * 100),
      k: Math.round(black * 100),
    },
    hsl: { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) },
    lab_l: labL,
    lab_a: labA,
    lab_b: labB,
  };
}

const readBody = (req) =>
  new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });

const CHECKOUT_PAYMENT_METHODS = ["visa", "mastercard", "apple_pay"];
let orderShippingColsChecked = false;
let userAccessColsChecked = false;
let orderCouponColsChecked = false;

const withoutPassword = (user) => {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
};

/** افتراضي true للصفوف القديمة أو عند غياب الحقل */
const userRowIsActive = (row) =>
  !(
    row?.isBlocked === true ||
    row?.isBlocked === 1 ||
    row?.isBlocked === "1" ||
    row?.isActive === false ||
    row?.isActive === 0 ||
    row?.isActive === "0"
  );
const userRowIsDeleted = (row) =>
  row?.isDeleted === true ||
  row?.isDeleted === 1 ||
  row?.isDeleted === "1" ||
  Boolean(row?.deletedAt || row?.deletedat);
const parsePermissions = (raw) => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
};

/** MySQL 1054 — جدول user قديم بدون عمود isActive */
const isMissingUserIsActiveColumnError = (err) => {
  const msg = String(err?.message || "");
  return (
    msg.includes("isActive") &&
    (msg.includes("1054") ||
      msg.includes("Unknown column") ||
      msg.includes("does not exist"))
  );
};

/** Prisma client قديم: Unknown arg `isActive` في user.update */
const isUnknownUserIsActivePrismaArgError = (err) => {
  const msg = String(err?.message || "");
  return msg.includes("Unknown arg `isActive`") || msg.includes("data.isActive");
};
const isUnknownUserPermissionsPrismaArgError = (err) => {
  const msg = String(err?.message || "");
  return msg.includes("Unknown arg `permissions`") || msg.includes("data.permissions");
};

const rawSelectAllUsers = async () => {
  await ensureUserAccessColumns();
  try {
    return await prisma.$queryRawUnsafe(
      "SELECT id, name, email, phone, role, avatarUrl, isActive, isBlocked, permissions, isDeleted, deletedAt, createdAt FROM `user` ORDER BY createdAt DESC",
    );
  } catch (err) {
    if (!isMissingUserIsActiveColumnError(err)) throw err;
    return prisma.$queryRawUnsafe(
      "SELECT id, name, email, phone, role, avatarUrl, isBlocked, permissions, isDeleted, deletedAt, createdAt FROM `user` ORDER BY createdAt DESC",
    );
  }
};

const rawSelectUserById = async (id) => {
  await ensureUserAccessColumns();
  try {
    return await prisma.$queryRawUnsafe(
      "SELECT id, name, email, phone, role, avatarUrl, isActive, isBlocked, permissions, isDeleted, deletedAt, createdAt FROM `user` WHERE id = ? LIMIT 1",
      id,
    );
  } catch (err) {
    if (!isMissingUserIsActiveColumnError(err)) throw err;
    return prisma.$queryRawUnsafe(
      "SELECT id, name, email, phone, role, avatarUrl, isBlocked, permissions, isDeleted, deletedAt, createdAt FROM `user` WHERE id = ? LIMIT 1",
      id,
    );
  }
};

const ensureUserAccessColumns = async () => {
  if (userAccessColsChecked) return;
  try {
    const cols = await prisma.$queryRawUnsafe(
      "SELECT `COLUMN_NAME` AS `name` FROM `information_schema`.`COLUMNS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'user'"
    );
    const names = new Set((Array.isArray(cols) ? cols : []).map((c) => String(c.name || c.COLUMN_NAME || "")));
    const alters = [];
    if (!names.has("permissions")) alters.push("ADD COLUMN `permissions` JSON NULL");
    if (!names.has("isBlocked")) alters.push("ADD COLUMN `isBlocked` TINYINT(1) NOT NULL DEFAULT 0");
    if (!names.has("isDeleted")) alters.push("ADD COLUMN `isDeleted` TINYINT(1) NOT NULL DEFAULT 0");
    if (!names.has("deletedAt")) alters.push("ADD COLUMN `deletedAt` DATETIME NULL");
    if (alters.length > 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`user\` ${alters.join(", ")}`);
    }
  } catch (_) {}
  userAccessColsChecked = true;
};

const ensureOrderShippingColumns = async () => {
  if (orderShippingColsChecked) return;
  try {
    const cols = await prisma.$queryRawUnsafe(
      "SELECT `COLUMN_NAME` AS `name` FROM `information_schema`.`COLUMNS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'order'"
    );
    const names = new Set((Array.isArray(cols) ? cols : []).map((c) => String(c.name || c.COLUMN_NAME || "")));
    const alters = [];
    if (!names.has("shippingCity")) alters.push("ADD COLUMN `shippingCity` VARCHAR(191) NULL");
    if (!names.has("addressLine1")) alters.push("ADD COLUMN `addressLine1` VARCHAR(512) NULL");
    if (!names.has("addressLine2")) alters.push("ADD COLUMN `addressLine2` VARCHAR(512) NULL");
    if (!names.has("postalCode")) alters.push("ADD COLUMN `postalCode` VARCHAR(64) NULL");
    if (!names.has("shippingPhone")) alters.push("ADD COLUMN `shippingPhone` VARCHAR(64) NULL");
    if (alters.length > 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`order\` ${alters.join(", ")}`);
    }
  } catch (_) {
    // Keep compatibility with restricted DB users/environments.
  } finally {
    orderShippingColsChecked = true;
  }
};

const ensureOrderCouponColumns = async () => {
  if (orderCouponColsChecked) return;
  try {
    const cols = await prisma.$queryRawUnsafe(
      "SELECT `COLUMN_NAME` AS `name` FROM `information_schema`.`COLUMNS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'order'"
    );
    const names = new Set((Array.isArray(cols) ? cols : []).map((c) => String(c.name || c.COLUMN_NAME || "")));
    const alters = [];
    if (!names.has("subtotalPrice")) alters.push("ADD COLUMN `subtotalPrice` DECIMAL(10,2) NULL");
    if (!names.has("discountValue")) alters.push("ADD COLUMN `discountValue` DECIMAL(10,2) NULL");
    if (!names.has("couponCode")) alters.push("ADD COLUMN `couponCode` VARCHAR(191) NULL");
    if (!names.has("couponType")) alters.push("ADD COLUMN `couponType` VARCHAR(16) NULL");
    if (!names.has("couponAmount")) alters.push("ADD COLUMN `couponAmount` DECIMAL(10,2) NULL");
    if (alters.length > 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`order\` ${alters.join(", ")}`);
    }
  } catch (_) {
    // Keep compatibility with restricted DB users/environments.
  } finally {
    orderCouponColsChecked = true;
  }
};

const loadActiveCoupons = async () => {
  await ensureOfferAdvancedColumns();
  const nowIso = new Date().toISOString().slice(0, 19).replace("T", " ");
  const rows = await prisma.$queryRawUnsafe(
    "SELECT `id`,`title`,`discount`,`discountType`,`isActive`,`startDate`,`endDate`,`campaignType` FROM `offer` WHERE `isActive`=1 AND `startDate` <= ? AND `endDate` >= ? AND `campaignType` = 'coupon'",
    nowIso,
    nowIso,
  );
  return Array.isArray(rows) ? rows : [];
};

const findCouponByCode = (coupons, couponCode) => {
  const code = String(couponCode || "").trim().toLowerCase();
  if (!code) return null;
  return (coupons || []).find((c) => String(c.title || "").trim().toLowerCase() === code) || null;
};

const applyCouponDiscount = (subtotal, coupon) => {
  const base = Number(subtotal || 0);
  if (!Number.isFinite(base) || base <= 0 || !coupon) {
    return { totalPrice: Math.max(0, Math.round(base * 100) / 100), discountValue: 0 };
  }
  const discount = Number(coupon.discount || 0);
  const type = coupon.discountType === "fixed" ? "fixed" : "percentage";
  const rawDiscount = type === "fixed" ? discount : base * (discount / 100);
  const discountValue = Math.max(0, Math.min(base, Math.round(rawDiscount * 100) / 100));
  const totalPrice = Math.max(0, Math.round((base - discountValue) * 100) / 100);
  return { totalPrice, discountValue };
};

const extractCouponCodeFromReq = (req, bodyData) => {
  if (bodyData && bodyData.couponCode != null && String(bodyData.couponCode).trim() !== "") {
    return String(bodyData.couponCode).trim();
  }
  try {
    const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const q = url.searchParams.get("couponCode");
    return q != null && String(q).trim() !== "" ? String(q).trim() : null;
  } catch {
    return null;
  }
};

const buildCartSummary = async (user, couponCodeInput = null) => {
  const canBuyWholesale = await getCanBuyWholesaleForUser(user.id, user.role);
  const items = await prisma.cart.findMany({ where: { userId: user.id } });
  const paintIds = [...new Set(items.map((i) => i.paintId))];
  const paints =
    paintIds.length === 0
      ? []
      : await prisma.paint.findMany({ where: { id: { in: paintIds } } });
  const activeOffers = await loadActiveScopedOffers();
  const activeCoupons = await loadActiveCoupons();
  const priceType = canBuyWholesale ? "wholesale" : "retail";
  const paintMap = Object.fromEntries(paints.map((p) => [p.id, p]));
  const rows = items
    .map((item) => {
      const paint = paintMap[item.paintId];
      if (!paint) return null;
      const baseUnitPrice = getUnitPriceForBuyer(user.role, paint, canBuyWholesale);
      const offer = resolveOfferForPaint(activeOffers, paint, priceType);
      const unitPrice = applyOfferOnPrice(baseUnitPrice, offer);
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      return {
        id: item.id,
        paintId: item.paintId,
        quantity,
        unitPrice,
        baseUnitPrice,
        appliedOfferId: offer?.id || null,
        lineTotal: unitPrice * quantity,
        paint: {
          id: paint.id,
          name: paint.name,
          image: paint.image ?? null,
          price: paint.price,
          wholesalePrice: paint.wholesalePrice ?? null,
          stock: paint.stock,
        },
      };
    })
    .filter(Boolean);
  const subtotal = Math.round(rows.reduce((sum, r) => sum + Number(r.lineTotal || 0), 0) * 100) / 100;
  const couponCode =
    couponCodeInput != null && String(couponCodeInput).trim() !== ""
      ? String(couponCodeInput).trim()
      : null;
  const coupon = couponCode ? findCouponByCode(activeCoupons, couponCode) : null;
  const couponCalc = applyCouponDiscount(subtotal, coupon);
  return {
    userId: user.id,
    canBuyWholesale,
    items: rows,
    subtotal,
    discountValue: couponCalc.discountValue,
    total: couponCalc.totalPrice,
    couponCode: coupon ? String(coupon.title) : null,
    couponValid: couponCode ? Boolean(coupon) : null,
  };
};

const getOrderShippingMap = async (orderIds) => {
  if (!Array.isArray(orderIds) || orderIds.length === 0) return {};
  try {
    const placeholders = orderIds.map(() => "?").join(", ");
    const rows = await prisma.$queryRawUnsafe(
      `SELECT \`id\`, \`shippingCity\`, \`addressLine1\`, \`addressLine2\`, \`postalCode\`, \`shippingPhone\` FROM \`order\` WHERE \`id\` IN (${placeholders})`,
      ...orderIds
    );
    const map = {};
    for (const r of Array.isArray(rows) ? rows : []) {
      map[r.id] = {
        city: r.shippingCity ?? null,
        addressLine1: r.addressLine1 ?? null,
        addressLine2: r.addressLine2 ?? null,
        postalCode: r.postalCode ?? null,
        phone: r.shippingPhone ?? null,
      };
    }
    return map;
  } catch (_) {
    return {};
  }
};

const REQUEST_TYPE_PREFIX = "__REQ_TYPE__:";
const REQUEST_TYPE_WHOLESALE = "WHOLESALE";
const REQUEST_TYPE_VENDOR = "VENDOR";

const encodeRequestType = (requestType, rawTaxRegistration) => {
  const cleanType =
    requestType === REQUEST_TYPE_VENDOR
      ? REQUEST_TYPE_VENDOR
      : REQUEST_TYPE_WHOLESALE;
  const tail =
    rawTaxRegistration != null && String(rawTaxRegistration).trim()
      ? `|${String(rawTaxRegistration).trim()}`
      : "";
  return `${REQUEST_TYPE_PREFIX}${cleanType}${tail}`;
};

const parseRequestType = (taxRegistration) => {
  const value = taxRegistration != null ? String(taxRegistration) : "";
  if (!value.startsWith(REQUEST_TYPE_PREFIX)) return null;
  const encoded = value.slice(REQUEST_TYPE_PREFIX.length).split("|")[0];
  return encoded === REQUEST_TYPE_VENDOR
    ? REQUEST_TYPE_VENDOR
    : REQUEST_TYPE_WHOLESALE;
};

const normalizeRequiredText = (value) => String(value ?? "").trim();

const validateRequestApplicantFields = (data) => {
  const fullName = normalizeRequiredText(data.fullName);
  const email = normalizeRequiredText(data.email);
  const phone = normalizeRequiredText(data.phone);
  const shopName = normalizeRequiredText(data.shopName);
  const taxRegistration = normalizeRequiredText(data.taxRegistration);
  const companyType = normalizeRequiredText(data.companyType);
  const companyAddress = normalizeRequiredText(data.companyAddress);

  if (!fullName) return { ok: false, error: "fullName is required" };
  if (!email) return { ok: false, error: "email is required" };
  if (!phone) return { ok: false, error: "phone is required" };
  if (!shopName) return { ok: false, error: "shopName is required" };
  if (!taxRegistration) return { ok: false, error: "taxRegistration is required" };
  if (!companyType) return { ok: false, error: "companyType is required" };
  if (!companyAddress) return { ok: false, error: "companyAddress is required" };

  return {
    ok: true,
    values: {
      fullName,
      email,
      phone,
      shopName,
      taxRegistration,
      companyType,
      companyAddress,
    },
  };
};

// ========== Users (قائمة المستخدمين للداشبورد) ==========
/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: قائمة المستخدمين (لوحة التحكم)
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة مستخدمين مع avatarUrl
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: مستخدم بالمعرف
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   put:
 *     tags: [Users]
 *     summary: تحديث مستخدم (المستخدم نفسه أو المشرف؛ role للمشرف فقط)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdateBody'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: الحساب الحالي (JWT) مع designerProfile / painterProfile عند التطبيق
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MeProfileResponse'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /users/me/avatar:
 *   post:
 *     tags: [Users]
 *     summary: رفع صورة بروفايل (multipart، الحقل avatar)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AvatarUploadResponse'
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: قائمة المستخدمين (بادئة /api)
 *     description: نفس GET `/users`.
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة مستخدمين
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: مستخدم بالمعرف (بادئة /api)
 *     description: نفس GET `/users/{id}`.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: بيانات المستخدم
 *   put:
 *     tags: [Users]
 *     summary: تحديث مستخدم (بادئة /api)
 *     description: نفس PUT `/users/{id}`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: المستخدم بعد التحديث
 *   delete:
 *     tags: [Users]
 *     summary: حذف مستخدم (بادئة /api)
 *     description: نفس DELETE `/users/{id}`.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تم الحذف
 * /api/users/me:
 *   get:
 *     tags: [Users]
 *     summary: الحساب الحالي (بادئة /api)
 *     description: نفس GET `/users/me`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: بيانات الحساب الحالي
 * /api/users/me/avatar:
 *   post:
 *     tags: [Users]
 *     summary: رفع صورة بروفايل (بادئة /api)
 *     description: نفس POST `/users/me/avatar`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: تم رفع الصورة
 */
/** استعلام خام لتجنب خطأ Prisma عند وجود role غير معرّف في العميل (مثل designer) */
export const getUsers = async (req, res) => {
  try {
    const raw = await rawSelectAllUsers();
    const includeDeleted = String(req?.query?.includeDeleted || "").toLowerCase() === "true";
    const users = (raw || [])
      .filter((row) => includeDeleted || !userRowIsDeleted(row))
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        avatarUrl: row.avatarUrl ?? null,
        isActive: userRowIsActive(row),
        status: userRowIsActive(row),
        permissions: parsePermissions(row.permissions),
        isDeleted: userRowIsDeleted(row),
        deletedAt: row.deletedAt ?? row.deletedat ?? null,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      }));
    json(res, 200, users);
  } catch (err) {
    console.error("[getUsers]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

export const getUserById = async (req, res, id) => {
  try {
    const raw = await rawSelectUserById(id);
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row) return json(res, 404, { error: "User not found" });
    if (userRowIsDeleted(row)) return json(res, 404, { error: "User not found" });
    const user = {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      avatarUrl: row.avatarUrl ?? null,
      isActive: userRowIsActive(row),
      status: userRowIsActive(row),
      permissions: parsePermissions(row.permissions),
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    };
    json(res, 200, user);
  } catch (err) {
    console.error("[getUserById]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

export const updateUserById = async (req, res, id) => {
  try {
    const jwtUser = authenticate(req);
    if (jwtUser.role !== "admin" && String(jwtUser.id) !== String(id)) {
      return json(res, 403, { error: "Forbidden" });
    }
    const body = await readBody(req);
    const data = JSON.parse(body);
    await ensureUserAccessColumns();
    delete data.balance;
    delete data.creditLimit;
    if (data.password !== undefined && data.password === "") delete data.password;
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    const adminCanSetRole = jwtUser.role === "admin" && data.role !== undefined;
    const adminCanSetPermissions =
      jwtUser.role === "admin" &&
      data.permissions !== undefined &&
      typeof data.permissions === "object" &&
      data.permissions !== null;
    const adminCanSetActive =
      jwtUser.role === "admin" &&
      (data.status !== undefined || data.isActive !== undefined);
    const nextIsActive = adminCanSetActive
      ? Boolean(data.status !== undefined ? data.status : data.isActive)
      : undefined;
    const userData = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(adminCanSetRole ? { role: data.role } : {}),
      ...(adminCanSetActive ? { isActive: nextIsActive } : {}),
      ...(adminCanSetPermissions ? { permissions: JSON.stringify(data.permissions) } : {}),
      ...(data.password !== undefined && { password: data.password }),
      ...(data.avatarUrl !== undefined && {
        avatarUrl: data.avatarUrl === "" ? null : data.avatarUrl,
      }),
    };
    let user;
    try {
      user = await prisma.user.update({
        where: { id: id },
        data: userData,
      });
    } catch (err) {
      // توافق عكسي: Prisma قد يفشل إذا model يحتوي isActive بينما DB لا تحتوي العمود.
      if (isMissingUserIsActiveColumnError(err) || isUnknownUserPermissionsPrismaArgError(err)) {
        const sets = [];
        const vals = [];
        const push = (col, val) => {
          sets.push(`\`${col}\` = ?`);
          vals.push(val);
        };
        if (userData.name !== undefined) push("name", userData.name);
        if (userData.email !== undefined) push("email", userData.email);
        if (userData.phone !== undefined) push("phone", userData.phone);
        if (userData.role !== undefined) push("role", userData.role);
        if (userData.password !== undefined) push("password", userData.password);
        if (userData.avatarUrl !== undefined) push("avatarUrl", userData.avatarUrl);
        if (adminCanSetPermissions) push("permissions", JSON.stringify(data.permissions || {}));
        if (adminCanSetActive) {
          try {
            await prisma.$executeRawUnsafe(
              "UPDATE `user` SET `isActive` = ? WHERE `id` = ?",
              nextIsActive ? 1 : 0,
              id,
            );
          } catch (_) {}
          try {
            await prisma.$executeRawUnsafe(
              "UPDATE `user` SET `isBlocked` = ? WHERE `id` = ?",
              nextIsActive ? 0 : 1,
              id,
            );
          } catch (_) {}
        }
        if (sets.length > 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE \`user\` SET ${sets.join(", ")} WHERE \`id\` = ?`,
            ...vals,
            id,
          );
        }
        const raw = await rawSelectUserById(id);
        const row = Array.isArray(raw) ? raw[0] : raw;
        user = row || null;
      } else {
        // توافق عكسي آخر: Prisma client قديم لا يعرف arg isActive.
        if (
          !(
            (adminCanSetActive && isUnknownUserIsActivePrismaArgError(err)) ||
            (adminCanSetPermissions && isUnknownUserPermissionsPrismaArgError(err))
          )
        ) throw err;
        const { isActive, permissions, ...safeData } = userData;
        user = await prisma.user.update({
          where: { id: id },
          data: safeData,
        });
        try {
          await prisma.$executeRawUnsafe(
            "UPDATE `user` SET `isActive` = ? WHERE `id` = ?",
            nextIsActive ? 1 : 0,
            id,
          );
        } catch (sqlErr) {
          if (!isMissingUserIsActiveColumnError(sqlErr)) throw sqlErr;
        }
        try {
          await prisma.$executeRawUnsafe(
            "UPDATE `user` SET `isBlocked` = ? WHERE `id` = ?",
            nextIsActive ? 0 : 1,
            id,
          );
        } catch (_) {}
        user = await prisma.user.findUnique({ where: { id } });
      }
    }
    const pub = withoutPassword(user);
    json(res, 200, {
      ...pub,
      status: userRowIsActive(pub),
      permissions: parsePermissions(pub.permissions),
    });
  } catch (err) {
    if (err.message === "No token provided" || err.message?.includes("Invalid token")) {
      return json(res, 401, { error: err.message || "Unauthorized" });
    }
    json(res, 500, { error: err.message });
  }
};

/** المستخدم الحالي (JWT) — بدون كلمة المرور + بروفايل مصمم/فني عند الحاجة */
export const getMeProfile = async (req, res) => {
  try {
    await ensureUserAccessColumns();
    const { id } = authenticate(req);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return json(res, 404, { error: "User not found" });
    const vendor = await prisma.vendor.findFirst({
      where: { userId: id },
      select: { isApproved: true },
    });
    const canBuyWholesale =
      user.role === "vendor" ||
      user.role === "designer" ||
      Boolean(vendor?.isApproved);

    let designerProfile = null;
    let painterProfile = null;
    if (user.role === "designer") {
      designerProfile = await prisma.designerprofile.findUnique({
        where: { userId: id },
      });
    }
    if (user.role === "painter") {
      const painter = await prisma.painter.findUnique({ where: { userId: id } });
      if (painter) {
        const gallery = await prisma.paintergallery.findMany({
          where: { painterId: painter.id },
          orderBy: { id: "desc" },
        });
        painterProfile = { ...painter, gallery };
      }
    }

    const pub = withoutPassword(user);
    let permissions = {};
    try {
      const rows = await prisma.$queryRawUnsafe(
        "SELECT `permissions` FROM `user` WHERE `id` = ? LIMIT 1",
        id,
      );
      permissions = parsePermissions(Array.isArray(rows) && rows[0] ? rows[0].permissions : null);
    } catch (_) {}
    json(res, 200, {
      ...pub,
      status: userRowIsActive(pub),
      permissions,
      canBuyWholesale,
      designerProfile,
      painterProfile,
    });
  } catch (err) {
    json(res, 401, { error: err.message || "Unauthorized" });
  }
};

const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/** رفع صورة بروفايل — المستخدم يحدّث صورته فقط (حقل multipart: avatar) */
export const uploadUserAvatar = async (req, res) => {
  try {
    const { id } = authenticate(req);
    if (!req.file) return json(res, 400, { error: "No file uploaded" });
    if (!ALLOWED_AVATAR_TYPES.has(req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return json(res, 400, { error: "Only JPEG, PNG, GIF or WebP images are allowed" });
    }
    let existing = null;
    try {
      existing = await prisma.user.findUnique({ where: { id } });
    } catch (e) {
      if (!isMissingUserIsActiveColumnError(e)) throw e;
      const raw = await rawSelectUserById(id);
      existing = Array.isArray(raw) ? raw[0] : raw;
    }
    if (!existing) {
      fs.unlink(req.file.path, () => {});
      return json(res, 404, { error: "User not found" });
    }
    const oldUrl = existing.avatarUrl;
    if (oldUrl && oldUrl.startsWith("/uploads/")) {
      const rel = oldUrl.replace(/^\/uploads\//, "");
      if (rel && !rel.includes("..") && !path.isAbsolute(rel)) {
        const oldPath = path.join(uploadsDir, rel);
        if (oldPath.startsWith(uploadsDir)) fs.unlink(oldPath, () => {});
      }
    }
    const relativeUrl = `/uploads/${req.file.filename}`;
    let updated;
    try {
      updated = await prisma.user.update({
        where: { id },
        data: { avatarUrl: relativeUrl },
      });
    } catch (e) {
      if (!isMissingUserIsActiveColumnError(e)) throw e;
      await prisma.$executeRawUnsafe(
        "UPDATE `user` SET `avatarUrl` = ? WHERE `id` = ?",
        relativeUrl,
        id,
      );
      const raw = await rawSelectUserById(id);
      updated = Array.isArray(raw) ? raw[0] : raw;
    }
    json(res, 200, { avatarUrl: relativeUrl, user: withoutPassword(updated) });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    const msg = err.message || "Upload failed";
    const code =
      msg.includes("token") || msg === "No token provided" ? 401 : 400;
    json(res, code, { error: msg });
  }
};

/** رفع صورة بروفايل لمستخدم محدد — الأدمن أو نفس المستخدم */
export const uploadUserAvatarById = async (req, res, targetUserId) => {
  try {
    const jwtUser = authenticate(req);
    if (jwtUser.role !== "admin" && String(jwtUser.id) !== String(targetUserId)) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      return json(res, 403, { error: "Forbidden" });
    }
    if (!req.file) return json(res, 400, { error: "No file uploaded" });
    if (!ALLOWED_AVATAR_TYPES.has(req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return json(res, 400, { error: "Only JPEG, PNG, GIF or WebP images are allowed" });
    }
    let existing = null;
    try {
      existing = await prisma.user.findUnique({ where: { id: targetUserId } });
    } catch (e) {
      if (!isMissingUserIsActiveColumnError(e)) throw e;
      const raw = await rawSelectUserById(targetUserId);
      existing = Array.isArray(raw) ? raw[0] : raw;
    }
    if (!existing) {
      fs.unlink(req.file.path, () => {});
      return json(res, 404, { error: "User not found" });
    }
    const oldUrl = existing.avatarUrl;
    if (oldUrl && oldUrl.startsWith("/uploads/")) {
      const rel = oldUrl.replace(/^\/uploads\//, "");
      if (rel && !rel.includes("..") && !path.isAbsolute(rel)) {
        const oldPath = path.join(uploadsDir, rel);
        if (oldPath.startsWith(uploadsDir)) fs.unlink(oldPath, () => {});
      }
    }
    const relativeUrl = `/uploads/${req.file.filename}`;
    let updated;
    try {
      updated = await prisma.user.update({
        where: { id: targetUserId },
        data: { avatarUrl: relativeUrl },
      });
    } catch (e) {
      if (!isMissingUserIsActiveColumnError(e)) throw e;
      await prisma.$executeRawUnsafe(
        "UPDATE `user` SET `avatarUrl` = ? WHERE `id` = ?",
        relativeUrl,
        targetUserId,
      );
      const raw = await rawSelectUserById(targetUserId);
      updated = Array.isArray(raw) ? raw[0] : raw;
    }
    json(res, 200, { avatarUrl: relativeUrl, user: withoutPassword(updated) });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    const msg = err.message || "Upload failed";
    const code =
      msg.includes("token") || msg === "No token provided" ? 401 : 400;
    json(res, code, { error: msg });
  }
};

/** رفع صورة منتج (multipart: image)؛ يعيد مساراً نسبياً لاستخدامه في paint.image — يستدعي بعد authorize(admin) في المسار */
export const uploadPaintImage = async (req, res) => {
  try {
    if (!req.file) return json(res, 400, { error: "No file uploaded" });
    if (!ALLOWED_AVATAR_TYPES.has(req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return json(res, 400, { error: "Only JPEG, PNG, GIF or WebP images are allowed" });
    }
    const relativeUrl = `/uploads/${req.file.filename}`;
    json(res, 200, { imageUrl: relativeUrl });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    json(res, 500, { error: err.message || "Upload failed" });
  }
};

export const deleteUserById = async (req, res, id) => {
  try {
    await ensureUserAccessColumns();
    const mode = String(req?.query?.mode || "").toLowerCase() === "hard" ? "hard" : "soft";
    if (mode === "hard") {
      await prisma.user.delete({ where: { id: id } });
      return json(res, 200, { message: "User hard deleted", mode: "hard" });
    }
    // Soft delete = block/deactivate only (NOT removed).
    try {
      await prisma.$executeRawUnsafe(
        "UPDATE `user` SET `isBlocked` = 1, `isActive` = 0, `isDeleted` = 0, `deletedAt` = NULL WHERE `id` = ?",
        id,
      );
    } catch (_) {
      await prisma.$executeRawUnsafe(
        "UPDATE `user` SET `isBlocked` = 1, `isDeleted` = 0, `deletedAt` = NULL WHERE `id` = ?",
        id,
      );
    }
    json(res, 200, { message: "User deactivated", mode: "soft" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Vendors (لا توجد relation في الـ schema، نربط user يدوياً) ==========
export const getVendors = async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany();
    const userIds = vendors.map((v) => v.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const withUser = vendors.map((v) => ({ ...v, user: userMap[v.userId] || null }));
    json(res, 200, withUser);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const getVendorById = async (req, res, id) => {
  try {
    const vendor = await prisma.vendor.findFirst({
      where: { OR: [{ id: id }, { userId: id }] },
    });
    if (!vendor) return json(res, 404, { error: "Vendor not found" });
    const user = await prisma.user.findUnique({ where: { id: vendor.userId } });
    json(res, 200, { ...vendor, user: user || null });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const createVendor = async (req, res) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const vendor = await prisma.vendor.create({
      data: {
        userId: data.userId,
        shopName: data.shopName || "",
        city: data.city || "",
        address: data.address || null,
        region: data.region || null,
        taxRegistration: data.taxRegistration || null,
        isApproved: data.isApproved ?? false,
        paymentStatus: data.paymentStatus ?? false,
      },
    });
    const user = await prisma.user.findUnique({ where: { id: vendor.userId } });
    json(res, 201, { ...vendor, user: user || null });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const updateVendor = async (req, res, id) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const byId = await prisma.vendor.findUnique({ where: { id } });
    const byUserId = byId ? null : await prisma.vendor.findFirst({ where: { userId: id } });
    const target = byId || byUserId;
    if (!target) return json(res, 404, { error: "Vendor not found" });
    const updateData = {};
    if (data.shopName != null) updateData.shopName = data.shopName;
    if (data.city != null) updateData.city = data.city;
    if (data.address != null) updateData.address = data.address;
    if (data.region != null) updateData.region = data.region;
    if (data.taxRegistration != null) updateData.taxRegistration = data.taxRegistration;
    if (data.isApproved != null) updateData.isApproved = data.isApproved;
    if (data.paymentStatus != null) updateData.paymentStatus = data.paymentStatus;
    const vendor = await prisma.vendor.update({
      where: { id: target.id },
      data: updateData,
    });
    const user = await prisma.user.findUnique({ where: { id: vendor.userId } });
    json(res, 200, { ...vendor, user: user || null });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Designers (مستخدمون بدور designer + designerprofile) ==========
/**
 * @swagger
 * /designers:
 *   get:
 *     tags: [Designers]
 *     summary: قائمة المصممين مع الملف المهني (bio، location، ...)
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة عناصر تحتوي user وحقول الملف
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DesignerProfileResponse'
 * /api/designers:
 *   get:
 *     tags: [Designers]
 *     summary: قائمة المصممين (بادئة /api)
 *     description: نفس GET `/designers`.
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة المصممين
 * /designers/me:
 *   get:
 *     tags: [Designers]
 *     summary: بروفايل المصمم الحالي (JWT، دور designer)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DesignerProfileResponse'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   put:
 *     tags: [Designers]
 *     summary: تحديث بروفايل المصمم الحالي (نفس حقول PUT /designers/{userId})
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DesignerUpdateBody'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DesignerProfileResponse'
 *       401:
 *       403:
 *       404:
 * /api/designers/me:
 *   get:
 *     tags: [Designers]
 *     summary: بروفايل المصمم الحالي (بادئة /api)
 *     description: نفس GET `/designers/me`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: بيانات المصمم الحالي
 *   put:
 *     tags: [Designers]
 *     summary: تحديث بروفايل المصمم الحالي (بادئة /api)
 *     description: نفس PUT `/designers/me`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DesignerUpdateBody'
 *     responses:
 *       200:
 *         description: تم التحديث
 * /designers/{userId}:
 *   get:
 *     tags: [Designers]
 *     summary: تفاصيل مصمم بالمعرف
 *     security: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DesignerProfileResponse'
 *       404:
 *   put:
 *     tags: [Designers]
 *     summary: تحديث مصمم (المصمم نفسه أو المشرف)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DesignerUpdateBody'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DesignerProfileResponse'
 *       401:
 *       403:
 *       404:
 *       500:
 * /api/designers/{userId}:
 *   get:
 *     tags: [Designers]
 *     summary: تفاصيل مصمم (بادئة /api)
 *     description: نفس GET `/designers/{userId}`.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تفاصيل المصمم
 *   put:
 *     tags: [Designers]
 *     summary: تحديث مصمم (بادئة /api)
 *     description: نفس PUT `/designers/{userId}`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DesignerUpdateBody'
 *     responses:
 *       200:
 *         description: تم التحديث
 *   delete:
 *     tags: [Designers]
 *     summary: حذف مصمم (بادئة /api)
 *     description: نفس DELETE `/designers/{userId}`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تم الحذف
 */
export const getDesigners = async (req, res) => {
  try {
    let users = [];
    try {
      users = await prisma.user.findMany({
        where: { role: "designer" },
        orderBy: { createdAt: "desc" },
      });
    } catch (err) {
      // fallback عندما يكون جدول user بدون isActive
      const raw = await prisma.$queryRawUnsafe(
        "SELECT `id`,`name`,`email`,`phone`,`role`,`avatarUrl`,`createdAt` FROM `user` WHERE `role` = 'designer' ORDER BY `createdAt` DESC",
      );
      users = Array.isArray(raw) ? raw : [];
    }
    const userIds = users.map((u) => u.id);
    const profiles =
      userIds.length === 0
        ? []
        : await prisma.designerprofile.findMany({
            where: { userId: { in: userIds } },
          });
    const profileByUser = Object.fromEntries(profiles.map((p) => [p.userId, p]));
    const list = users.map((u) => {
      const p = profileByUser[u.id];
      return {
        userId: u.id,
        user: withoutPassword(u),
        profileId: p?.id ?? null,
        experience: p?.experience ?? null,
        specialties: p?.specialties ?? null,
        rating: p?.rating ?? null,
        portfolio: p?.portfolio ?? null,
        bio: p?.bio ?? null,
        location: p?.location ?? null,
      };
    });
    json(res, 200, list);
  } catch (err) {
    console.error("[getDesigners]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

export const getDesignerById = async (req, res, userId) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "designer") {
      return json(res, 404, { error: "Designer not found" });
    }
    const profile = await prisma.designerprofile.findUnique({
      where: { userId },
    });
    json(res, 200, {
      userId: user.id,
      user: withoutPassword(user),
      profileId: profile?.id ?? null,
      experience: profile?.experience ?? null,
      specialties: profile?.specialties ?? null,
      rating: profile?.rating ?? null,
      portfolio: profile?.portfolio ?? null,
      bio: profile?.bio ?? null,
      location: profile?.location ?? null,
    });
  } catch (err) {
    console.error("[getDesignerById]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

export const updateDesigner = async (req, res, userId) => {
  try {
    const jwtUser = authenticate(req);
    if (jwtUser.role !== "admin" && jwtUser.id !== userId) {
      return json(res, 403, { error: "Forbidden" });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "designer") {
      return json(res, 404, { error: "Designer not found" });
    }
    const body = await readBody(req);
    const data = JSON.parse(body);
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
      },
    });
    const profileUpdates = {};
    if (data.experience !== undefined) {
      profileUpdates.experience =
        data.experience === "" || data.experience == null
          ? null
          : Number(data.experience);
    }
    if (data.specialties !== undefined) {
      profileUpdates.specialties = data.specialties || null;
    }
    if (data.portfolio !== undefined) {
      profileUpdates.portfolio = data.portfolio || null;
    }
    if (data.bio !== undefined) {
      profileUpdates.bio = data.bio === "" || data.bio == null ? null : String(data.bio);
    }
    if (data.location !== undefined) {
      profileUpdates.location = data.location === "" || data.location == null ? null : String(data.location);
    }
    if (Object.keys(profileUpdates).length > 0) {
      await prisma.designerprofile.upsert({
        where: { userId },
        create: {
          userId,
          experience: profileUpdates.experience ?? null,
          specialties: profileUpdates.specialties ?? null,
          portfolio: profileUpdates.portfolio ?? null,
          bio: profileUpdates.bio ?? null,
          location: profileUpdates.location ?? null,
        },
        update: profileUpdates,
      });
    }
    const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
    const profile = await prisma.designerprofile.findUnique({
      where: { userId },
    });
    json(res, 200, {
      userId: updatedUser.id,
      user: withoutPassword(updatedUser),
      profileId: profile?.id ?? null,
      experience: profile?.experience ?? null,
      specialties: profile?.specialties ?? null,
      rating: profile?.rating ?? null,
      portfolio: profile?.portfolio ?? null,
      bio: profile?.bio ?? null,
      location: profile?.location ?? null,
    });
  } catch (err) {
    if (err.message === "No token provided" || err.message?.includes("Invalid")) {
      return json(res, 401, { error: err.message || "Unauthorized" });
    }
    console.error("[updateDesigner]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

/** المصمم يعرض/يحدّث بروفايله (JWT) */
export const getDesignerMe = async (req, res) => {
  try {
    const { id, role } = authenticate(req);
    if (role !== "designer") return json(res, 403, { error: "Designers only" });
    return getDesignerById(req, res, id);
  } catch (err) {
    json(res, 401, { error: err.message || "Unauthorized" });
  }
};

export const updateDesignerMe = async (req, res) => {
  try {
    const { id, role } = authenticate(req);
    if (role !== "designer") return json(res, 403, { error: "Designers only" });
    return updateDesigner(req, res, id);
  } catch (err) {
    json(res, 401, { error: err.message || "Unauthorized" });
  }
};

/** حذف مصمم (admin) — يخفض الدور إلى user ويحذف designerprofile */
export const deleteDesigner = async (req, res, userId) => {
  try {
    const jwtUser = authenticate(req);
    if (jwtUser.role !== "admin") return json(res, 403, { error: "Forbidden" });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "designer") {
      return json(res, 404, { error: "Designer not found" });
    }
    await prisma.designerprofile.deleteMany({ where: { userId } });
    await prisma.user.update({
      where: { id: userId },
      data: { role: "user" },
    });
    json(res, 200, { message: "Designer deleted" });
  } catch (err) {
    if (err.message === "No token provided" || err.message?.includes("Invalid")) {
      return json(res, 401, { error: err.message || "Unauthorized" });
    }
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

/** طلبات الموردين (قيد الانتظار) — موردين غير معتمدين بعد */
/**
 * @swagger
 * /vendor-requests:
 *   get:
 *     tags: [Vendor Requests]
 *     summary: قائمة طلبات الجملة/التحول لتاجر المعلقة
 *     description: للمشرف؛ يُرجع vendors غير المعتمدين مع requestType و user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الطلبات
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PendingVendorRequest'
 *       500:
 *         description: خطأ خادم
 *   post:
 *     tags: [Vendor Requests]
 *     summary: تقديم طلب التحول إلى تاجر
 *     description: |
 *       الحقول الإلزامية: userId، shopName (اسم الشركة)، taxRegistration، companyType،
 *       fullName، email، phone، companyAddress. اختياري: city.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VendorUpgradeRequestBody'
 *     responses:
 *       201:
 *         description: تم إنشاء الطلب
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VendorRequestSubmitResponse'
 *       200:
 *         description: المستخدم تاجر بالفعل، أو طلب معتمد مسبقاً، أو تحديث طلب قائم
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VendorRequestSubmitResponse'
 *       400:
 *         description: حقول ناقصة أو غير صالحة
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: userId غير موجود
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: خطأ خادم
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/vendor-requests:
 *   get:
 *     tags: [Vendor Requests]
 *     summary: قائمة طلبات التاجر/الجملة (بادئة /api)
 *     description: نفس GET `/vendor-requests`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: قائمة الطلبات
 *   post:
 *     tags: [Vendor Requests]
 *     summary: تقديم طلب التحول إلى تاجر (بادئة /api)
 *     description: نفس POST `/vendor-requests`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VendorUpgradeRequestBody'
 *     responses:
 *       201:
 *         description: تم إنشاء الطلب
 */
export const getPendingVendorRequests = async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { isApproved: false },
    });
    const userIds = vendors.map((v) => v.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const withUser = vendors.map((v) => ({
      ...v,
      requestType: parseRequestType(v.taxRegistration) || REQUEST_TYPE_VENDOR,
      user: userMap[v.userId] || null,
    }));
    json(res, 200, withUser);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

/** طلب شراء بالجملة (user/designer) */
/**
 * @swagger
 * /wholesale-requests:
 *   post:
 *     tags: [Vendor Requests]
 *     summary: تقديم طلب شراء بالجملة
 *     description: |
 *       للمستخدم/المصمم لطلب تفعيل أسعار الجملة؛ تظهر الطلبات مع طلبات التحول لتاجر في لوحة الطلبات،
 *       وعند موافقة المشرف يُعتمد الطلب ويُحدَّث دور المستخدم إلى vendor.
 *       الحقول الإلزامية: userId، shopName، taxRegistration، companyType، fullName،
 *       email، phone، companyAddress. اختياري: city.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WholesaleRequestBody'
 *     responses:
 *       201:
 *         description: تم إنشاء الطلب
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VendorRequestSubmitResponse'
 *       200:
 *         description: المستخدم تاجر بالفعل، أو وصول جملة معتمد، أو تحديث طلب قائم
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VendorRequestSubmitResponse'
 *       400:
 *         description: حقول ناقصة أو غير صالحة
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: userId غير موجود
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: خطأ خادم
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/wholesale-requests:
 *   post:
 *     tags: [Vendor Requests]
 *     summary: تقديم طلب شراء بالجملة (بادئة /api)
 *     description: نفس POST `/wholesale-requests`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WholesaleRequestBody'
 *     responses:
 *       201:
 *         description: تم إنشاء الطلب
 */
export const createWholesaleRequest = async (req, res) => {
  try {
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    const userId = data.userId != null ? String(data.userId).trim() : "";
    if (!userId) return json(res, 400, { error: "userId is required" });
    const validated = validateRequestApplicantFields(data);
    if (!validated.ok) return json(res, 400, { error: validated.error });
    const payload = validated.values;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return json(res, 404, { error: "User not found" });

    if (user.role === "vendor") {
      return json(res, 200, {
        message: "User is already a vendor and can buy at wholesale price",
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: payload.fullName,
        email: payload.email,
        phone: payload.phone,
      },
    });

    const existing = await prisma.vendor.findFirst({ where: { userId } });
    const encodedTax = encodeRequestType(
      REQUEST_TYPE_WHOLESALE,
      payload.taxRegistration
    );
    const normalizedRegion = `type:${payload.companyType}`;
    if (existing) {
      if (existing.isApproved) {
        return json(res, 200, { message: "Wholesale access already approved" });
      }
      const updated = await prisma.vendor.update({
        where: { id: existing.id },
        data: {
          shopName: payload.shopName,
          city: data.city || existing.city || "N/A",
          address: payload.companyAddress,
          region: normalizedRegion,
          taxRegistration: encodedTax,
          isApproved: false,
        },
      });
      return json(res, 200, {
        message: "Wholesale request updated and sent for approval",
        request: updated,
      });
    }

    const created = await prisma.vendor.create({
      data: {
        userId,
        shopName: payload.shopName,
        city: data.city || "N/A",
        address: payload.companyAddress,
        region: normalizedRegion,
        taxRegistration: encodedTax,
        isApproved: false,
      },
    });
    return json(res, 201, {
      message: "Wholesale request submitted successfully",
      request: created,
    });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

/** طلب التحول إلى تاجر */
export const createVendorUpgradeRequest = async (req, res) => {
  try {
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    const userId = data.userId != null ? String(data.userId).trim() : "";
    if (!userId) return json(res, 400, { error: "userId is required" });
    const validated = validateRequestApplicantFields(data);
    if (!validated.ok) return json(res, 400, { error: validated.error });
    const payload = validated.values;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return json(res, 404, { error: "User not found" });
    if (user.role === "vendor") {
      return json(res, 200, { message: "User is already a vendor" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        name: payload.fullName,
        email: payload.email,
        phone: payload.phone,
      },
    });

    const encodedTax = encodeRequestType(
      REQUEST_TYPE_VENDOR,
      payload.taxRegistration
    );
    const normalizedRegion = `type:${payload.companyType}`;
    const existing = await prisma.vendor.findFirst({ where: { userId } });
    if (existing) {
      if (existing.isApproved) {
        return json(res, 200, { message: "Vendor request already approved" });
      }
      const updated = await prisma.vendor.update({
        where: { id: existing.id },
        data: {
          shopName: payload.shopName,
          city: data.city || "N/A",
          address: payload.companyAddress,
          region: normalizedRegion,
          taxRegistration: encodedTax,
          isApproved: false,
        },
      });
      return json(res, 200, {
        message: "Vendor request updated and sent for approval",
        request: updated,
      });
    }

    const created = await prisma.vendor.create({
      data: {
        userId,
        shopName: payload.shopName,
        city: data.city || "N/A",
        address: payload.companyAddress,
        region: normalizedRegion,
        taxRegistration: encodedTax,
        isApproved: false,
      },
    });
    return json(res, 201, {
      message: "Vendor request submitted successfully",
      request: created,
    });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

/**
 * @swagger
 * /vendors/approve/{vendorId}:
 *   put:
 *     tags: [Vendor Requests]
 *     summary: الموافقة على المورد أو تحديث حالة الدفع
 *     description: |
 *       عند isApproved=true ونوع الطلب VENDOR أو WHOLESALE يُرقّى المستخدم إلى دور vendor.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApproveVendorBody'
 *     responses:
 *       200:
 *         description: سجل vendor محدث مع requestType و user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PendingVendorRequest'
 *       500:
 *         description: خطأ خادم
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
/** الموافقة على المورد أو تحديث حالة الدفع (يُستدعى من لوحة طلبات الموردين) */
export const approveVendor = async (req, res, id) => {
  try {
    const body = await readBody(req).catch(() => "{}");
    const data = body ? JSON.parse(body) : {};
    const byId = await prisma.vendor.findUnique({ where: { id } });
    const byUserId = byId ? null : await prisma.vendor.findFirst({ where: { userId: id } });
    const target = byId || byUserId;
    if (!target) return json(res, 404, { error: "Vendor not found" });
    const updateData = {};
    if (data.isApproved != null) updateData.isApproved = data.isApproved;
    const vendor = await prisma.vendor.update({
      where: { id: target.id },
      data: updateData,
    });
    const requestType = parseRequestType(vendor.taxRegistration);
    const promoteToVendor =
      updateData.isApproved === true &&
      (requestType === REQUEST_TYPE_VENDOR || requestType === REQUEST_TYPE_WHOLESALE);
    if (promoteToVendor) {
      await prisma.user.update({
        where: { id: vendor.userId },
        data: { role: "vendor" },
      });
    }
    const user = await prisma.user.findUnique({ where: { id: vendor.userId } });
    json(res, 200, {
      ...vendor,
      requestType: requestType || REQUEST_TYPE_VENDOR,
      user: user || null,
    });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const deleteVendor = async (req, res, id) => {
  try {
    const byId = await prisma.vendor.findUnique({ where: { id: id } });
    const byUserId = await prisma.vendor.findFirst({ where: { userId: id } });
    const target = byId || byUserId;
    if (!target) return json(res, 404, { error: "Vendor not found" });
    await prisma.vendor.delete({ where: { id: target.id } });
    json(res, 200, { message: "Vendor deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Categories ==========

/**
 * @swagger
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: قائمة الأقسام مع عدد المنتجات لكل قسم
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة أقسام
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CategoryWithPaintCount'
 *       500:
 *         description: خطأ خادم
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   post:
 *     tags: [Categories]
 *     summary: إنشاء قسم جديد
 *     description: يُحدد الاسم من `name_en` أو `name_ar` أو `name` (بالأولوية).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryCreateBody'
 *     responses:
 *       201:
 *         description: القسم المُنشأ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       500:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/categories:
 *   get:
 *     tags: [Categories]
 *     summary: قائمة الأقسام (بادئة /api)
 *     description: نفس GET `/categories`.
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة أقسام
 *   post:
 *     tags: [Categories]
 *     summary: إنشاء قسم جديد (بادئة /api)
 *     description: نفس POST `/categories`.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryCreateBody'
 *     responses:
 *       201:
 *         description: القسم المُنشأ
 */
export const getCategories = async (req, res) => {
  try {
    let rows = [];
    const preferredLang = String(req.headers["accept-language"] || "ar").toLowerCase().startsWith("en")
      ? "en"
      : "ar";

    // 1) أول محاولة عبر Prisma (لو كانت migration/Prisma client متوافقة).
    try {
      rows = await prisma.category.findMany({
        orderBy: { name: "asc" },
        include: { offer: true },
      });
    } catch (_) {
      // 2) fallback: يشمل nameAr/nameEn لو الأعمدة موجودة.
      try {
        try {
          const raw = await prisma.$queryRawUnsafe(
            "SELECT `id`, `name`, `nameAr`, `nameEn`, `description`, `offerId` FROM `category` ORDER BY `name` ASC"
          );
          rows = Array.isArray(raw) ? raw.map((r) => ({ ...r, offer: null })) : [];
        } catch (_) {
          const raw = await prisma.$queryRawUnsafe(
            "SELECT `id`, `name`, `description` FROM `category` ORDER BY `name` ASC"
          );
          rows = Array.isArray(raw) ? raw.map((r) => ({ ...r, offerId: null, offer: null })) : [];
        }
      } catch (_) {
        rows = [];
      }
    }

    // حساب عدد المنتجات لكل Category
    let countRows = [];
    try {
      countRows = await prisma.$queryRawUnsafe(
        "SELECT `categoryId`, COUNT(*) AS cnt FROM `paint` GROUP BY `categoryId`"
      );
    } catch (_) {
      countRows = [];
    }
    const countMap = {};
    for (const r of Array.isArray(countRows) ? countRows : []) {
      const cid = r.categoryId ?? r.categoryid;
      const cnt = r.cnt ?? r.CNT;
      if (cid != null) countMap[String(cid)] = Number(cnt) || 0;
    }

    const categories = rows.map((c) => ({
      id: c.id,
      name:
        preferredLang === "en"
          ? c.nameEn || c.name || c.nameAr || ""
          : c.nameAr || c.name || c.nameEn || "",
      nameAr: c.nameAr || c.name || c.nameEn || "",
      nameEn: c.nameEn || c.name || c.nameAr || "",
      description: c.description ?? null,
      offerId: c.offerId ?? null,
      offer: c.offer ?? null,
      _count: { paints: countMap[c.id] || 0 },
    }));

    json(res, 200, categories);
  } catch (err) {
    // لا نريد 500 أبداً في هذه الصفحة
    json(res, 200, []);
  }
};

export const createCategory = async (req, res) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const nameAr = String(data.name_ar || data.nameAr || data.name || "").trim();
    const nameEn = String(data.name_en || data.nameEn || data.name || "").trim();
    const name = nameAr || nameEn;
    if (!nameAr || !nameEn) {
      return json(res, 400, { error: "Both Arabic and English names are required" });
    }
    let offerId = null;
    if (data.offerId != null && String(data.offerId).trim() !== "") {
      offerId = String(data.offerId).trim();
    }
    try {
      const category = await prisma.category.create({
        data: { name, nameAr, nameEn, description: data.description || null, offerId },
        include: { offer: true },
      });
      json(res, 201, {
        ...category,
        nameAr: category.nameAr || nameAr,
        nameEn: category.nameEn || nameEn,
        _count: { paints: 0 },
      });
      return;
    } catch (_) {
      const id = randomUUID();
      try {
        await prisma.$executeRawUnsafe(
          "INSERT INTO `category` (`id`, `name`, `nameAr`, `nameEn`, `description`, `offerId`) VALUES (?, ?, ?, ?, ?, ?)",
          id,
          name,
          nameAr,
          nameEn,
          data.description || null,
          offerId
        );
      } catch (_) {
        await prisma.$executeRawUnsafe(
          "INSERT INTO `category` (`id`, `name`, `description`, `offerId`) VALUES (?, ?, ?, ?)",
          id,
          name,
          data.description || null,
          offerId
        );
      }
      let created = [];
      try {
        created = await prisma.$queryRawUnsafe(
          "SELECT `id`, `name`, `nameAr`, `nameEn`, `description`, `offerId` FROM `category` WHERE `id` = ? LIMIT 1",
          id
        );
      } catch (_) {
        created = await prisma.$queryRawUnsafe(
          "SELECT `id`, `name`, `description`, `offerId` FROM `category` WHERE `id` = ? LIMIT 1",
          id
        );
      }
      const row = Array.isArray(created) && created[0] ? created[0] : { id, name, nameAr, nameEn, description: data.description || null, offerId };
      json(res, 201, { ...row, offer: null, _count: { paints: 0 } });
      return;
    }
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

/**
 * @swagger
 * /categories/{id}:
 *   put:
 *     tags: [Categories]
 *     summary: تحديث قسم
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryUpdateBody'
 *     responses:
 *       200:
 *         description: القسم بعد التحديث
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       500:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   delete:
 *     tags: [Categories]
 *     summary: حذف قسم
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: تم الحذف
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoryDeleted'
 *       500:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/categories/{id}:
 *   put:
 *     tags: [Categories]
 *     summary: تحديث قسم (بادئة /api)
 *     description: نفس PUT `/categories/{id}`.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: القسم بعد التحديث
 *   delete:
 *     tags: [Categories]
 *     summary: حذف قسم (بادئة /api)
 *     description: نفس DELETE `/categories/{id}`.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: تم الحذف
 */
export const updateCategory = async (req, res, id) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const nextNameAr = data.name_ar ?? data.nameAr;
    const nextNameEn = data.name_en ?? data.nameEn;
    const name = data.name_en ?? data.name_ar ?? data.name;
    const hasOfferKey = Object.prototype.hasOwnProperty.call(data, "offerId");
    const offerIdPatch = hasOfferKey
      ? data.offerId === null || data.offerId === "" || data.offerId === undefined
        ? null
        : String(data.offerId)
      : undefined;
    const patch = {
      ...(name && { name }),
      ...(nextNameAr !== undefined && { nameAr: String(nextNameAr).trim() }),
      ...(nextNameEn !== undefined && { nameEn: String(nextNameEn).trim() }),
      ...(data.description !== undefined && { description: data.description }),
      ...(offerIdPatch !== undefined && { offerId: offerIdPatch }),
    };

    // أولاً: المسار الطبيعي مع include relation
    let category;
    try {
      category = await prisma.category.update({
        where: { id: id },
        data: patch,
        include: { offer: true },
      });
    } catch (_) {
      try {
        // fallback إذا relation offer غير متاحة في Prisma client الحالي
        category = await prisma.category.update({
          where: { id: id },
          data: patch,
        });
        category = { ...category, offer: null };
      } catch (_) {
        const sqlPatches = [];
        const params = [];
        if (name !== undefined && String(name).trim() !== "") {
          sqlPatches.push("`name` = ?");
          params.push(String(name).trim());
        }
        if (nextNameAr !== undefined) {
          sqlPatches.push("`nameAr` = ?");
          params.push(String(nextNameAr).trim());
        }
        if (nextNameEn !== undefined) {
          sqlPatches.push("`nameEn` = ?");
          params.push(String(nextNameEn).trim());
        }
        if (data.description !== undefined) {
          sqlPatches.push("`description` = ?");
          params.push(data.description);
        }
        if (offerIdPatch !== undefined) {
          sqlPatches.push("`offerId` = ?");
          params.push(offerIdPatch);
        }
        if (sqlPatches.length > 0) {
          try {
            await prisma.$executeRawUnsafe(
              `UPDATE \`category\` SET ${sqlPatches.join(", ")} WHERE \`id\` = ?`,
              ...params,
              id
            );
          } catch (_) {
            const legacyPatches = [];
            const legacyParams = [];
            if (name !== undefined && String(name).trim() !== "") {
              legacyPatches.push("`name` = ?");
              legacyParams.push(String(name).trim());
            }
            if (data.description !== undefined) {
              legacyPatches.push("`description` = ?");
              legacyParams.push(data.description);
            }
            if (offerIdPatch !== undefined) {
              legacyPatches.push("`offerId` = ?");
              legacyParams.push(offerIdPatch);
            }
            if (legacyPatches.length > 0) {
              await prisma.$executeRawUnsafe(
                `UPDATE \`category\` SET ${legacyPatches.join(", ")} WHERE \`id\` = ?`,
                ...legacyParams,
                id
              );
            }
          }
        }
        try {
          const raw = await prisma.$queryRawUnsafe(
            "SELECT `id`, `name`, `nameAr`, `nameEn`, `description`, `offerId` FROM `category` WHERE `id` = ? LIMIT 1",
            id
          );
          category = Array.isArray(raw) && raw[0] ? { ...raw[0], offer: null } : null;
        } catch (_) {
          const raw = await prisma.$queryRawUnsafe(
            "SELECT `id`, `name`, `description`, `offerId` FROM `category` WHERE `id` = ? LIMIT 1",
            id
          );
          category = Array.isArray(raw) && raw[0] ? { ...raw[0], offer: null } : null;
        }
      }
    }
    let paintCount = 0;
    try {
      paintCount = await prisma.paint.count({ where: { categoryId: id } });
    } catch (_) {
      paintCount = 0;
    }
    if (!category) return json(res, 404, { error: "Category not found" });
    json(res, 200, {
      ...category,
      nameAr: category.nameAr || category.name || "",
      nameEn: category.nameEn || category.name || "",
      _count: { paints: paintCount },
    });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const deleteCategory = async (req, res, id) => {
  try {
    await prisma.category.delete({ where: { id: id } });
    json(res, 200, { message: "Category deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Offers ==========
const normalizeTargetPriceType = (v) =>
  v === "retail" || v === "wholesale" || v === "both" ? v : "both";
const normalizeScopeType = (v) =>
  v === "category" || v === "product" ? v : null;
const normalizeCampaignType = (v) =>
  v === "coupon" || v === "offer" ? v : "offer";

const resolveCampaignTypeFromReq = (req, fallback = "offer") => {
  try {
    const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const q = normalizeCampaignType(url.searchParams.get("type"));
    const pathname = url.pathname || "";
    if (pathname === "/coupons" || pathname === "/api/coupons") return "coupon";
    if (pathname === "/offers" || pathname === "/api/offers") return q || fallback;
    return q || fallback;
  } catch {
    return fallback;
  }
};

const ensureOfferAdvancedColumns = async () => {
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `offer` ADD COLUMN `scopeType` VARCHAR(16) NULL",
    );
  } catch (_) {}
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `offer` ADD COLUMN `scopeId` VARCHAR(191) NULL",
    );
  } catch (_) {}
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `offer` ADD COLUMN `targetPriceType` VARCHAR(16) NOT NULL DEFAULT 'both'",
    );
  } catch (_) {}
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `offer` ADD COLUMN `campaignType` VARCHAR(16) NOT NULL DEFAULT 'offer'",
    );
  } catch (_) {}
  try {
    await prisma.$executeRawUnsafe(
      "UPDATE `offer` SET `campaignType` = 'offer' WHERE `campaignType` IS NULL OR `campaignType` = ''",
    );
  } catch (_) {}
};

const ensureOfferNotificationsTable = async () => {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`offer_notification\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`userId\` VARCHAR(191) NOT NULL,
        \`offerId\` VARCHAR(191) NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`message\` TEXT NULL,
        \`isRead\` TINYINT(1) NOT NULL DEFAULT 0,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`offer_notification_user_created_idx\` (\`userId\`, \`createdAt\`),
        INDEX \`offer_notification_offer_idx\` (\`offerId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (_) {
    // Keep API resilient in restricted environments.
  }
};

const createOfferNotificationsForUsers = async (offer) => {
  await ensureOfferNotificationsTable();
  const users = await prisma.$queryRawUnsafe(
    "SELECT `id` FROM `user` WHERE `role` = 'user'"
  );
  if (!Array.isArray(users) || users.length === 0) return;
  const title = "عرض جديد";
  const message = `تمت إضافة عرض جديد: ${offer.title}`;
  for (const row of users) {
    const userId = row?.id ? String(row.id) : "";
    if (!userId) continue;
    await prisma.$executeRawUnsafe(
      "INSERT INTO `offer_notification` (`id`,`userId`,`offerId`,`title`,`message`,`isRead`,`createdAt`) VALUES (?,?,?,?,?,?,?)",
      randomUUID(),
      userId,
      String(offer.id),
      title,
      message,
      0,
      new Date().toISOString().slice(0, 19).replace("T", " "),
    );
  }
};

const loadActiveScopedOffers = async () => {
  await ensureOfferAdvancedColumns();
  const nowIso = new Date().toISOString().slice(0, 19).replace("T", " ");
  const rows = await prisma.$queryRawUnsafe(
    "SELECT `id`,`discount`,`discountType`,`scopeType`,`scopeId`,`targetPriceType`,`campaignType`,`isActive`,`startDate`,`endDate` FROM `offer` WHERE `isActive`=1 AND `startDate` <= ? AND `endDate` >= ? AND (`campaignType` = 'offer' OR `campaignType` IS NULL OR `campaignType` = '')",
    nowIso,
    nowIso,
  );
  return Array.isArray(rows) ? rows : [];
};

const resolveOfferForPaint = (offers, paint, priceType) => {
  const pId = String(paint?.id || "");
  const cId = String(paint?.categoryId || "");
  const candidates = (offers || []).filter((o) => {
    const scopeType = normalizeScopeType(o.scopeType);
    const scopeId = o.scopeId != null ? String(o.scopeId) : "";
    if (!scopeType || !scopeId) return false;
    if (scopeType === "product" && scopeId !== pId) return false;
    if (scopeType === "category" && scopeId !== cId) return false;
    const target = normalizeTargetPriceType(o.targetPriceType || "both");
    return target === "both" || target === priceType;
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const sa = a.scopeType === "product" ? 2 : 1;
    const sb = b.scopeType === "product" ? 2 : 1;
    if (sa !== sb) return sb - sa;
    return Number(b.discount || 0) - Number(a.discount || 0);
  });
  return candidates[0];
};

const applyOfferOnPrice = (basePrice, offer) => {
  const base = Number(basePrice);
  if (!Number.isFinite(base) || !offer) return basePrice;
  const discount = Number(offer.discount || 0);
  const type = offer.discountType === "fixed" ? "fixed" : "percentage";
  const reduced =
    type === "fixed" ? base - discount : base - base * (discount / 100);
  return Math.max(0, Math.round(reduced * 100) / 100);
};

/**
 * @swagger
 * /offers:
 *   get:
 *     tags: [Offers]
 *     summary: قائمة العروض
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة العروض
 *   post:
 *     tags: [Offers]
 *     summary: إنشاء عرض
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, discount, discountType, scopeType, scopeId, targetPriceType, startDate, endDate]
 *             properties:
 *               title: { type: string }
 *               discount: { type: number }
 *               discountType: { type: string, enum: [percentage, fixed] }
 *               scopeType: { type: string, enum: [category, product] }
 *               scopeId: { type: string }
 *               targetPriceType: { type: string, enum: [both, retail, wholesale] }
 *               isActive: { type: boolean }
 *               startDate: { type: string, format: date-time }
 *               endDate: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: العرض المُنشأ
 * /offers/{id}:
 *   patch:
 *     tags: [Offers]
 *     summary: تحديث عرض
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: العرض بعد التحديث
 *   delete:
 *     tags: [Offers]
 *     summary: حذف عرض
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تم الحذف
 * /api/offers:
 *   get:
 *     tags: [Offers]
 *     summary: قائمة العروض (بادئة /api)
 *     description: نفس GET `/offers`.
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة العروض
 *   post:
 *     tags: [Offers]
 *     summary: إنشاء عرض (بادئة /api)
 *     description: نفس POST `/offers`.
 *     security: []
 *     responses:
 *       201:
 *         description: العرض المُنشأ
 * /api/offers/{id}:
 *   patch:
 *     tags: [Offers]
 *     summary: تحديث عرض (بادئة /api)
 *     description: نفس PATCH `/offers/{id}`.
 *     security: []
 *     responses:
 *       200:
 *         description: العرض بعد التحديث
 *   delete:
 *     tags: [Offers]
 *     summary: حذف عرض (بادئة /api)
 *     description: نفس DELETE `/offers/{id}`.
 *     security: []
 *     responses:
 *       200:
 *         description: تم الحذف
 * /coupons:
 *   get:
 *     tags: [Offers]
 *     summary: قائمة الكوبونات
 *     description: نفس العروض لكن بنوع `coupon`.
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة كوبونات
 *   post:
 *     tags: [Offers]
 *     summary: إنشاء كوبون
 *     description: يمكن إرسال `code` أو `title` كرمز الكوبون.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [discount, discountType, scopeType, scopeId, targetPriceType, startDate, endDate]
 *             properties:
 *               code: { type: string }
 *               title: { type: string }
 *               discount: { type: number }
 *               discountType: { type: string, enum: [percentage, fixed] }
 *               scopeType: { type: string, enum: [category, product] }
 *               scopeId: { type: string }
 *               targetPriceType: { type: string, enum: [both, retail, wholesale] }
 *               isActive: { type: boolean }
 *               startDate: { type: string, format: date-time }
 *               endDate: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: الكوبون المُنشأ
 * /coupons/{id}:
 *   patch:
 *     tags: [Offers]
 *     summary: تحديث كوبون
 *     security: []
 *     responses:
 *       200:
 *         description: الكوبون بعد التحديث
 *   delete:
 *     tags: [Offers]
 *     summary: حذف كوبون
 *     security: []
 *     responses:
 *       200:
 *         description: تم الحذف
 * /api/coupons:
 *   get:
 *     tags: [Offers]
 *     summary: قائمة الكوبونات (بادئة /api)
 *     description: نفس GET `/coupons`.
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة كوبونات
 *   post:
 *     tags: [Offers]
 *     summary: إنشاء كوبون (بادئة /api)
 *     description: نفس POST `/coupons`.
 *     security: []
 *     responses:
 *       201:
 *         description: الكوبون المُنشأ
 * /api/coupons/{id}:
 *   patch:
 *     tags: [Offers]
 *     summary: تحديث كوبون (بادئة /api)
 *     description: نفس PATCH `/coupons/{id}`.
 *     security: []
 *     responses:
 *       200:
 *         description: الكوبون بعد التحديث
 *   delete:
 *     tags: [Offers]
 *     summary: حذف كوبون (بادئة /api)
 *     description: نفس DELETE `/coupons/{id}`.
 *     security: []
 *     responses:
 *       200:
 *         description: تم الحذف
 */
export const getOffers = async (req, res) => {
  try {
    await ensureOfferAdvancedColumns();
    const campaignType = resolveCampaignTypeFromReq(req, "offer");
    const offers = await prisma.offer.findMany({ orderBy: { startDate: "desc" } });
    const rows = await prisma.$queryRawUnsafe(
      "SELECT `id`,`scopeType`,`scopeId`,`targetPriceType`,`campaignType` FROM `offer`",
    );
    const meta = Object.fromEntries(
      (Array.isArray(rows) ? rows : []).map((r) => [
        String(r.id),
        {
          scopeType: normalizeScopeType(r.scopeType),
          scopeId: r.scopeId != null ? String(r.scopeId) : null,
          targetPriceType: normalizeTargetPriceType(r.targetPriceType || "both"),
          campaignType: normalizeCampaignType(r.campaignType || "offer"),
        },
      ]),
    );
    const normalized = offers.map((o) => ({ ...o, ...(meta[String(o.id)] || {}) }));
    json(
      res,
      200,
      normalized.filter((o) => normalizeCampaignType(o.campaignType || "offer") === campaignType),
    );
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const createOffer = async (req, res) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const inferredCampaignType = resolveCampaignTypeFromReq(
      req,
      normalizeCampaignType(data.campaignType || "offer"),
    );
    const titleSource =
      inferredCampaignType === "coupon"
        ? String(data.code || data.title || "").trim()
        : String(data.title || "").trim();
    const title = titleSource;
    if (!title) {
      return json(
        res,
        400,
        { error: inferredCampaignType === "coupon" ? "Coupon code is required" : "Title is required" },
      );
    }

    const discount = Number(data.discount);
    if (!Number.isFinite(discount) || discount < 0) {
      return json(res, 400, { error: "Invalid discount value" });
    }

    const now = new Date();
    const startDate =
      data.startDate != null && String(data.startDate).trim() !== ""
        ? new Date(data.startDate)
        : now;
    const endDate =
      data.endDate != null && String(data.endDate).trim() !== ""
        ? new Date(data.endDate)
        : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return json(res, 400, { error: "Invalid startDate or endDate" });
    }
    if (endDate < startDate) {
      return json(res, 400, { error: "endDate must be after startDate" });
    }
    await ensureOfferAdvancedColumns();
    const campaignType = inferredCampaignType;
    const scopeType = normalizeScopeType(data.scopeType);
    const scopeId =
      data.scopeId != null && String(data.scopeId).trim() !== ""
        ? String(data.scopeId).trim()
        : null;
    if (!scopeType || !scopeId) {
      return json(res, 400, { error: "scopeType and scopeId are required" });
    }
    const targetPriceType = normalizeTargetPriceType(data.targetPriceType || "both");

    const offer = await prisma.offer.create({
      data: {
        title,
        discount,
        isActive: data.isActive !== false,
        startDate,
        endDate,
        discountType: data.discountType || "percentage",
      },
    });
    await prisma.$executeRawUnsafe(
      "UPDATE `offer` SET `scopeType` = ?, `scopeId` = ?, `targetPriceType` = ?, `campaignType` = ? WHERE `id` = ?",
      scopeType,
      scopeId,
      targetPriceType,
      campaignType,
      offer.id,
    );
    const out = { ...offer, scopeType, scopeId, targetPriceType, campaignType };
    try {
      if (campaignType === "offer") {
        await createOfferNotificationsForUsers(out);
      }
    } catch (_) {
      // Notification failure should not block creating offer.
    }
    json(res, 201, out);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const getMyOfferNotifications = async (req, res) => {
  try {
    const user = authenticate(req);
    await ensureOfferNotificationsTable();
    const rows = await prisma.$queryRawUnsafe(
      "SELECT `id`,`offerId`,`title`,`message`,`isRead`,`createdAt` FROM `offer_notification` WHERE `userId` = ? ORDER BY `createdAt` DESC LIMIT 50",
      user.id
    );
    const unreadCountRows = await prisma.$queryRawUnsafe(
      "SELECT COUNT(*) AS `count` FROM `offer_notification` WHERE `userId` = ? AND `isRead` = 0",
      user.id
    );
    const unreadCount = Number(unreadCountRows?.[0]?.count || 0);
    json(res, 200, {
      unreadCount,
      items: (Array.isArray(rows) ? rows : []).map((n) => ({
        ...n,
        isRead: Boolean(n.isRead),
      })),
    });
  } catch (err) {
    const code = err.message?.includes("token") ? 401 : 500;
    json(res, code, { error: err.message || "Failed to load notifications" });
  }
};

export const markOfferNotificationRead = async (req, res, id) => {
  try {
    const user = authenticate(req);
    await ensureOfferNotificationsTable();
    const affected = await prisma.$executeRawUnsafe(
      "UPDATE `offer_notification` SET `isRead` = 1 WHERE `id` = ? AND `userId` = ?",
      id,
      user.id
    );
    if (!affected) return json(res, 404, { error: "Notification not found" });
    json(res, 200, { message: "Notification marked as read" });
  } catch (err) {
    const code = err.message?.includes("token") ? 401 : 500;
    json(res, code, { error: err.message || "Failed to update notification" });
  }
};

export const markAllOfferNotificationsRead = async (req, res) => {
  try {
    const user = authenticate(req);
    await ensureOfferNotificationsTable();
    await prisma.$executeRawUnsafe(
      "UPDATE `offer_notification` SET `isRead` = 1 WHERE `userId` = ? AND `isRead` = 0",
      user.id
    );
    json(res, 200, { message: "All notifications marked as read" });
  } catch (err) {
    const code = err.message?.includes("token") ? 401 : 500;
    json(res, code, { error: err.message || "Failed to update notifications" });
  }
};

export const updateOffer = async (req, res, id) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    await ensureOfferAdvancedColumns();
    const offer = await prisma.offer.update({
      where: { id: id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.discount !== undefined && { discount: Number(data.discount) }),
        ...(data.isActive !== undefined && { isActive: Boolean(data.isActive) }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
        ...(data.discountType !== undefined && { discountType: data.discountType }),
      },
    });
    const hasScopeType = Object.prototype.hasOwnProperty.call(data, "scopeType");
    const hasScopeId = Object.prototype.hasOwnProperty.call(data, "scopeId");
    const hasTarget = Object.prototype.hasOwnProperty.call(data, "targetPriceType");
    if (hasScopeType || hasScopeId || hasTarget) {
      const prev = await prisma.$queryRawUnsafe(
        "SELECT `scopeType`,`scopeId`,`targetPriceType`,`campaignType` FROM `offer` WHERE `id` = ? LIMIT 1",
        id,
      );
      const row = Array.isArray(prev) && prev[0] ? prev[0] : {};
      const scopeType = hasScopeType
        ? normalizeScopeType(data.scopeType)
        : normalizeScopeType(row.scopeType);
      const scopeId = hasScopeId
        ? (data.scopeId != null && String(data.scopeId).trim() !== "" ? String(data.scopeId).trim() : null)
        : (row.scopeId != null ? String(row.scopeId) : null);
      const targetPriceType = hasTarget
        ? normalizeTargetPriceType(data.targetPriceType || "both")
        : normalizeTargetPriceType(row.targetPriceType || "both");
      await prisma.$executeRawUnsafe(
        "UPDATE `offer` SET `scopeType` = ?, `scopeId` = ?, `targetPriceType` = ? WHERE `id` = ?",
        scopeType,
        scopeId,
        targetPriceType,
        id,
      );
      return json(res, 200, {
        ...offer,
        scopeType,
        scopeId,
        targetPriceType,
        campaignType: normalizeCampaignType(row.campaignType || "offer"),
      });
    }
    const meta = await prisma.$queryRawUnsafe(
      "SELECT `campaignType`,`scopeType`,`scopeId`,`targetPriceType` FROM `offer` WHERE `id` = ? LIMIT 1",
      id,
    );
    const row = Array.isArray(meta) && meta[0] ? meta[0] : {};
    json(res, 200, {
      ...offer,
      scopeType: normalizeScopeType(row.scopeType),
      scopeId: row.scopeId != null ? String(row.scopeId) : null,
      targetPriceType: normalizeTargetPriceType(row.targetPriceType || "both"),
      campaignType: normalizeCampaignType(row.campaignType || "offer"),
    });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const deleteOffer = async (req, res, id) => {
  try {
    await prisma.offer.delete({ where: { id: id } });
    json(res, 200, { message: "Offer deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Color systems (من ملف الباليتات — بدون داتابيز) ==========
export const getColorSystems = async (req, res) => {
  try {
    const list = colorSystems.map((s) => ({ id: s.id, name: s.name, slug: s.slug || null }));
    json(res, 200, list);
  } catch (err) {
    json(res, 200, []);
  }
};

// ========== Colors: عند systemId من الباليتات، وإلا من favoritecolor ==========
export const getColors = async (req, res) => {
  try {
    const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const systemId = url.searchParams.get("systemId");
    if (systemId != null && systemId !== "") {
      const sid = Number(systemId);
      if (!Number.isFinite(sid)) return json(res, 200, []);
      const palette = systemPalettes[sid];
      const list = Array.isArray(palette)
        ? palette.map((item, i) => ({
            id: i + 1,
            colorSystemId: sid,
            code: item.code,
            hex: item.hex,
            labL: null,
            labA: null,
            labB: null,
          }))
        : [];
      return json(res, 200, list);
    }
    const rows = await prisma.favoritecolor.findMany();
    const colors = rows.map((c) => ({
      id: c.id,
      userId: c.userId,
      code: c.colorCode || c.name || "",
      hex: c.colorCode && /^#[0-9A-Fa-f]{6}$/.test(c.colorCode) ? c.colorCode : c.colorCode || "#000000",
      colorCode: c.colorCode,
      name: c.name,
      colorSystemId: null,
      colorSystem: { id: null, name: c.name || "—" },
    }));
    json(res, 200, colors);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== تحويل لون إلى أقرب لون في نظام (POST /services/convert) — chroma + باليتات ==========
export const handleServicesConvert = async (req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      let hex = data.hex != null ? String(data.hex).trim().replace(/^#/, "") : "";
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      if (hex.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(hex)) hex = "";
      if (data.rgb && typeof data.rgb === "object" && Number.isFinite(data.rgb.r + data.rgb.g + data.rgb.b)) {
        const r = Math.max(0, Math.min(255, Math.round(data.rgb.r)));
        const g = Math.max(0, Math.min(255, Math.round(data.rgb.g)));
        const b = Math.max(0, Math.min(255, Math.round(data.rgb.b)));
        hex = [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
      }
      hex = hex ? "#" + hex : "";
      const targetSystemId = data.targetSystemId != null ? Number(data.targetSystemId) : null;
      if (!hex || !Number.isFinite(targetSystemId) || targetSystemId < 1) {
        json(res, 400, { error: "Invalid input: provide hex (or rgb) and targetSystemId" });
        return;
      }
      if (!chroma.valid(hex)) {
        json(res, 400, { error: "Invalid color" });
        return;
      }
      const sourceChroma = chroma(hex);
      const sourceFormats = chromaToFormats(sourceChroma);
      if (!sourceFormats) {
        json(res, 400, { error: "Invalid color" });
        return;
      }
      const palette = systemPalettes[targetSystemId];
      const systemColors = Array.isArray(palette) ? palette : [];
      if (systemColors.length === 0) {
        json(res, 200, {
          originalColor: {
            hex: sourceFormats.hex,
            code: "—",
            rgb: sourceFormats.rgb,
            cmyk: sourceFormats.cmyk,
            hsl: sourceFormats.hsl,
            lab_l: sourceFormats.lab_l,
            lab_a: sourceFormats.lab_a,
            lab_b: sourceFormats.lab_b,
          },
          matchedColor: null,
          comparison: { deltaE: null, matchPercentage: 0, differenceNote: "No colors in target system" },
        });
        return;
      }
      let best = null;
      let bestDelta = Infinity;
      systemColors.forEach((item, index) => {
        const candidate = chroma(item.hex);
        if (!chroma.valid(item.hex)) return;
        const d = chroma.distance(sourceChroma, candidate, "lab");
        if (d < bestDelta) {
          bestDelta = d;
          best = { ...item, index };
        }
      });
      const matchPct = bestDelta < 0.01 ? 100 : Math.max(0, Math.round(100 - Math.min(bestDelta * 5, 100)));
      const matchedFormats = best ? chromaToFormats(chroma(best.hex)) : null;
      json(res, 200, {
        originalColor: {
          hex: sourceFormats.hex,
          code: "Source",
          rgb: sourceFormats.rgb,
          cmyk: sourceFormats.cmyk,
          hsl: sourceFormats.hsl,
          lab_l: sourceFormats.lab_l,
          lab_a: sourceFormats.lab_a,
          lab_b: sourceFormats.lab_b,
        },
        matchedColor: best
          ? {
              id: (best.index ?? 0) + 1,
              code: best.code,
              hex: best.hex,
              rgb: matchedFormats?.rgb,
              cmyk: matchedFormats?.cmyk,
              hsl: matchedFormats?.hsl,
              lab_l: matchedFormats?.lab_l,
              lab_a: matchedFormats?.lab_a,
              lab_b: matchedFormats?.lab_b,
            }
          : null,
        comparison: {
          deltaE: best != null ? Math.round(bestDelta * 100) / 100 : null,
          matchPercentage: best != null ? matchPct : 0,
          differenceNote:
            bestDelta < 2 ? "Excellent match" : bestDelta < 4 ? "Good match" : bestDelta < 6 ? "Noticeable difference" : "Visible difference",
        },
      });
    } catch (err) {
      console.error("[handleServicesConvert]", err?.message);
      json(res, 500, { error: err.message || "Conversion failed" });
    }
  });
};

// ========== Audit logs (سجلات التدقيق) — لا نُرجع 500 أبداً ==========
/**
 * @swagger
 * /audit-logs:
 *   get:
 *     tags: [Audit]
 *     summary: سجلات التدقيق
 *     description: مراقبة كافة تحركات النظام والعمليات الحساسة.
 *     security: []
 *     responses:
 *       200:
 *         description: قائمة السجلات
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   userId: { type: string, nullable: true }
 *                   action: { type: string }
 *                   details: { type: string }
 *                   createdAt: { type: string, format: date-time }
 * /api/audit-logs:
 *   get:
 *     tags: [Audit]
 *     summary: سجلات التدقيق (بادئة /api)
 *     description: نفس GET `/audit-logs`.
 *     security: []
 *     responses:
 *       200:
 *         description: قائمة السجلات
 */
export const getAuditLogs = async (req, res) => {
  let logs = [];
  try {
    try {
      logs = await prisma.auditlog.findMany({
        orderBy: { createdAt: "desc" },
      });
    } catch (_) {
      try {
        const raw = await prisma.$queryRawUnsafe(
          "SELECT * FROM `auditlog` ORDER BY `createdAt` DESC"
        );
        logs = Array.isArray(raw) ? raw : [];
      } catch (_) {
        logs = [];
      }
    }
    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))];
    let userMap = {};
    if (userIds.length > 0) {
      try {
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        });
        userMap = Object.fromEntries(users.map((u) => [u.id, u]));
      } catch (_) {}
    }
    const withUser = logs.map((l) => ({
      ...l,
      user: l.userId ? userMap[l.userId] || null : null,
    }));
    json(res, 200, withUser);
  } catch (err) {
    console.error("[getAuditLogs]", err.message);
    json(res, 200, []);
  }
};

// ========== API Customers (مستخدمون بدور user) ==========
export const getApiCustomers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "user" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });
    const customers = users.map((u) => ({ ...u, balance: 0, creditLimit: 0 }));
    json(res, 200, customers);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== API Invoices (الطلبات كفواتير — لوحة التحكم) ==========
/**
 * @swagger
 * /api/invoices:
 *   get:
 *     tags: [Orders]
 *     summary: قائمة الفواتير (جميع الطلبات)
 *     description: >-
 *       استجابة بصيغة فاتورة لكل طلب في النظام (مفيدة للداشبورد).
 *       لعرض طلبات مستخدم واحد فقط استخدم `GET /orders` مع رمز المصادقة.
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة فواتير
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DashboardInvoiceRow'
 *       500:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
export const getApiInvoices = async (req, res) => {
  try {
    await ensureOrderCouponColumns();
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });
    const orderIds = orders.map((o) => o.id);
    const pricingRows =
      orderIds.length === 0
        ? []
        : await prisma.$queryRawUnsafe(
            "SELECT `id`,`subtotalPrice`,`discountValue`,`couponCode`,`couponType`,`couponAmount` FROM `order` WHERE `id` IN (" +
              orderIds.map(() => "?").join(",") +
              ")",
            ...orderIds
          );
    const pricingMap = Object.fromEntries(
      (Array.isArray(pricingRows) ? pricingRows : []).map((r) => [String(r.id), r])
    );
    const userIds = [...new Set(orders.map((o) => o.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const invoices = orders.map((order) => ({
      id: order.id,
      invoiceNumber: `INV-${order.id}`,
      amount: order.totalPrice,
      subtotalPrice:
        pricingMap[order.id]?.subtotalPrice != null
          ? Number(pricingMap[order.id].subtotalPrice)
          : order.totalPrice,
      discountValue:
        pricingMap[order.id]?.discountValue != null
          ? Number(pricingMap[order.id].discountValue)
          : 0,
      couponCode: pricingMap[order.id]?.couponCode ?? null,
      status: order.status === "delivered" ? "paid" : "pending",
      createdAt: order.createdAt,
      customer: userMap[order.userId] || null,
      order: { ...order, source: "web" },
    }));
    json(res, 200, invoices);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

/**
 * @swagger
 * /cart:
 *   get:
 *     tags: [Cart]
 *     summary: عرض سلة المستخدم الحالي
 *     description: المسار الفعلي يدعم أيضاً `/api/cart`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: عناصر السلة مع الإجماليات
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CartResponse'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/cart:
 *   get:
 *     tags: [Cart]
 *     summary: عرض سلة المستخدم الحالي (بادئة /api)
 *     description: نفس GET `/cart`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: عناصر السلة مع الإجماليات
 */
export const getMyCart = async (req, res) => {
  try {
    const user = authenticate(req);
    const couponCode = extractCouponCodeFromReq(req);
    const summary = await buildCartSummary(user, couponCode);
    json(res, 200, summary);
  } catch (err) {
    json(res, 401, { error: err.message || "Unauthorized" });
  }
};

/**
 * @swagger
 * /cart/quote:
 *   post:
 *     tags: [Cart]
 *     summary: تسعير السلة مع كوبون قبل إتمام الطلب
 *     description: يُستخدم لاحتساب subtotal/discount/total بعد تمرير couponCode (اختياري).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               couponCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: ملخص السلة بعد تطبيق الكوبون
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CartResponse'
 *       400:
 *         description: الكوبون غير صالح/منتهي
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/cart/quote:
 *   post:
 *     tags: [Cart]
 *     summary: تسعير السلة مع كوبون (بادئة /api)
 *     description: نفس POST `/cart/quote`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ملخص السلة
 */
export const getCartQuote = async (req, res) => {
  try {
    const user = authenticate(req);
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    const couponCode = extractCouponCodeFromReq(req, data);
    const summary = await buildCartSummary(user, couponCode);
    if (couponCode && !summary.couponValid) {
      return json(res, 400, { error: "Invalid or expired coupon code", ...summary });
    }
    json(res, 200, summary);
  } catch (err) {
    const code = err.message?.includes("token") ? 401 : 400;
    json(res, code, { error: err.message || "Bad request" });
  }
};

/**
 * @swagger
 * /cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: إضافة منتج للسلة أو زيادة كميته
 *     description: المسار الفعلي يدعم أيضاً `/api/cart/items`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CartItemInput'
 *     responses:
 *       200:
 *         description: تم التحديث
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CartItemResponse'
 *       201:
 *         description: تم الإضافة
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CartItemResponse'
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: إضافة منتج للسلة أو زيادة كميته (بادئة /api)
 *     description: نفس POST `/cart/items`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CartItemInput'
 *     responses:
 *       201:
 *         description: تم الإضافة/التحديث
 */
export const addCartItem = async (req, res) => {
  try {
    const user = authenticate(req);
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    const paintId = String(data.paintId || "").trim();
    const quantity = Math.max(1, Math.floor(Number(data.quantity) || 1));
    if (!paintId) return json(res, 400, { error: "paintId is required" });
    const paint = await prisma.paint.findUnique({ where: { id: paintId } });
    if (!paint) return json(res, 404, { error: "Paint not found" });

    const existing = await prisma.cart.findFirst({
      where: { userId: user.id, paintId },
    });
    if (existing) {
      const updatedQty = Math.max(1, existing.quantity + quantity);
      const updated = await prisma.cart.update({
        where: { id: existing.id },
        data: { quantity: updatedQty },
      });
      const summary = await buildCartSummary(user, extractCouponCodeFromReq(req, data));
      return json(res, 200, { item: updated, cart: summary });
    }
    const created = await prisma.cart.create({
      data: { userId: user.id, paintId, quantity },
    });
    const summary = await buildCartSummary(user, extractCouponCodeFromReq(req, data));
    return json(res, 201, { item: created, cart: summary });
  } catch (err) {
    const code = err.message?.includes("token") ? 401 : 400;
    json(res, code, { error: err.message || "Bad request" });
  }
};

/**
 * @swagger
 * /cart/items/{itemId}:
 *   patch:
 *     tags: [Cart]
 *     summary: تعديل كمية عنصر في السلة
 *     description: المسار الفعلي يدعم أيضاً `/api/cart/items/{itemId}`. ويمكن استخدام PUT كذلك.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CartItemUpdateBody'
 *     responses:
 *       200:
 *         description: تم التعديل
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CartItemResponse'
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: العنصر غير موجود
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   delete:
 *     tags: [Cart]
 *     summary: حذف عنصر من السلة
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تم الحذف
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageOk'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/cart/items/{itemId}:
 *   patch:
 *     tags: [Cart]
 *     summary: تعديل كمية عنصر (بادئة /api)
 *     description: نفس PATCH `/cart/items/{itemId}`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم التعديل
 *   delete:
 *     tags: [Cart]
 *     summary: حذف عنصر من السلة (بادئة /api)
 *     description: نفس DELETE `/cart/items/{itemId}`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم الحذف
 */
export const updateCartItemQuantity = async (req, res, itemId) => {
  try {
    const user = authenticate(req);
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    const quantity = Math.floor(Number(data.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) {
      return json(res, 400, { error: "quantity must be >= 1" });
    }
    const item = await prisma.cart.findFirst({ where: { id: itemId, userId: user.id } });
    if (!item) return json(res, 404, { error: "Cart item not found" });
    const updated = await prisma.cart.update({ where: { id: itemId }, data: { quantity } });
    const summary = await buildCartSummary(user, extractCouponCodeFromReq(req, data));
    json(res, 200, { item: updated, cart: summary });
  } catch (err) {
    const code = err.message?.includes("token") ? 401 : 400;
    json(res, code, { error: err.message || "Bad request" });
  }
};

export const removeCartItem = async (req, res, itemId) => {
  try {
    const user = authenticate(req);
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    const item = await prisma.cart.findFirst({ where: { id: itemId, userId: user.id } });
    if (!item) return json(res, 404, { error: "Cart item not found" });
    await prisma.cart.delete({ where: { id: itemId } });
    const summary = await buildCartSummary(user, extractCouponCodeFromReq(req, data));
    json(res, 200, { message: "Cart item removed", cart: summary });
  } catch (err) {
    const code = err.message?.includes("token") ? 401 : 400;
    json(res, code, { error: err.message || "Bad request" });
  }
};

/**
 * @swagger
 * /payment-methods:
 *   get:
 *     tags: [Payments]
 *     summary: طرق الدفع المتاحة للتطبيق
 *     description: قائمة ثابتة (تسجيل الطريقة عند الطلب فقط؛ بدون بوابة دفع).
 *     security: []
 *     responses:
 *       200:
 *         description: قائمة الطرق
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PaymentMethodOption'
 * /api/payment-methods:
 *   get:
 *     tags: [Payments]
 *     summary: طرق الدفع المتاحة للتطبيق (بادئة /api)
 *     description: نفس GET `/payment-methods`.
 *     security: []
 *     responses:
 *       200:
 *         description: قائمة الطرق
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PaymentMethodOption'
 */
export const getPaymentMethods = async (req, res) => {
  json(res, 200, [
    { id: "visa", label: "Visa" },
    { id: "mastercard", label: "Mastercard" },
    { id: "apple_pay", label: "Apple Pay" },
  ]);
};

/**
 * @swagger
 * /checkout:
 *   post:
 *     tags: [Cart]
 *     summary: إتمام الشراء من السلة وإنشاء طلب
 *     description: >-
 *       المسار الفعلي يدعم أيضاً `/api/checkout`.
 *       فلو الطلب الكامل: GET /payment-methods -> POST /cart/items -> GET /cart -> POST /checkout -> GET /orders -> GET /orders/{id}.
 *       يجب إرسال طريقة الدفع (تسجيل فقط؛ بدون تحصيل إلكتروني).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckoutRequestBody'
 *           example:
 *             paymentMethod: visa
 *             city: Riyadh
 *             addressLine1: King Fahd Rd, Building 15
 *             addressLine2: Floor 2, Apt 6
 *             postalCode: "12271"
 *             phone: "+9665XXXXXXX"
 *     responses:
 *       201:
 *         description: تم إنشاء الطلب (تتضمن الاستجابة shipping عند إرسال بيانات الشحن)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CheckoutResponse'
 *       400:
 *         description: السلة فارغة أو مخزون غير كافٍ أو paymentMethod غير صالحة
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/checkout:
 *   post:
 *     tags: [Cart]
 *     summary: إتمام الشراء من السلة وإنشاء طلب (بادئة /api)
 *     description: نفس POST `/checkout`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckoutRequestBody'
 *           example:
 *             paymentMethod: visa
 *             city: Riyadh
 *             addressLine1: King Fahd Rd, Building 15
 *             addressLine2: Floor 2, Apt 6
 *             postalCode: "12271"
 *             phone: "+9665XXXXXXX"
 *     responses:
 *       201:
 *         description: تم إنشاء الطلب (تتضمن الاستجابة shipping عند إرسال بيانات الشحن)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CheckoutResponse'
 *       400:
 *         description: السلة فارغة أو مخزون غير كافٍ أو paymentMethod غير صالحة
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
export const checkoutCart = async (req, res) => {
  try {
    const user = authenticate(req);
    await ensureOrderShippingColumns();
    await ensureOrderCouponColumns();
    const raw = await readBody(req);
    let data = {};
    if (raw && String(raw).trim()) {
      try {
        data = JSON.parse(raw);
      } catch {
        return json(res, 400, { error: "Invalid JSON body" });
      }
    }
    const pmRaw = data.paymentMethod;
    if (pmRaw == null || String(pmRaw).trim() === "") {
      return json(res, 400, {
        error: "paymentMethod is required (visa, mastercard, apple_pay)",
      });
    }
    const paymentMethod = String(pmRaw).trim();
    if (!CHECKOUT_PAYMENT_METHODS.includes(paymentMethod)) {
      return json(res, 400, {
        error: "paymentMethod must be one of: visa, mastercard, apple_pay",
      });
    }
    const shipping = {
      city: data.shippingCity ?? data.city ?? data.zone ?? null,
      addressLine1: data.addressLine1 ?? data.address ?? null,
      addressLine2: data.addressLine2 ?? null,
      postalCode: data.postalCode ?? data.zipCode ?? null,
      phone: data.shippingPhone ?? data.phone ?? null,
    };
    const canBuyWholesale = await getCanBuyWholesaleForUser(user.id, user.role);
    const activeOffers = await loadActiveScopedOffers();
    const activeCoupons = await loadActiveCoupons();
    const priceType = canBuyWholesale ? "wholesale" : "retail";
    const couponCode =
      data.couponCode != null && String(data.couponCode).trim() !== ""
        ? String(data.couponCode).trim()
        : null;
    const coupon = couponCode ? findCouponByCode(activeCoupons, couponCode) : null;
    if (couponCode && !coupon) {
      return json(res, 400, { error: "Invalid or expired coupon code" });
    }
    const result = await prisma.$transaction(async (tx) => {
      const cartItems = await tx.cart.findMany({ where: { userId: user.id } });
      if (!cartItems.length) throw new Error("Cart is empty");
      const paintIds = [...new Set(cartItems.map((i) => i.paintId))];
      const paints = await tx.paint.findMany({ where: { id: { in: paintIds } } });
      const paintMap = Object.fromEntries(paints.map((p) => [p.id, p]));
      const lines = [];
      for (const item of cartItems) {
        const paint = paintMap[item.paintId];
        if (!paint) throw new Error(`Paint not found: ${item.paintId}`);
        const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const stock = Number(paint.stock || 0);
        if (stock < quantity) throw new Error(`Insufficient stock for ${paint.name}`);
        const baseUnitPrice = getUnitPriceForBuyer(user.role, paint, canBuyWholesale);
        const offer = resolveOfferForPaint(activeOffers, paint, priceType);
        const unitPrice = applyOfferOnPrice(baseUnitPrice, offer);
        lines.push({
          paintId: item.paintId,
          quantity,
          unitPrice,
          baseUnitPrice,
          appliedOfferId: offer?.id || null,
          lineTotal: unitPrice * quantity,
          paintName: paint.name,
          stockAfter: stock - quantity,
        });
      }
      const subtotalPrice = Math.round(lines.reduce((sum, l) => sum + l.lineTotal, 0) * 100) / 100;
      const couponCalc = applyCouponDiscount(subtotalPrice, coupon);
      const totalPrice = couponCalc.totalPrice;
      const discountValue = couponCalc.discountValue;
      let order;
      try {
        order = await tx.order.create({
          data: { userId: user.id, totalPrice, status: "pending", paymentMethod },
        });
      } catch (e) {
        // توافق مع Prisma client قديم لا يحتوي paymentMethod ضمن orderCreateInput
        const msg = String(e?.message || "");
        if (!msg.includes("Unknown arg `paymentMethod`")) throw e;
        order = await tx.order.create({
          data: { userId: user.id, totalPrice, status: "pending" },
        });
      }
      try {
        await tx.$executeRawUnsafe(
          "UPDATE `order` SET `shippingCity` = ?, `addressLine1` = ?, `addressLine2` = ?, `postalCode` = ?, `shippingPhone` = ?, `zone` = COALESCE(?, `zone`), `subtotalPrice` = ?, `discountValue` = ?, `couponCode` = ?, `couponType` = ?, `couponAmount` = ? WHERE `id` = ?",
          shipping.city != null && String(shipping.city).trim() !== "" ? String(shipping.city).trim() : null,
          shipping.addressLine1 != null && String(shipping.addressLine1).trim() !== "" ? String(shipping.addressLine1).trim() : null,
          shipping.addressLine2 != null && String(shipping.addressLine2).trim() !== "" ? String(shipping.addressLine2).trim() : null,
          shipping.postalCode != null && String(shipping.postalCode).trim() !== "" ? String(shipping.postalCode).trim() : null,
          shipping.phone != null && String(shipping.phone).trim() !== "" ? String(shipping.phone).trim() : null,
          shipping.city != null && String(shipping.city).trim() !== "" ? String(shipping.city).trim() : null,
          subtotalPrice,
          discountValue,
          coupon ? String(coupon.title) : null,
          coupon ? String(coupon.discountType === "fixed" ? "fixed" : "percentage") : null,
          coupon ? Number(coupon.discount || 0) : null,
          order.id,
        );
      } catch (_) {}
      await tx.orderitem.createMany({
        data: lines.map((l) => ({
          orderId: order.id,
          paintId: l.paintId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
      for (const line of lines) {
        await tx.paint.update({
          where: { id: line.paintId },
          data: {
            stock: { decrement: line.quantity },
            inStock: line.stockAfter > 0,
          },
        });
      }
      await tx.cart.deleteMany({ where: { userId: user.id } });
      return { order, lines, totalPrice, subtotalPrice, discountValue, couponCode: coupon ? String(coupon.title) : null };
    });
    json(res, 201, {
      message: "Order created from cart",
      orderId: result.order.id,
      invoiceNumber: `INV-${result.order.id}`,
      subtotalPrice: result.subtotalPrice,
      discountValue: result.discountValue,
      couponCode: result.couponCode,
      totalPrice: result.totalPrice,
      paymentMethod,
      shipping,
      items: result.lines,
    });
  } catch (err) {
    const text = err.message || "Checkout failed";
    const code = text.includes("token") ? 401 : 400;
    json(res, code, { error: text });
  }
};

// ========== Painters (الفنيون/الدهانون) ==========
/**
 * @swagger
 * /painters:
 *   get:
 *     tags: [Painters]
 *     summary: قائمة الفنيين مع user ومعرض الصور gallery
 *     description: "العميل يفلتر بنوع الخدمة والعنوان. مثال: GET /painters?serviceType=interior&address=Riyadh"
 *     security: []
 *     parameters:
 *       - in: query
 *         name: address
 *         description: تصفية حسب عنوان/مدينة الفني (مطابقة جزئية)
 *         schema: { type: string }
 *       - in: query
 *         name: serviceType
 *         description: interior أو exterior
 *         schema: { type: string, enum: [interior, exterior] }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PainterWithGallery'
 *   post:
 *     tags: [Painters]
 *     summary: إنشاء سجل فني مرتبط بمستخدم
 *     security: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PainterCreateBody'
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PainterWithGallery'
 * /painters/me:
 *   get:
 *     tags: [Painters]
 *     summary: بروفايل الفني الحالي (JWT، دور painter) مع gallery
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PainterWithGallery'
 *       401:
 *       403:
 *       404:
 *   put:
 *     tags: [Painters]
 *     summary: تحديث بروفايل الفني الحالي (اسم/بريد/هاتف + بيانات الفني)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PainterMeUpdateBody'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PainterWithGallery'
 * /painters/me/gallery:
 *   post:
 *     tags: [Painters]
 *     summary: إضافة صورة لمعرض أعمال الفني (multipart، الحقل image)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PainterGalleryItem'
 *       400:
 *       401:
 *       403:
 * /painters/me/gallery/{galleryId}:
 *   delete:
 *     tags: [Painters]
 *     summary: حذف صورة من المعرض (صاحب الفني)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: galleryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageOk'
 *       404:
 * /painters/gallery/{galleryId}:
 *   delete:
 *     tags: [Painters]
 *     summary: حذف صورة من المعرض (المشرف أو الفني صاحب الصورة)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: galleryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageOk'
 *       403:
 *       404:
 * /painters/{id}:
 *   get:
 *     tags: [Painters]
 *     summary: فني بالمعرف مع gallery
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PainterWithGallery'
 *       404:
 *   put:
 *     tags: [Painters]
 *     summary: تحديث فني (الفني نفسه أو المشرف)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PainterUpdateBody'
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PainterWithGallery'
 *       401:
 *       403:
 *       404:
 *   delete:
 *     tags: [Painters]
 *     summary: حذف سجل فني
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تم الحذف
 */
function attachGalleriesToPainters(painters, galleries) {
  const byPainter = {};
  for (const g of galleries) {
    if (!byPainter[g.painterId]) byPainter[g.painterId] = [];
    byPainter[g.painterId].push(g);
  }
  return painters.map((p) => ({
    ...p,
    gallery: byPainter[p.id] || [],
  }));
}

const attachAveragePainterRatings = async (painters) => {
  const painterIds = (Array.isArray(painters) ? painters : []).map((p) => p.id);
  if (painterIds.length === 0) return painters || [];
  const grouped = await prisma.painterreview.groupBy({
    by: ["painterId"],
    where: { painterId: { in: painterIds } },
    _avg: { rating: true },
  });
  const avgMap = Object.fromEntries(
    grouped.map((g) => [g.painterId, g?._avg?.rating != null ? Number(g._avg.rating) : null]),
  );
  return (painters || []).map((p) => ({
    ...p,
    rating: avgMap[p.id] != null ? Number(avgMap[p.id].toFixed(1)) : null,
  }));
};

export const getPainters = async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host}`);
    const city = String(parsed.searchParams.get("city") || "").trim();
    const address = String(parsed.searchParams.get("address") || "").trim();
    const serviceType = String(parsed.searchParams.get("serviceType") || "").trim();
    const location = city || address;
    const where = {
      ...(serviceType ? { serviceType } : {}),
      ...(location
        ? {
            OR: [
              { city: { contains: location } },
              { address: { contains: location } },
            ],
          }
        : {}),
    };
    const painters = await prisma.painter.findMany({ where });
    const userIds = painters.map((p) => p.userId);
    const painterIds = painters.map((p) => p.id);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const galleries =
      painterIds.length === 0
        ? []
        : await prisma.paintergallery.findMany({
            where: { painterId: { in: painterIds } },
            orderBy: { id: "desc" },
          });
    const withGallery = attachGalleriesToPainters(painters, galleries);
    const withAvgRating = await attachAveragePainterRatings(withGallery);
    const withUser = withAvgRating.map((p) => ({
      ...p,
      user: userMap[p.userId] || null,
    }));
    json(res, 200, withUser);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const getPainterById = async (req, res, id) => {
  try {
    const painter = await prisma.painter.findUnique({
      where: { id: id },
    });
    if (!painter) return json(res, 404, { error: "Painter not found" });
    const user = await prisma.user.findUnique({ where: { id: painter.userId } });
    const gallery = await prisma.paintergallery.findMany({
      where: { painterId: painter.id },
      orderBy: { id: "desc" },
    });
    const withAvg = (await attachAveragePainterRatings([painter]))[0] || painter;
    json(res, 200, {
      ...withAvg,
      user: user ? withoutPassword(user) : null,
      gallery,
    });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const createPainter = async (req, res) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const painter = await prisma.painter.create({
      data: {
        userId: data.userId,
        city: data.city || "",
        address: data.address || null,
        experience: Number(data.experience) || 0,
        serviceType: data.serviceType || "interior",
        rating: 0,
      },
    });
    const user = await prisma.user.findUnique({ where: { id: painter.userId } });
    json(res, 201, { ...painter, user: user ? withoutPassword(user) : null });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const updatePainter = async (req, res, id) => {
  try {
    const jwtUser = authenticate(req);
    const existing = await prisma.painter.findUnique({ where: { id } });
    if (!existing) return json(res, 404, { error: "Painter not found" });
    if (jwtUser.role !== "admin" && jwtUser.id !== existing.userId) {
      return json(res, 403, { error: "Forbidden" });
    }
    const body = await readBody(req);
    const data = JSON.parse(body);
    const painter = await prisma.painter.update({
      where: { id: id },
      data: {
        ...(data.city !== undefined && { city: data.city }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.experience !== undefined && { experience: Number(data.experience) }),
        ...(data.serviceType !== undefined && { serviceType: data.serviceType }),
        ...(data.bio !== undefined && {
          bio: data.bio === "" || data.bio == null ? null : String(data.bio),
        }),
      },
    });
    const user = await prisma.user.findUnique({ where: { id: painter.userId } });
    const gallery = await prisma.paintergallery.findMany({
      where: { painterId: painter.id },
      orderBy: { id: "desc" },
    });
    json(res, 200, { ...painter, user: user ? withoutPassword(user) : null, gallery });
  } catch (err) {
    if (err.message === "No token provided" || err.message?.includes("Invalid")) {
      return json(res, 401, { error: err.message || "Unauthorized" });
    }
    json(res, 500, { error: err.message });
  }
};

/** بروفايل الفني الحالي (JWT) — مع معرض الأعمال */
export const getPainterMe = async (req, res) => {
  try {
    const { id, role } = authenticate(req);
    if (role !== "painter") return json(res, 403, { error: "Painters only" });
    const painter = await prisma.painter.findUnique({ where: { userId: id } });
    if (!painter) return json(res, 404, { error: "Painter profile not found" });
    return getPainterById(req, res, painter.id);
  } catch (err) {
    json(res, 401, { error: err.message || "Unauthorized" });
  }
};

/** تحديث بروفايل الفني الحالي (JWT) — الاسم من user، باقي الحقول من painter */
export const updatePainterMe = async (req, res) => {
  try {
    const { id: userId, role } = authenticate(req);
    if (role !== "painter") return json(res, 403, { error: "Painters only" });
    const painter = await prisma.painter.findUnique({ where: { userId } });
    if (!painter) return json(res, 404, { error: "Painter profile not found" });
    const body = await readBody(req);
    const data = JSON.parse(body);
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
      },
    });
    const updated = await prisma.painter.update({
      where: { id: painter.id },
      data: {
        ...(data.city !== undefined && { city: data.city }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.experience !== undefined && { experience: Number(data.experience) }),
        ...(data.serviceType !== undefined && { serviceType: data.serviceType }),
        ...(data.bio !== undefined && {
          bio: data.bio === "" || data.bio == null ? null : String(data.bio),
        }),
      },
    });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const gallery = await prisma.paintergallery.findMany({
      where: { painterId: painter.id },
      orderBy: { id: "desc" },
    });
    json(res, 200, {
      ...updated,
      user: user ? withoutPassword(user) : null,
      gallery,
    });
  } catch (err) {
    if (err.message === "No token provided" || err.message?.includes("Invalid")) {
      return json(res, 401, { error: err.message || "Unauthorized" });
    }
    json(res, 500, { error: err.message });
  }
};

/** إضافة صورة لمعرض أعمال الفني (multipart: image) */
export const addPainterGalleryImage = async (req, res) => {
  try {
    const { id: userId, role } = authenticate(req);
    if (role !== "painter") return json(res, 403, { error: "Painters only" });
    const painter = await prisma.painter.findUnique({ where: { userId } });
    if (!painter) return json(res, 404, { error: "Painter profile not found" });
    if (!req.file) return json(res, 400, { error: "No file uploaded" });
    if (!ALLOWED_AVATAR_TYPES.has(req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return json(res, 400, { error: "Only JPEG, PNG, GIF or WebP images are allowed" });
    }
    const relativeUrl = `/uploads/${req.file.filename}`;
    const row = await prisma.paintergallery.create({
      data: { painterId: painter.id, imageUrl: relativeUrl },
    });
    json(res, 201, row);
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    const msg = err.message || "Upload failed";
    const code =
      msg.includes("token") || msg === "No token provided" ? 401 : 400;
    json(res, code, { error: msg });
  }
};

/** إضافة صورة لمعرض فني محدد — للمشرف فقط */
export const addPainterGalleryImageForPainter = async (req, res, painterId) => {
  try {
    const jwtUser = authenticate(req);
    if (jwtUser.role !== "admin") return json(res, 403, { error: "Admins only" });
    const painter = await prisma.painter.findUnique({ where: { id: painterId } });
    if (!painter) return json(res, 404, { error: "Painter profile not found" });
    if (!req.file) return json(res, 400, { error: "No file uploaded" });
    if (!ALLOWED_AVATAR_TYPES.has(req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return json(res, 400, { error: "Only JPEG, PNG, GIF or WebP images are allowed" });
    }
    const relativeUrl = `/uploads/${req.file.filename}`;
    const row = await prisma.paintergallery.create({
      data: { painterId: painter.id, imageUrl: relativeUrl },
    });
    json(res, 201, row);
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    const msg = err.message || "Upload failed";
    const code =
      msg.includes("token") || msg === "No token provided" ? 401 : 400;
    json(res, code, { error: msg });
  }
};

/** تعديل صورة من معرض أعمال الفني — الفني صاحب الصورة أو المشرف */
export const updatePainterGalleryImage = async (req, res, galleryId) => {
  try {
    const jwtUser = authenticate(req);
    const row = await prisma.paintergallery.findUnique({ where: { id: galleryId } });
    if (!row) return json(res, 404, { error: "Image not found" });
    let allowed = jwtUser.role === "admin";
    if (!allowed) {
      const painter = await prisma.painter.findUnique({ where: { userId: jwtUser.id } });
      if (painter && painter.id === row.painterId) allowed = true;
    }
    if (!allowed) return json(res, 403, { error: "Forbidden" });
    if (!req.file) return json(res, 400, { error: "No file uploaded" });
    if (!ALLOWED_AVATAR_TYPES.has(req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return json(res, 400, { error: "Only JPEG, PNG, GIF or WebP images are allowed" });
    }
    const relativeUrl = `/uploads/${req.file.filename}`;
    const updated = await prisma.paintergallery.update({
      where: { id: galleryId },
      data: { imageUrl: relativeUrl },
    });
    if (row.imageUrl && row.imageUrl.startsWith("/uploads/")) {
      const rel = row.imageUrl.replace(/^\/uploads\//, "");
      if (rel && !rel.includes("..") && !path.isAbsolute(rel)) {
        const oldPath = path.join(uploadsDir, rel);
        if (oldPath.startsWith(uploadsDir)) fs.unlink(oldPath, () => {});
      }
    }
    json(res, 200, updated);
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    const msg = err.message || "Update failed";
    const code =
      msg.includes("token") || msg === "No token provided" ? 401 : 400;
    json(res, code, { error: msg });
  }
};

/** حذف صورة من معرض أعمال الفني — الفني صاحب الصورة أو المشرف */
export const deletePainterGalleryImage = async (req, res, galleryId) => {
  try {
    const jwtUser = authenticate(req);
    const row = await prisma.paintergallery.findUnique({ where: { id: galleryId } });
    if (!row) return json(res, 404, { error: "Image not found" });
    let allowed = jwtUser.role === "admin";
    if (!allowed) {
      const painter = await prisma.painter.findUnique({ where: { userId: jwtUser.id } });
      if (painter && painter.id === row.painterId) allowed = true;
    }
    if (!allowed) return json(res, 403, { error: "Forbidden" });
    if (row.imageUrl && row.imageUrl.startsWith("/uploads/")) {
      const rel = row.imageUrl.replace(/^\/uploads\//, "");
      if (rel && !rel.includes("..") && !path.isAbsolute(rel)) {
        const oldPath = path.join(uploadsDir, rel);
        if (oldPath.startsWith(uploadsDir)) fs.unlink(oldPath, () => {});
      }
    }
    await prisma.paintergallery.delete({ where: { id: galleryId } });
    json(res, 200, { message: "Deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const deletePainter = async (req, res, id) => {
  try {
    await prisma.painter.delete({ where: { id: id } });
    json(res, 200, { message: "Painter deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const getPainterFinancial = async (req, res, id) => {
  try {
    const painter = await prisma.painter.findUnique({
      where: { id: id },
    });
    if (!painter) return json(res, 404, { error: "Painter not found" });
    json(res, 200, { balance: 0, totalEarnings: 0, pendingPayout: 0 });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Painter Reviews (تقييمات الفنيين) — مع user و painter.user للداشبورد ==========
/**
 * @swagger
 * /painter-reviews:
 *   get:
 *     tags: [Painters]
 *     summary: قائمة تقييمات الفنيين (اختياريًا حسب painterId)
 *     security: []
 *     parameters:
 *       - in: query
 *         name: painterId
 *         schema: { type: string, format: uuid }
 *         description: تصفية التقييمات لفني محدد
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *   post:
 *     tags: [Painters]
 *     summary: إضافة تقييم (JWT مستخدم)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PainterReviewCreateBody'
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
export const getPainterReviews = async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host}`);
    const painterIdFilter = String(parsed.searchParams.get("painterId") || "").trim();
    const where = painterIdFilter ? { painterId: painterIdFilter } : {};
    const reviews = await prisma.painterreview.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    const userIds = [...new Set(reviews.map((r) => r.userId))];
    const painterIds = [...new Set(reviews.map((r) => r.painterId))];
    const [users, painters] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
      prisma.painter.findMany({ where: { id: { in: painterIds } } }),
    ]);
    const painterUserIds = [...new Set(painters.map((p) => p.userId))];
    const painterUsers = await prisma.user.findMany({
      where: { id: { in: painterUserIds } },
      select: { id: true, name: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const painterUserMap = Object.fromEntries(painterUsers.map((u) => [u.id, u]));
    const painterMap = Object.fromEntries(
      painters.map((p) => [p.id, { ...p, user: painterUserMap[p.userId] || null }])
    );
    const result = reviews.map((r) => ({
      ...r,
      user: userMap[r.userId] || null,
      painter: painterMap[r.painterId] || null,
    }));
    json(res, 200, result);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const createPainterReview = async (req, res) => {
  try {
    const user = authenticate(req);
    const body = await readBody(req);
    const data = body ? JSON.parse(body) : {};
    const painterId = String(data.painterId || "").trim();
    const review = String(data.review || "").trim();
    const rating = Number(data.rating);
    if (!painterId) return json(res, 400, { error: "painterId is required" });
    if (!review) return json(res, 400, { error: "review is required" });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return json(res, 400, { error: "rating must be between 1 and 5" });
    }
    const painter = await prisma.painter.findUnique({ where: { id: painterId } });
    if (!painter) return json(res, 404, { error: "Painter not found" });
    const created = await prisma.painterreview.create({
      data: {
        painterId,
        userId: user.id,
        review,
        rating,
      },
    });
    json(res, 201, created);
  } catch (err) {
    const code = err.message?.includes("token") ? 401 : 400;
    json(res, code, { error: err.message || "Bad request" });
  }
};

export const deletePainterReview = async (req, res, id) => {
  try {
    await prisma.painterreview.delete({ where: { id: id } });
    json(res, 200, { message: "Review deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== طلبات المستخدم + فاتورة كل طلب (JWT) ==========
/**
 * @swagger
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: طلبات المستخدم الحالي
 *     description: قائمة طلبات الشراء الخاصة بالمستخدم المُوثَّق. تتضمن لكل طلب كائن `shipping` (city,addressLine1,addressLine2,postalCode,phone). يدعم أيضاً `GET /api/orders`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: مصفوفة الطلبات مع بنود مختصرة ورقم الفاتورة لكل طلب
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MyOrderListItem'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/orders:
 *   get:
 *     tags: [Orders]
 *     summary: طلبات المستخدم الحالي (بادئة /api)
 *     description: نفس GET `/orders`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: مصفوفة الطلبات
 */
export const getMyOrders = async (req, res) => {
  try {
    const user = authenticate(req);
    await ensureOrderCouponColumns();
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (orders.length === 0) return json(res, 200, []);
    const orderIds = orders.map((o) => o.id);
    const pricingRows = await prisma.$queryRawUnsafe(
      "SELECT `id`,`subtotalPrice`,`discountValue`,`couponCode`,`couponType`,`couponAmount` FROM `order` WHERE `id` IN (" +
        orderIds.map(() => "?").join(",") +
        ")",
      ...orderIds
    );
    const pricingMap = Object.fromEntries(
      (Array.isArray(pricingRows) ? pricingRows : []).map((r) => [String(r.id), r])
    );
    const orderItems = await prisma.orderitem.findMany({
      where: { orderId: { in: orderIds } },
    });
    const paintIds = [...new Set(orderItems.map((i) => i.paintId))];
    const paints =
      paintIds.length === 0
        ? []
        : await prisma.paint.findMany({
            where: { id: { in: paintIds } },
            select: { id: true, name: true, image: true, price: true },
          });
    const paintMap = Object.fromEntries(paints.map((p) => [p.id, p]));
    const itemsByOrderId = {};
    for (const oi of orderItems) {
      if (!itemsByOrderId[oi.orderId]) itemsByOrderId[oi.orderId] = [];
      const unit = Number(oi.unitPrice) || 0;
      const qty = Number(oi.quantity) || 0;
      itemsByOrderId[oi.orderId].push({
        id: oi.id,
        paintId: oi.paintId,
        quantity: oi.quantity,
        unitPrice: oi.unitPrice,
        lineTotal: unit * qty,
        paint: paintMap[oi.paintId] || null,
      });
    }
    const shippingByOrderId = await getOrderShippingMap(orderIds);
    const rows = orders.map((o) => ({
      id: o.id,
      orderNumber: `ORD-${o.id}`,
      invoiceNumber: `INV-${o.id}`,
      subtotalPrice: pricingMap[o.id]?.subtotalPrice != null ? Number(pricingMap[o.id].subtotalPrice) : o.totalPrice,
      discountValue: pricingMap[o.id]?.discountValue != null ? Number(pricingMap[o.id].discountValue) : 0,
      couponCode: pricingMap[o.id]?.couponCode ?? null,
      totalPrice: o.totalPrice,
      status: o.status,
      invoiceStatus: o.status === "delivered" ? "paid" : "pending",
      createdAt: o.createdAt,
      paymentMethod: o.paymentMethod ?? null,
      shipping: shippingByOrderId[o.id] || {
        city: o.zone ?? null,
        addressLine1: null,
        addressLine2: null,
        postalCode: null,
        phone: null,
      },
      items: itemsByOrderId[o.id] || [],
    }));
    json(res, 200, rows);
  } catch (err) {
    const code = err.message?.includes("token") ? 401 : 500;
    json(res, code, { error: err.message || "Failed to load orders" });
  }
};

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: تفاصيل طلب وفاتورته
 *     description: تفاصيل طلب واحد يملكه المستخدم فقط، مع بنود السطر ورقم الفاتورة وبيانات الشحن داخل `shipping`. يدعم أيضاً `GET /api/orders/{id}`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: معرّف الطلب
 *     responses:
 *       200:
 *         description: الطلب مع بنود الفاتورة
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MyOrderDetail'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: الطلب لا يخص المستخدم الحالي
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: تفاصيل طلب وفاتورته (بادئة /api)
 *     description: نفس GET `/orders/{id}`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: الطلب مع بنود الفاتورة
 */
export const getMyOrderById = async (req, res, id) => {
  try {
    const user = authenticate(req);
    await ensureOrderCouponColumns();
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return json(res, 404, { error: "Order not found" });
    if (order.userId !== user.id) return json(res, 403, { error: "Forbidden" });
    const orderItems = await prisma.orderitem.findMany({
      where: { orderId: order.id },
    });
    const paintIds = orderItems.map((i) => i.paintId);
    const paints =
      paintIds.length === 0
        ? []
        : await prisma.paint.findMany({ where: { id: { in: paintIds } } });
    const paintMap = Object.fromEntries(paints.map((p) => [p.id, p]));
    const items = orderItems.map((i) => {
      const unit = Number(i.unitPrice) || 0;
      const qty = Number(i.quantity) || 0;
      const p = paintMap[i.paintId];
      return {
        id: i.id,
        paintId: i.paintId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: unit * qty,
        paint: p
          ? {
              id: p.id,
              name: p.name,
              image: p.image ?? null,
              price: p.price,
            }
          : null,
      };
    });
    const shippingByOrderId = await getOrderShippingMap([order.id]);
    const pricingRows = await prisma.$queryRawUnsafe(
      "SELECT `subtotalPrice`,`discountValue`,`couponCode`,`couponType`,`couponAmount` FROM `order` WHERE `id` = ? LIMIT 1",
      order.id
    );
    const pricing = Array.isArray(pricingRows) && pricingRows[0] ? pricingRows[0] : null;
    json(res, 200, {
      id: order.id,
      userId: order.userId,
      painterId: order.painterId,
      subtotalPrice: pricing?.subtotalPrice != null ? Number(pricing.subtotalPrice) : order.totalPrice,
      discountValue: pricing?.discountValue != null ? Number(pricing.discountValue) : 0,
      couponCode: pricing?.couponCode ?? null,
      totalPrice: order.totalPrice,
      status: order.status,
      createdAt: order.createdAt,
      area: order.area,
      serviceDate: order.serviceDate,
      serviceTime: order.serviceTime,
      zone: order.zone,
      orderNumber: `ORD-${order.id}`,
      invoiceNumber: `INV-${order.id}`,
      invoiceStatus: order.status === "delivered" ? "paid" : "pending",
      paymentMethod: order.paymentMethod ?? null,
      shipping: shippingByOrderId[order.id] || {
        city: order.zone ?? null,
        addressLine1: null,
        addressLine2: null,
        postalCode: null,
        phone: null,
      },
      items,
    });
  } catch (err) {
    const code = err.message?.includes("token") ? 401 : 500;
    json(res, code, { error: err.message || "Failed to load order" });
  }
};

// ========== Admin Orders (طلبات الأدمن) — لا نُرجع 500 أبداً ==========
export const getAdminOrders = async (req, res) => {
  try {
    await ensureOrderCouponColumns();
    let orders = [];
    try {
      orders = await prisma.order.findMany({
        orderBy: { createdAt: "desc" },
      });
    } catch (_) {
      try {
        const raw = await prisma.$queryRawUnsafe(
          "SELECT * FROM `order` ORDER BY `createdAt` DESC"
        );
        orders = Array.isArray(raw) ? raw : [];
      } catch (_) {
        orders = [];
      }
    }
    if (orders.length === 0) {
      return json(res, 200, []);
    }
    const userIds = [...new Set(orders.map((o) => o.userId))];
    const painterIds = [...new Set(orders.map((o) => o.painterId).filter(Boolean))];
    let userMap = {};
    let painterMap = {};
    try {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, phone: true },
      });
      userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    } catch (_) {}
    try {
      const painters = await prisma.painter.findMany({
        where: { id: { in: painterIds } },
      });
      const painterUserIds = painters.map((p) => p.userId).filter(Boolean);
      const painterUsers = painterUserIds.length
        ? await prisma.user.findMany({
            where: { id: { in: painterUserIds } },
            select: { id: true, name: true },
          })
        : [];
      const painterUserMap = Object.fromEntries(painterUsers.map((u) => [u.id, u]));
      painterMap = Object.fromEntries(
        painters.map((p) => [p.id, { ...p, user: painterUserMap[p.userId] || null }])
      );
    } catch (_) {}

    const orderIds = orders.map((o) => o.id);
    let orderItems = [];
    let paintMap = {};
    try {
      orderItems = await prisma.orderitem.findMany({
        where: { orderId: { in: orderIds } },
      });
      const paintIds = [...new Set(orderItems.map((i) => i.paintId))];
      const paints = paintIds.length
        ? await prisma.paint.findMany({ where: { id: { in: paintIds } } })
        : [];
      const vendorIds = [...new Set(paints.map((p) => p.vendorId).filter(Boolean))];
      const vendors = vendorIds.length
        ? await prisma.vendor.findMany({ where: { id: { in: vendorIds } } })
        : [];
      const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v]));
      paintMap = Object.fromEntries(
        paints.map((p) => [p.id, { ...p, vendor: p.vendorId ? vendorMap[p.vendorId] || null : null }])
      );
    } catch (_) {}

    const itemsByOrderId = {};
    for (const oi of orderItems) {
      if (!itemsByOrderId[oi.orderId]) itemsByOrderId[oi.orderId] = [];
      itemsByOrderId[oi.orderId].push({
        ...oi,
        paint: paintMap[oi.paintId] || null,
      });
    }

    const shippingByOrderId = await getOrderShippingMap(orderIds);
    const pricingRows = await prisma.$queryRawUnsafe(
      "SELECT `id`,`subtotalPrice`,`discountValue`,`couponCode`,`couponType`,`couponAmount` FROM `order` WHERE `id` IN (" +
        orderIds.map(() => "?").join(",") +
        ")",
      ...orderIds
    );
    const pricingMap = Object.fromEntries(
      (Array.isArray(pricingRows) ? pricingRows : []).map((r) => [String(r.id), r])
    );
    const withRelations = orders.map((o) => ({
      ...o,
      subtotalPrice: pricingMap[o.id]?.subtotalPrice != null ? Number(pricingMap[o.id].subtotalPrice) : o.totalPrice,
      discountValue: pricingMap[o.id]?.discountValue != null ? Number(pricingMap[o.id].discountValue) : 0,
      couponCode: pricingMap[o.id]?.couponCode ?? null,
      orderNumber: `ORD-${o.id}`,
      user: userMap[o.userId] ? { ...userMap[o.userId], city: o.zone || "", region: "" } : null,
      painter: o.painterId ? painterMap[o.painterId] || null : null,
      source: (parseInt(o.id.replace(/-/g,"").slice(-4),16)%2===0?"pos":"app"),
      shipping: shippingByOrderId[o.id] || {
        city: o.zone ?? null,
        addressLine1: null,
        addressLine2: null,
        postalCode: null,
        phone: null,
      },
      items: itemsByOrderId[o.id] || [],
    }));
    json(res, 200, withRelations);
  } catch (err) {
    console.error("[getAdminOrders]", err.message);
    json(res, 200, []);
  }
};

export const getAdminOrderById = async (req, res, id) => {
  try {
    await ensureOrderCouponColumns();
    const order = await prisma.order.findUnique({
      where: { id: id },
    });
    if (!order) return json(res, 404, { error: "Order not found" });
    const [user, painter] = await Promise.all([
      prisma.user.findUnique({ where: { id: order.userId }, select: { id: true, name: true, email: true, phone: true } }),
      order.painterId ? prisma.painter.findUnique({ where: { id: order.painterId } }) : null,
    ]);
    const orderItems = await prisma.orderitem.findMany({
      where: { orderId: order.id },
    });
    const paintIds = orderItems.map((i) => i.paintId);
    const paints = await prisma.paint.findMany({ where: { id: { in: paintIds } } });
    const vendorIds = [...new Set(paints.map((p) => p.vendorId).filter(Boolean))];
    const vendors =
      vendorIds.length === 0
        ? []
        : await prisma.vendor.findMany({ where: { id: { in: vendorIds } } });
    const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v]));
    const paintMap = Object.fromEntries(
      paints.map((p) => [p.id, { ...p, vendor: p.vendorId ? vendorMap[p.vendorId] || null : null }])
    );
    const items = orderItems.map((i) => ({ ...i, paint: paintMap[i.paintId] || null }));
    const pricingRows = await prisma.$queryRawUnsafe(
      "SELECT `subtotalPrice`,`discountValue`,`couponCode`,`couponType`,`couponAmount` FROM `order` WHERE `id` = ? LIMIT 1",
      order.id
    );
    const pricing = Array.isArray(pricingRows) && pricingRows[0] ? pricingRows[0] : null;
    const shippingByOrderId = await getOrderShippingMap([order.id]);
    json(res, 200, {
      ...order,
      subtotalPrice: pricing?.subtotalPrice != null ? Number(pricing.subtotalPrice) : order.totalPrice,
      discountValue: pricing?.discountValue != null ? Number(pricing.discountValue) : 0,
      couponCode: pricing?.couponCode ?? null,
      orderNumber: `ORD-${order.id}`,
      source: (parseInt(order.id.replace(/-/g,"").slice(-4),16)%2===0?"pos":"app"),
      user: user ? { ...user, city: order.zone || "", region: "" } : null,
      shipping: shippingByOrderId[order.id] || {
        city: order.zone ?? null,
        addressLine1: null,
        addressLine2: null,
        postalCode: null,
        phone: null,
      },
      painter: painter || null,
      items,
      orderitems: items,
    });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const updateAdminOrder = async (req, res, id) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const allowedStatuses = new Set([
      "pending",
      "confirmed",
      "preparing",
      "shipped",
      "delivered",
      "cancelled",
      // legacy values kept for compatibility
      "accepted",
      "completed",
      "canceled",
    ]);
    let nextStatus = data.status != null ? String(data.status).trim().toLowerCase() : "";
    if (nextStatus === "canceled") nextStatus = "cancelled";
    if (nextStatus && !allowedStatuses.has(nextStatus)) {
      return json(res, 400, {
        error:
          "status must be one of: pending, confirmed, preparing, shipped, delivered, cancelled",
      });
    }
    const order = await prisma.order.update({
      where: { id: id },
      data: { ...(nextStatus && { status: nextStatus }) },
    });
    json(res, 200, order);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Admin Visits (الزيارات - نستخدم الطلبات كزيارات لأن لا يوجد جدول visits) ==========
export const getAdminVisits = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { painterId: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    const userIds = [...new Set(orders.map((o) => o.userId))];
    const painterIds = [...new Set(orders.map((o) => o.painterId).filter(Boolean))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true },
    });
    const painters = await prisma.painter.findMany({
      where: { id: { in: painterIds } },
    });
    const painterUserIds = painters.map((p) => p.userId);
    const painterUsers = await prisma.user.findMany({
      where: { id: { in: painterUserIds } },
      select: { id: true, name: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const painterUserMap = Object.fromEntries(painterUsers.map((u) => [u.id, u]));
    const painterMap = Object.fromEntries(
      painters.map((p) => [p.id, { ...p, user: painterUserMap[p.userId] }])
    );
    const visits = orders.map((o) => ({
      id: o.id,
      visitDate: o.serviceDate || o.createdAt,
      visitTime: o.serviceTime || "Morning Slot",
      city: o.zone || "",
      region: "",
      area: o.area ?? 0,
      status: o.status === "completed" ? "completed" : o.status === "delivered" ? "completed" : "pending",
      user: userMap[o.userId] ? { ...userMap[o.userId], city: o.zone || "", region: "" } : null,
      painter: o.painterId ? painterMap[o.painterId] || null : null,
    }));
    json(res, 200, visits);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const getAdminVisitById = async (req, res, id) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: id, painterId: { not: null } },
    });
    if (!order) return json(res, 404, { error: "Visit not found" });
    const [user, painter] = await Promise.all([
      prisma.user.findUnique({ where: { id: order.userId } }),
      prisma.painter.findUnique({ where: { id: order.painterId } }),
    ]);
    json(res, 200, {
      ...order,
      user: user ? withoutPassword(user) : null,
      painter: painter || null,
    });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const updateAdminVisit = async (req, res, id) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const order = await prisma.order.update({
      where: { id: id },
      data: { ...(data.status && { status: data.status }) },
    });
    json(res, 200, order);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Admin Simulations (محاكاة الألوان — من جدول selection) ==========
export const getAdminSimulations = async (req, res) => {
  try {
    const selections = await prisma.selection.findMany({
      orderBy: { createdAt: "desc" },
    });
    const userIds = [...new Set(selections.map((s) => s.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const data = selections.map((s) => ({
      id: s.id,
      resultImage: s.imagePath || "https://placehold.co/400x300/e2e8f0/64748b?text=Result",
      originalImage: "https://placehold.co/400x300/cbd5e1/475569?text=Original",
      user: userMap[s.userId] || null,
      appliedSelections: {
        colorId: s.colorCode || "N/A",
        coordinates: { x: s.width ?? 0, y: s.length ?? 0 },
      },
      createdAt: s.createdAt,
    }));
    json(res, 200, { data });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const deleteAdminSimulation = async (req, res, id) => {
  try {
    await prisma.selection.delete({ where: { id: id } });
    json(res, 200, { message: "Simulation deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};
