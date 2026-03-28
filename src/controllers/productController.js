import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import fs from "fs";
import { calculateRecommendedQuantity } from "../utils/calc.js";
import {
  getUnitPriceForBuyer,
  parseStoredUnitPrice,
  getWholesaleEligibilityByUserIds,
  classifySalePriceType,
} from "../utils/buyerPricing.js";

const prisma = new PrismaClient();
let paintI18nColsChecked = false;

async function ensurePaintI18nColumns() {
  if (paintI18nColsChecked) return;
  try {
    const cols = await prisma.$queryRawUnsafe(
      "SELECT `COLUMN_NAME` AS `name` FROM `information_schema`.`COLUMNS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'paint'"
    );
    const names = new Set((Array.isArray(cols) ? cols : []).map((c) => String(c.name || c.COLUMN_NAME || "")));
    const alters = [];
    if (!names.has("nameAr")) alters.push("ADD COLUMN `nameAr` VARCHAR(191) NULL");
    if (!names.has("nameEn")) alters.push("ADD COLUMN `nameEn` VARCHAR(191) NULL");
    if (!names.has("descriptionAr")) alters.push("ADD COLUMN `descriptionAr` TEXT NULL");
    if (!names.has("descriptionEn")) alters.push("ADD COLUMN `descriptionEn` TEXT NULL");
    if (alters.length > 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`paint\` ${alters.join(", ")}`);
    }
  } catch (_) {
    // Keep backward compatibility with older DBs.
  } finally {
    paintI18nColsChecked = true;
  }
}

function getPreferredLang(req) {
  return String(req?.headers?.["accept-language"] || "ar").toLowerCase().startsWith("en") ? "en" : "ar";
}

function localizePaintRow(row, preferredLang = "ar") {
  const nameAr = pick(row, "nameAr") ?? pick(row, "name") ?? null;
  const nameEn = pick(row, "nameEn") ?? pick(row, "name") ?? null;
  const descriptionAr = pick(row, "descriptionAr") ?? pick(row, "description") ?? null;
  const descriptionEn = pick(row, "descriptionEn") ?? pick(row, "description") ?? null;
  const localizedName = preferredLang === "en" ? (nameEn ?? nameAr ?? pick(row, "name")) : (nameAr ?? nameEn ?? pick(row, "name"));
  const localizedDesc =
    preferredLang === "en" ? (descriptionEn ?? descriptionAr ?? pick(row, "description")) : (descriptionAr ?? descriptionEn ?? pick(row, "description"));
  return {
    ...row,
    name: localizedName != null ? String(localizedName) : "",
    description: localizedDesc != null ? String(localizedDesc) : null,
    nameAr: nameAr != null ? String(nameAr) : null,
    nameEn: nameEn != null ? String(nameEn) : null,
    descriptionAr: descriptionAr != null ? String(descriptionAr) : null,
    descriptionEn: descriptionEn != null ? String(descriptionEn) : null,
  };
}

/**
 * @swagger
 * /paints:
 *   get:
 *     tags: [Products]
 *     summary: قائمة جميع المنتجات (الدهانات)
 *     description: يعيد صفوف من جدول paint مع إضافة `minStockLevel` الافتراضي عند الحاجة. يُستخدم أيضاً GET /paint كبديل.
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة منتجات
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PaintListItem'
 * /paint:
 *   get:
 *     tags: [Products]
 *     summary: قائمة المنتجات (بديل لـ /paints)
 *     security: []
 *     responses:
 *       200:
 *         description: نفس استجابة GET /paints
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PaintListItem'
 * /api/paints:
 *   get:
 *     tags: [Products]
 *     summary: قائمة جميع المنتجات (بادئة /api)
 *     description: نفس GET `/paints`.
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة منتجات
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PaintListItem'
 * /api/paint:
 *   get:
 *     tags: [Products]
 *     summary: قائمة المنتجات (بادئة /api)
 *     description: نفس GET `/paint`.
 *     security: []
 *     responses:
 *       200:
 *         description: مصفوفة منتجات
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PaintListItem'
 */
// ===== Get All Paints — لا نُرجع 500 أبداً =====
export const getAllPaints = async (req, res) => {
  let rows = [];
  try {
    const preferredLang = getPreferredLang(req);
    const q = String.fromCharCode(96);
    try {
      rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${q}paint${q}`);
    } catch (e) {
      console.warn("[getAllPaints]", e.message);
      rows = [];
    }
    const paints = (Array.isArray(rows) ? rows : []).map((p) => localizePaintRow(p, preferredLang));
    const withMinStock = paints.map((p) => ({
      ...p,
      minStockLevel: p.minStockLevel ?? 5,
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(withMinStock));
  } catch (err) {
    console.error("[getAllPaints]", err.message);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([]));
  }
};

/**
 * @swagger
 * /paint:
 *   post:
 *     tags: [Products]
 *     summary: إنشاء منتج (دهان)
 *     description: يتطلب صلاحية admin فقط (Bearer JWT).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaintCreateBody'
 *     responses:
 *       201:
 *         description: تم الإنشاء
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaintCreateResponse'
 *       400:
 *         description: خطأ تحقق أو قاعدة بيانات
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: غير مصرح
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/paint:
 *   post:
 *     tags: [Products]
 *     summary: إنشاء منتج (بادئة /api)
 *     description: نفس POST `/paint`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaintCreateBody'
 *     responses:
 *       201:
 *         description: تم الإنشاء
 */
// ===== Create Paint (raw SQL — الجدول يستخدم categoryId و vendorId فقط، بدون علاقات connect) =====
export const createPaint = async (req, res) => {
  let body = "";

  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      const raw = JSON.parse(body);
      await ensurePaintI18nColumns();
      const nameAr = String(raw.name_ar ?? raw.nameAr ?? raw.name ?? "").trim();
      const nameEn = String(raw.name_en ?? raw.nameEn ?? raw.name ?? "").trim();
      const descriptionArRaw = raw.description_ar ?? raw.descriptionAr ?? raw.description ?? null;
      const descriptionEnRaw = raw.description_en ?? raw.descriptionEn ?? raw.description ?? null;
      const descriptionAr = descriptionArRaw != null && String(descriptionArRaw).trim() !== "" ? String(descriptionArRaw) : null;
      const descriptionEn = descriptionEnRaw != null && String(descriptionEnRaw).trim() !== "" ? String(descriptionEnRaw) : null;
      const name = nameAr || nameEn;
      const type = raw.type != null ? String(raw.type).trim() || "paint" : "paint";
      const description = descriptionAr || descriptionEn || null;
      const price = Number(raw.price);
      const unit = String(raw.unit || "kg").toLowerCase();
      const coverage = Number(raw.coverage);
      const coatHours = Number(raw.coatHours);
      let dryDays = Number(raw.dryDays);
      if (!Number.isFinite(dryDays) || dryDays < 0) dryDays = 0;
      const finish = String(raw.finish || "matte").toLowerCase().replace(/\s+/g, "_");
      const usage = String(raw.usage || "indoor").toLowerCase();
      const base = String(raw.base || "water").toLowerCase();
      const stock = Math.max(0, Number(raw.stock));
      const categoryId = raw.categoryId != null ? String(raw.categoryId).trim() : "";
      // منتجات المنصة فقط: لا نربط المنتج بأي vendor.
      const vendorId = null;

      if (!nameAr || !nameEn || !Number.isFinite(price)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "الاسم بالعربي والإنجليزي والسعر حقول مطلوبة" }));
      }

      const safeEnum = (v, opts) => (opts.includes(String(v).toLowerCase()) ? String(v).toLowerCase() : opts[0]);
      const finalBase = safeEnum(base, ["water", "oil", "wood"]);
      const finalFinish = safeEnum(finish, ["matte", "semi_gloss", "gloss"]);
      const finalUnit = safeEnum(unit, ["liter", "kg"]);
      const finalUsage = safeEnum(usage, ["indoor", "outdoor", "both"]);

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      const image = raw.image != null && raw.image !== "" ? String(raw.image) : null;
      const offerId = raw.offerId != null && Number(raw.offerId) > 0 ? Number(raw.offerId) : null;
      const weightKg = raw.weightKg != null && Number(raw.weightKg) >= 0 ? Number(raw.weightKg) : 1;
      const wholesalePrice = raw.wholesalePrice != null && Number.isFinite(Number(raw.wholesalePrice)) && Number(raw.wholesalePrice) >= 0
        ? Number(raw.wholesalePrice)
        : null;
      const sku = raw.sku != null && String(raw.sku).trim() !== "" ? String(raw.sku).trim() : null;

      const q = String.fromCharCode(96);
      // نولّد UUID صريحاً لأن MySQL قد لا يدعم DEFAULT(UUID()) في بعض الإصدارات
      try {
        const sql = `INSERT INTO ${q}paint${q} (${q}id${q}, ${q}name${q}, ${q}nameAr${q}, ${q}nameEn${q}, ${q}type${q}, ${q}description${q}, ${q}descriptionAr${q}, ${q}descriptionEn${q}, ${q}price${q}, ${q}wholesalePrice${q}, ${q}sku${q}, ${q}unit${q}, ${q}coverage${q}, ${q}coatHours${q}, ${q}dryDays${q}, ${q}finish${q}, ${q}usage${q}, ${q}base${q}, ${q}stock${q}, ${q}inStock${q}, ${q}categoryId${q}, ${q}vendorId${q}, ${q}image${q}, ${q}isActive${q}, ${q}weightKg${q}, ${q}offerId${q}, ${q}updatedAt${q}) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await prisma.$executeRawUnsafe(
          sql,
          name,
          nameAr,
          nameEn,
          type,
          description,
          descriptionAr,
          descriptionEn,
          price,
          wholesalePrice,
          sku,
          finalUnit,
          coverage,
          coatHours,
          dryDays,
          finalFinish,
          finalUsage,
          finalBase,
          stock,
          stock > 0 ? 1 : 0,
          categoryId,
          vendorId,
          image,
          1,
          weightKg,
          offerId,
          now
        );
      } catch (_) {
        const sql = `INSERT INTO ${q}paint${q} (${q}id${q}, ${q}name${q}, ${q}type${q}, ${q}description${q}, ${q}price${q}, ${q}wholesalePrice${q}, ${q}sku${q}, ${q}unit${q}, ${q}coverage${q}, ${q}coatHours${q}, ${q}dryDays${q}, ${q}finish${q}, ${q}usage${q}, ${q}base${q}, ${q}stock${q}, ${q}inStock${q}, ${q}categoryId${q}, ${q}vendorId${q}, ${q}image${q}, ${q}isActive${q}, ${q}weightKg${q}, ${q}offerId${q}, ${q}updatedAt${q}) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await prisma.$executeRawUnsafe(
          sql,
          name,
          type,
          description,
          price,
          wholesalePrice,
          sku,
          finalUnit,
          coverage,
          coatHours,
          dryDays,
          finalFinish,
          finalUsage,
          finalBase,
          stock,
          stock > 0 ? 1 : 0,
          categoryId,
          vendorId,
          image,
          1,
          weightKg,
          offerId,
          now
        );
      }

      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${q}paint${q} ORDER BY id DESC LIMIT 1`);
      const paint = Array.isArray(rows) && rows.length > 0 ? localizePaintRow(rows[0], getPreferredLang(req)) : null;
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Paint created", paint: paint || { name, type, categoryId } }));
    } catch (err) {
      console.error("[createPaint]", err.message);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

// استخراج قيمة آمنة من الصف (BigInt -> Number، Date -> ISO string)
function pick(row, key) {
  if (row == null) return undefined;
  const v = row[key] ?? row[key.toLowerCase?.()] ?? row[key.toUpperCase?.()];
  if (v === null || v === undefined) return v;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return v.toISOString();
  return v;
}

/**
 * @swagger
 * /paint/{id}:
 *   get:
 *     tags: [Products]
 *     summary: تفاصيل منتج بالمعرّف
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: معرّف المنتج (UUID)
 *     responses:
 *       200:
 *         description: بيانات المنتج
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaintDetail'
 *       400:
 *         description: معرّف غير صالح
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: غير موجود
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   put:
 *     tags: [Products]
 *     summary: تحديث منتج
 *     description: يتطلب صلاحية admin فقط (Bearer JWT).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaintUpdateBody'
 *     responses:
 *       200:
 *         description: تم التحديث
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaintUpdateResponse'
 *       400:
 *         description: لا توجد حقول أو خطأ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         description: غير مصرح
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   delete:
 *     tags: [Products]
 *     summary: حذف منتج
 *     description: يتطلب صلاحية admin فقط (Bearer JWT).
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
 *         description: تم الحذف
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaintDeleted'
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/paint/{id}:
 *   get:
 *     tags: [Products]
 *     summary: تفاصيل منتج (بادئة /api)
 *     description: نفس GET `/paint/{id}`.
 *     security: []
 *     responses:
 *       200:
 *         description: بيانات المنتج
 *   put:
 *     tags: [Products]
 *     summary: تحديث منتج (بادئة /api)
 *     description: نفس PUT `/paint/{id}` (admin only).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم التحديث
 *   delete:
 *     tags: [Products]
 *     summary: حذف منتج (بادئة /api)
 *     description: نفس DELETE `/paint/{id}` (admin only).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: تم الحذف
 */
// Read a Single Paint (GET /paint/:id) — لا نُرجع 500 أبداً
export const getPaintById = async (req, res, id) => {
  const send404 = () => {
    if (res.headersSent) return;
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Paint not found" }));
  };
  const send200 = (data) => {
    if (res.headersSent) return;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };

  try {
    const paintId = id != null ? String(id).trim() : "";
    if (!paintId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid paint id" }));
    }

    let row = null;
    try {
      const rows = await prisma.$queryRawUnsafe(
        "SELECT * FROM `paint` WHERE `id` = ? LIMIT 1",
        paintId
      );
      row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    } catch (e) {
      console.warn("[getPaintById] query", e?.message);
      return send404();
    }

    if (!row) return send404();

    const localized = localizePaintRow(row, getPreferredLang(req));
    const paint = {
      id: String(pick(row, "id") ?? ""),
      name: String(localized.name ?? pick(row, "name") ?? ""),
      price: Number(pick(row, "price")) || 0,
      description: localized.description != null ? String(localized.description) : null,
      nameAr: localized.nameAr,
      nameEn: localized.nameEn,
      descriptionAr: localized.descriptionAr,
      descriptionEn: localized.descriptionEn,
      categoryId: Number(pick(row, "categoryId")) || 0,
      base: String(pick(row, "base") ?? "water"),
      coatHours: Number(pick(row, "coatHours")) || 0,
      coverage: Number(pick(row, "coverage")) || 0,
      dryDays: Number(pick(row, "dryDays")) || 0,
      finish: String(pick(row, "finish") ?? "matte"),
      unit: String(pick(row, "unit") ?? "kg"),
      usage: String(pick(row, "usage") ?? "interior"),
      image: pick(row, "image") != null ? String(pick(row, "image")) : null,
      stock: Number(pick(row, "stock")) || 0,
      inStock: Boolean(pick(row, "inStock") ?? true),
      isActive: Boolean(pick(row, "isActive") ?? true),
      weightKg: (() => {
        const w = pick(row, "weightKg") ?? pick(row, "weightkg");
        const n = Number(w);
        return Number.isFinite(n) ? n : 1;
      })(),
      offerId: (() => {
        const o = pick(row, "offerId");
        return o == null ? null : Number(o);
      })(),
      type: String(pick(row, "type") ?? "paint"),
      sku: pick(row, "sku") != null ? String(pick(row, "sku")) : null,
      wholesalePrice: (() => {
        const wp = pick(row, "wholesalePrice");
        const n = Number(wp);
        return wp != null && Number.isFinite(n) ? n : null;
      })(),
      createdAt: (() => {
        const d = pick(row, "createdAt");
        return d instanceof Date ? d.toISOString() : (d != null ? String(d) : null);
      })(),
      updatedAt: (() => {
        const d = pick(row, "updatedAt");
        return d instanceof Date ? d.toISOString() : (d != null ? String(d) : null);
      })(),
    };

    try {
      const stockRow = await prisma.paint.findUnique({
        where: { id: paintId },
        select: { stock: true, inStock: true },
      });
      if (stockRow) {
        paint.stock = Math.max(0, Number(stockRow.stock) || 0);
        paint.inStock = Boolean(stockRow.inStock);
      }
    } catch (e) {
      console.warn("[getPaintById] stock snapshot", e?.message);
    }

    // منتجات المنصة فقط: بدون علاقة vendor.
    const vendorRel = null;

    let orderItems = [];
    let analytics = { totalSoldQuantity: 0 };
    try {
      const items = await prisma.orderitem.findMany({
        where: { paintId: paintId },
      });
      if (items.length) {
        const orderIds = [...new Set(items.map((i) => i.orderId))];
        const orders = await prisma.order.findMany({ where: { id: { in: orderIds } } });
        const userIds = [...new Set(orders.map((o) => o.userId))];
        const users = userIds.length
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, role: true },
            })
          : [];
        const orderMap = Object.fromEntries(orders.map((o) => [o.id, o]));
        const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
        const wholesaleMap =
          users.length > 0 ? await getWholesaleEligibilityByUserIds(users) : {};
        const retailRef = Number(paint.price) || 0;
        const wholesaleRef = paint.wholesalePrice;
        const sorted = [...items].sort((a, b) => {
          const ta = orderMap[a.orderId]?.createdAt
            ? new Date(orderMap[a.orderId].createdAt).getTime()
            : 0;
          const tb = orderMap[b.orderId]?.createdAt
            ? new Date(orderMap[b.orderId].createdAt).getTime()
            : 0;
          return tb - ta;
        });
        const MOVEMENTS_LIMIT = 10;
        let totalSold = 0;
        const allRows = sorted.map((oi) => {
          const ord = orderMap[oi.orderId];
          const usr = ord ? userMap[ord.userId] : null;
          const qty = Number(oi.quantity) || 0;
          totalSold += qty;
          const stored = parseStoredUnitPrice(oi.unitPrice);
          const canW = ord?.userId ? Boolean(wholesaleMap[ord.userId]) : false;
          const unit =
            stored != null
              ? stored
              : getUnitPriceForBuyer(usr?.role ?? "user", paint, canW);
          const totalPrice = Math.round(unit * qty * 100) / 100;
          const salePriceType = classifySalePriceType(unit, retailRef, wholesaleRef);
          return {
            id: oi.id,
            orderId: oi.orderId,
            paintId: oi.paintId,
            quantity: qty,
            unitPrice: unit,
            storedUnitPrice: stored,
            totalPrice,
            salePriceType,
            User: usr ? { name: usr.name } : null,
          };
        });
        orderItems = allRows.slice(0, MOVEMENTS_LIMIT);
        analytics = {
          totalSoldQuantity: totalSold,
          orderMovementsTotal: allRows.length,
          orderMovementsShown: orderItems.length,
          orderMovementsLimit: MOVEMENTS_LIMIT,
        };
      }
    } catch (e) {
      console.warn("[getPaintById] orderItems", e?.message);
    }

    return send200({
      ...paint,
      vendor: vendorRel
        ? {
            id: vendorRel.id,
            shopName: vendorRel.shopName,
            city: vendorRel.city,
            address: vendorRel.address,
            region: vendorRel.region,
          }
        : null,
      orderItems,
      analytics,
    });
  } catch (err) {
    console.error("[getPaintById]", err?.message);
    send404();
  }
};

const q = () => String.fromCharCode(96);
const safeEnum = (v, opts) => (opts.includes(String(v).toLowerCase()) ? String(v).toLowerCase() : opts[0]);

// Update Paint (PUT /paint/:id) — raw SQL لتجنب 400 من Prisma
export const updatePaint = async (req, res, id) => {
  let body = "";

  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      const raw = JSON.parse(body);
      await ensurePaintI18nColumns();
      const b = q();
      const sets = [];
      const values = [];

      const push = (col, val) => {
        sets.push(`${b}${col}${b} = ?`);
        values.push(val);
      };

      if (raw.name !== undefined && String(raw.name).trim()) push("name", String(raw.name).trim());
      if (raw.name_ar !== undefined || raw.nameAr !== undefined) {
        const val = raw.name_ar ?? raw.nameAr;
        if (String(val ?? "").trim()) push("nameAr", String(val).trim());
      }
      if (raw.name_en !== undefined || raw.nameEn !== undefined) {
        const val = raw.name_en ?? raw.nameEn;
        if (String(val ?? "").trim()) push("nameEn", String(val).trim());
      }
      if (raw.price !== undefined && Number.isFinite(Number(raw.price))) push("price", Number(raw.price));
      if (raw.description !== undefined) push("description", raw.description != null ? String(raw.description) : null);
      if (raw.description_ar !== undefined || raw.descriptionAr !== undefined) {
        const val = raw.description_ar ?? raw.descriptionAr;
        push("descriptionAr", val != null ? String(val) : null);
      }
      if (raw.description_en !== undefined || raw.descriptionEn !== undefined) {
        const val = raw.description_en ?? raw.descriptionEn;
        push("descriptionEn", val != null ? String(val) : null);
      }
      if (raw.categoryId !== undefined && raw.categoryId !== null && String(raw.categoryId).trim()) push("categoryId", String(raw.categoryId).trim());
      // تجاهل أي vendorId قادم من الواجهة (منتجات منصة فقط).
      if (raw.vendorId !== undefined) {
        push("vendorId", null);
      }
      if (raw.base !== undefined) push("base", safeEnum(raw.base, ["water", "oil", "wood"]));
      if (raw.coatHours !== undefined) push("coatHours", Math.max(0, Number(raw.coatHours) || 0));
      if (raw.coverage !== undefined && Number.isFinite(Number(raw.coverage))) push("coverage", Number(raw.coverage));
      if (raw.dryDays !== undefined) push("dryDays", Math.max(0, Number(raw.dryDays) || 0));
      if (raw.finish !== undefined) push("finish", safeEnum(String(raw.finish).replace(/\s+/g, "_"), ["matte", "semi_gloss", "gloss"]));
      if (raw.unit !== undefined) push("unit", safeEnum(raw.unit, ["liter", "kg"]));
      if (raw.usage !== undefined) push("usage", safeEnum(raw.usage, ["indoor", "outdoor", "both"]));
      if (raw.image !== undefined) push("image", raw.image != null ? String(raw.image) : null);
      if (raw.stock !== undefined) {
        const st = Math.max(0, Number(raw.stock) || 0);
        push("stock", st);
        push("inStock", st > 0 ? 1 : 0);
      }
      if (raw.isActive !== undefined) push("isActive", raw.isActive ? 1 : 0);
      if (raw.offerId !== undefined) {
        const n = Number(raw.offerId);
        push("offerId", Number.isFinite(n) && n > 0 ? n : null);
      }
      if (raw.type !== undefined) push("type", String(raw.type).trim() || "paint");
      if (raw.weightKg !== undefined) {
        const w = Number(raw.weightKg);
        push("weightKg", Number.isFinite(w) && w >= 0 ? w : 1);
      }
      if (raw.wholesalePrice !== undefined) {
        const wp = Number(raw.wholesalePrice);
        push("wholesalePrice", raw.wholesalePrice === null || !Number.isFinite(wp) ? null : wp);
      }
      if (raw.sku !== undefined) {
        push("sku", raw.sku != null && String(raw.sku).trim() !== "" ? String(raw.sku).trim() : null);
      }

      if (sets.length === 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "لا توجد حقول صالحة للتحديث" }));
      }

      push("updatedAt", new Date().toISOString().slice(0, 19).replace("T", " "));

      const sql = `UPDATE ${b}paint${b} SET ${sets.join(", ")} WHERE ${b}id${b} = ?`;
      values.push(id);
      await prisma.$executeRawUnsafe(sql, ...values);

      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${b}paint${b} WHERE ${b}id${b} = ? LIMIT 1`, id);
      const paint = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (paint && (paint.weightKg == null || Number.isNaN(Number(paint.weightKg)))) paint.weightKg = 1;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Paint updated", paint: paint || { id: id } }));
    } catch (err) {
      console.error("[updatePaint]", err.message);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

// Delete Paint (DELETE /paint/:id)
export const deletePaint = async (req, res, id) => {
  try {
    await prisma.paint.delete({
      where: { id: id },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Paint deleted" }));
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
/**
 * @swagger
 * /paint/export:
 *   get:
 *     tags: [Products]
 *     summary: تصدير جميع المنتجات (Excel)
 *     security: []
 *     responses:
 *       200:
 *         description: ملف xlsx
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
export async function exportPaintsToExcel(res) {
  try {
    const paints = await prisma.paint.findMany();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Paints");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Name", key: "name", width: 20 },
      { header: "Type", key: "type", width: 15 },
      { header: "Price", key: "price", width: 10 },
      { header: "Stock", key: "stock", width: 10 },
      { header: "In Stock", key: "inStock", width: 10 },
    ];

    paints.forEach((paint) =>
      worksheet.addRow({
        id: paint.id,
        name: paint.name,
        type: paint.type,
        price: paint.price,
        stock: paint.stock,
        inStock: paint.inStock ? "Yes" : "No",
      }),
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", "attachment; filename=paints.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: err.message }));
  }
}

// تصدير Excel للمنتجات ذات المخزون القليل أو المنتهي فقط
const DEFAULT_MIN_STOCK = 5;

/**
 * @swagger
 * /paint/export-low-stock:
 *   get:
 *     tags: [Products]
 *     summary: تصدير المنتجات ذات المخزون المنخفض أو منتهي (Excel)
 *     security: []
 *     responses:
 *       200:
 *         description: ملف xlsx
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
export async function exportLowStockPaintsToExcel(res) {
  try {
    const q = String.fromCharCode(96);
    let rows = [];
    try {
      rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${q}paint${q}`);
    } catch (e) {
      console.warn("[exportLowStockPaintsToExcel]", e.message);
    }
    const allPaints = Array.isArray(rows) ? rows : [];
    const withMin = allPaints.map((p) => ({
      ...p,
      minStockLevel: p.minStockLevel != null ? Number(p.minStockLevel) : DEFAULT_MIN_STOCK,
      stock: Number(p.stock) || 0,
    }));
    const lowOrOut = withMin.filter(
      (p) => p.stock === 0 || p.stock <= p.minStockLevel
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Low Stock Products");

    worksheet.columns = [
      { header: "ID", key: "id", width: 8 },
      { header: "Name", key: "name", width: 28 },
      { header: "Type", key: "type", width: 12 },
      { header: "Price", key: "price", width: 10 },
      { header: "Stock", key: "stock", width: 10 },
      { header: "Min Level", key: "minStockLevel", width: 10 },
      { header: "Status (AR)", key: "statusAr", width: 14 },
      { header: "In Stock", key: "inStock", width: 10 },
    ];

    lowOrOut.forEach((paint) => {
      const statusAr = paint.stock === 0 ? "منتهي" : "قليل";
      worksheet.addRow({
        id: paint.id,
        name: paint.name,
        type: paint.type,
        price: paint.price,
        stock: paint.stock,
        minStockLevel: paint.minStockLevel,
        statusAr,
        inStock: paint.inStock ? "Yes" : "No",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=low_stock_products.xlsx"
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[exportLowStockPaintsToExcel]", err.message);
    res.statusCode = 500;
    res.end(JSON.stringify({ message: err.message }));
  }
}

// ===== Import =====

/**
 * @swagger
 * /paint/import:
 *   post:
 *     tags: [Products]
 *     summary: استيراد منتجات من Excel
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: ملف xlsx (الصف الأول رؤوس أعمدة)
 *     responses:
 *       200:
 *         description: نجاح الاستيراد
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 */
export async function importPaintsFromExcel(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const worksheet = workbook.getWorksheet(1);
    const paints = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      paints.push({
        name: row.getCell(2).value,
        type: row.getCell(3).value,
        price: Number(row.getCell(4).value),
        stock: Number(row.getCell(5).value),
        inStock: Number(row.getCell(5).value) > 0,
      });
    });

    await prisma.paint.createMany({ data: paints });

    fs.unlinkSync(req.file.path);

    res.end(
      JSON.stringify({
        message: "Paints Imported Successfully",
        count: paints.length,
      }),
    );
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: err.message }));
  }
}

// ===== Services: حاسبة الطلاء — عدد العلب (POST /services/calculate) =====
// المعادلة: مساحة (m²) ÷ معدل التغطية (m²/kg) = kg مطلوب → عدد العلب = ceil(kg / وزن العلبة kg)
export const handleServicesCalculate = async (req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      const length = Number(data.length) || 0;
      const width = Number(data.width) || 0;
      const height = Number(data.height) || 0;
      let area = Number(data.area ?? data.totalArea ?? data.total_area) || 0;
      let wallArea = null;
      let areaWithCeilingAndFloor = null;
      if (length && width) {
        wallArea = height > 0 ? 2 * height * (length + width) : 0;
        const ceilingArea = length * width;
        const floorArea = length * width;
        areaWithCeilingAndFloor = wallArea + ceilingArea + floorArea;
        if (!area || area <= 0) area = areaWithCeilingAndFloor;
      }
      if (!area || area <= 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid area or dimensions" }));
      }

      let paint = { name: null, coverage: 10, weightKg: 1, unit: "kg" };
      const paintId = data.paintId != null ? Number(data.paintId) : null;
      if (paintId && Number.isFinite(paintId)) {
        try {
          const rows = await prisma.$queryRawUnsafe(
            "SELECT `name`, `coverage`, `weightKg`, `weightkg`, `unit` FROM `paint` WHERE `id` = ? LIMIT 1",
            paintId
          );
          const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
          if (row && row.coverage != null) {
            const w = row.weightKg ?? row.weightkg;
            paint = {
              name: row.name != null ? String(row.name) : null,
              coverage: Number(row.coverage) || 10,
              weightKg: Number(w) || 1,
              unit: row.unit != null ? String(row.unit) : "kg",
            };
          }
        } catch (e) {
          console.warn("[handleServicesCalculate] paint fetch", e?.message);
        }
      }

      const coverage = paint.coverage > 0 ? paint.coverage : 10;
      const weightKg = paint.weightKg > 0 ? paint.weightKg : 1;
      const kgNeeded = area / coverage;
      const numberOfCans = Math.ceil(kgNeeded / weightKg);

      const payload = {
        area: Math.round(area * 100) / 100,
        coverage,
        weightKg,
        kgNeeded: Math.round(kgNeeded * 100) / 100,
        recommendedQuantity: numberOfCans,
        numberOfCans,
        productName: paint.name,
        unit: "cans",
      };
      if (wallArea != null) payload.wallArea = Math.round(wallArea * 100) / 100;
      if (areaWithCeilingAndFloor != null) payload.areaWithCeilingAndFloor = Math.round(areaWithCeilingAndFloor * 100) / 100;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    } catch (err) {
      console.error("[handleServicesCalculate]", err?.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message || "Calculation failed" }));
    }
  });
};
