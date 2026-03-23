import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import fs from "fs";
import { calculateRecommendedQuantity } from "../utils/calc.js";

const prisma = new PrismaClient();

// ===== Create Paint (raw SQL — الجدول يستخدم categoryId و vendorId فقط، بدون علاقات connect) =====
export const createPaint = async (req, res) => {
  let body = "";

  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      const raw = JSON.parse(body);
      const name = raw.name != null ? String(raw.name).trim() : "";
      const type = raw.type != null ? String(raw.type).trim() || "paint" : "paint";
      const description = raw.description != null && raw.description !== "" ? String(raw.description) : null;
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
      const categoryId = raw.categoryId != null ? Number(raw.categoryId) : NaN;
      let vendorId = raw.vendorId != null ? Number(raw.vendorId) : NaN;

      if (!name || !Number.isFinite(price) || !Number.isFinite(categoryId) || categoryId <= 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "الحقل مطلوب: الاسم، السعر، التصنيف (categoryId)" }));
      }
      if (!Number.isFinite(vendorId) || vendorId <= 0) {
        const first = await prisma.vendor.findFirst({ select: { id: true } });
        vendorId = first ? first.id : null;
        if (vendorId == null) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "يرجى اختيار المورد (vendorId). لا يوجد موردين في النظام." }));
        }
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

      const q = String.fromCharCode(96);
      const sql = `INSERT INTO ${q}paint${q} (${q}name${q}, ${q}type${q}, ${q}description${q}, ${q}price${q}, ${q}unit${q}, ${q}coverage${q}, ${q}coatHours${q}, ${q}dryDays${q}, ${q}finish${q}, ${q}usage${q}, ${q}base${q}, ${q}stock${q}, ${q}inStock${q}, ${q}categoryId${q}, ${q}vendorId${q}, ${q}image${q}, ${q}isActive${q}, ${q}weightKg${q}, ${q}offerId${q}, ${q}updatedAt${q}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      await prisma.$executeRawUnsafe(
        sql,
        name,
        type,
        description,
        price,
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

      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${q}paint${q} ORDER BY id DESC LIMIT 1`);
      const paint = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Paint created", paint: paint || { name, type, categoryId, vendorId } }));
    } catch (err) {
      console.error("[createPaint]", err.message);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

// ===== Get All Paints — لا نُرجع 500 أبداً =====
export const getAllPaints = async (req, res) => {
  let rows = [];
  try {
    const q = String.fromCharCode(96);
    try {
      rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${q}paint${q}`);
    } catch (e) {
      console.warn("[getAllPaints]", e.message);
      rows = [];
    }
    const paints = Array.isArray(rows) ? rows : [];
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

// استخراج قيمة آمنة من الصف (BigInt -> Number، Date -> ISO string)
function pick(row, key) {
  if (row == null) return undefined;
  const v = row[key] ?? row[key.toLowerCase?.()] ?? row[key.toUpperCase?.()];
  if (v === null || v === undefined) return v;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return v.toISOString();
  return v;
}

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
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId < 1) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid paint id" }));
    }

    let row = null;
    try {
      const rows = await prisma.$queryRawUnsafe(
        "SELECT * FROM `paint` WHERE `id` = ? LIMIT 1",
        numId
      );
      row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    } catch (e) {
      console.warn("[getPaintById] query", e?.message);
      return send404();
    }

    if (!row) return send404();

    const paint = {
      id: Number(pick(row, "id")),
      name: String(pick(row, "name") ?? ""),
      price: Number(pick(row, "price")) || 0,
      description: pick(row, "description") != null ? String(pick(row, "description")) : null,
      categoryId: Number(pick(row, "categoryId")) || 0,
      vendorId: Number(pick(row, "vendorId")) || 0,
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
      createdAt: (() => {
        const d = pick(row, "createdAt");
        return d instanceof Date ? d.toISOString() : (d != null ? String(d) : null);
      })(),
      updatedAt: (() => {
        const d = pick(row, "updatedAt");
        return d instanceof Date ? d.toISOString() : (d != null ? String(d) : null);
      })(),
    };
    return send200(paint);
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
      const b = q();
      const sets = [];
      const values = [];

      const push = (col, val) => {
        sets.push(`${b}${col}${b} = ?`);
        values.push(val);
      };

      if (raw.name !== undefined && String(raw.name).trim()) push("name", String(raw.name).trim());
      if (raw.price !== undefined && Number.isFinite(Number(raw.price))) push("price", Number(raw.price));
      if (raw.description !== undefined) push("description", raw.description != null ? String(raw.description) : null);
      if (raw.categoryId !== undefined && Number.isFinite(Number(raw.categoryId))) push("categoryId", Number(raw.categoryId));
      if (raw.vendorId !== undefined && Number.isFinite(Number(raw.vendorId))) push("vendorId", Number(raw.vendorId));
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

      if (sets.length === 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "لا توجد حقول صالحة للتحديث" }));
      }

      push("updatedAt", new Date().toISOString().slice(0, 19).replace("T", " "));

      const sql = `UPDATE ${b}paint${b} SET ${sets.join(", ")} WHERE ${b}id${b} = ?`;
      values.push(Number(id));
      await prisma.$executeRawUnsafe(sql, ...values);

      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${b}paint${b} WHERE ${b}id${b} = ? LIMIT 1`, Number(id));
      const paint = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (paint && (paint.weightKg == null || Number.isNaN(Number(paint.weightKg)))) paint.weightKg = 1;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Paint updated", paint: paint || { id: Number(id) } }));
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
      where: { id: Number(id) },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Paint deleted" }));
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
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
