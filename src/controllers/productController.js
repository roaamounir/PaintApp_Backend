// src/controllers/productController.js
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import multer from "multer";
const getLang = (req) => {
  const langHeader = req.headers["accept-language"];
  if (langHeader && langHeader.includes("en")) return "en";
  return "ar";
};
const prisma = new PrismaClient();

const upload = multer({ storage: multer.memoryStorage() });

// ===== Create Paint =====
export const createPaint = async (req, res, decodedUser) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", async () => {
    try {
      const lang = getLang(req);
      if (!body)
        throw new Error(
          lang === "en" ? "No data provided" : "لم يتم توفير بيانات",
        );

      const data = JSON.parse(body);
      let finalVendorId = null;

      if (decodedUser.role === "admin") {
        finalVendorId = data.vendorId ? Number(data.vendorId) : 1;
      } else {
        const vendorRecord = await prisma.vendor.findUnique({
          where: { userId: Number(decodedUser.id) },
        });
        if (!vendorRecord) {
          res.writeHead(403, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ error: "Unauthorized: Vendor record not found" }),
          );
        }
        finalVendorId = vendorRecord.id;
      }

      const paint = await prisma.paint.create({
        data: {
          name: data.name_ar || data.name || "منتج جديد",
          name_ar: data.name_ar,
          name_en: data.name_en,
          description: data.description_ar || data.description || "",
          description_ar: data.description_ar,
          description_en: data.description_en,

          price: parseFloat(data.price) || 0,
          stock: parseInt(data.stock) || 0,
          coverage: parseFloat(data.coverage) || 0,
          coatHours: parseInt(data.coatHours) || 2, 
          dryDays: parseInt(data.dryDays) || 1, 
          minStockLevel: parseInt(data.minStockLevel) || 5,

          base: data.base || "water", // PaintBase: water, oil, wood
          finish: data.finish || "matte", // PaintFinish: matte, semi_gloss, gloss
          unit: data.unit || "liter", // PaintUnit: liter, kg
          usage: data.usage || "indoor", // PaintUsage: indoor, outdoor, both

          vendor: {
            connect: { id: finalVendorId },
          },
          category: {
            connect: { id: parseInt(data.categoryId) || 1 },
          },
          ...(data.subCategoryId && {
            subCategory: { connect: { id: parseInt(data.subCategoryId) } },
          }),
          ...(data.colorId && {
            color: { connect: { id: parseInt(data.colorId) } },
          }),

          barcode: data.barcode || null,
          image: data.image || null,
          status: data.status || "available",
        },
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Paint created successfully", paint }));
    } catch (err) {
      console.error("Prisma Detailed Error:", err);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Database constraints failed",
          details: err.message,
        }),
      );
    }
  });
};

// ===== Get All Paints =====
export const getAllPaints = async (req, res) => {
  try {
    console.log("Fetching all paints...");
    const lang = getLang(req);
    const url = new URL(req.url, `http://${req.headers.host}`);
    const search = url.searchParams.get("search");
    const categoryId = url.searchParams.get("categoryId");
    const base = url.searchParams.get("base");
    const minPrice = url.searchParams.get("minPrice");
    const maxPrice = url.searchParams.get("maxPrice");

    const paints = await prisma.paint.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
                  { name_ar: { contains: search } },
                  { name_en: { contains: search } },
                  { name: { contains: search } },
                ],
              }
            : {},
          categoryId ? { categoryId: Number(categoryId) } : {},
          base ? { base: base } : {},
          {
            price: {
              gte: minPrice ? parseFloat(minPrice) : 0,
              lte: maxPrice ? parseFloat(maxPrice) : 999999,
            },
          },
        ],
      },
      include: { category: true, vendor: true },
    });

    const localizedPaints = paints.map((p) => ({
      ...p,
      name: lang === "en" ? p.name_en || p.name : p.name_ar || p.name,
      description:
        lang === "en"
          ? p.description_en || p.description
          : p.description_ar || p.description,
      categoryName: p.category
        ? lang === "en"
          ? p.category.name_en
          : p.category.name_ar
        : null,
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(localizedPaints));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

// ===== Get Paint by ID (Detailed 360 View) =====
export const getPaintById = async (req, res, id) => {
  try {
    const paint = await prisma.paint.findUnique({
      where: { id: Number(id) },
      include: {
        vendor: {
          include: {
            user: {
              select: { name: true, phone: true, email: true },
            },
          },
        },
        category: true,
        subCategory: true,
        orderItems: {
          include: {
            order: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
          orderBy: { id: "desc" },
          take: 10,
        },
      },
    });

    if (!paint) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Paint not found" }));
    }

    const aggregateSales = await prisma.orderItem.aggregate({
      where: { paintId: Number(id) },
      _sum: { quantity: true },
      _count: { id: true },
    });

    const detailedResponse = {
      ...paint,
      analytics: {
        totalSoldQuantity: aggregateSales._sum.quantity || 0,
        totalOrdersCount: aggregateSales._count.id || 0,
        revenue: (aggregateSales._sum.quantity || 0) * paint.price,
      },
      vendor: paint.vendor,
      shopName: paint.vendor?.shopName,
      supplierInfo: {
        shopName: paint.vendor?.shopName,
        contactPerson: paint.vendor?.user?.name,
        contactPhone: paint.vendor?.user?.phone,
      },
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(detailedResponse));
  } catch (err) {
    console.error("Fetch Details Error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
// ===== Update Paint =====
export const updatePaint = async (req, res, id) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const data = JSON.parse(body);

      const finalData = {
        name: data.name,
        description: data.description,
        hex: data.hex,
        finish: data.finish,
        status: data.status,
        base: data.base,
        price: parseFloat(data.price) || 0,
        stock: parseInt(data.stock) || 0,
        minStockLevel: parseInt(data.minStockLevel) || 5,
        // discount: parseFloat(data.discount) || 0,
        coverage: parseFloat(data.coverage) || 0,
        categoryId: parseInt(data.categoryId) || undefined,
        subCategoryId: data.subCategoryId ? parseInt(data.subCategoryId) : null,
        vendorId: data.vendorId ? parseInt(data.vendorId) : undefined,
      };

      Object.keys(finalData).forEach(
        (key) => finalData[key] === undefined && delete finalData[key],
      );

      const paint = await prisma.paint.update({
        where: { id: Number(id) },
        data: finalData,
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Success", paint }));
    } catch (err) {
      console.error("DEBUG PRISMA ERROR:", err);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Check console for field mismatch" }));
    }
  });
};

// ===== Delete Paint =====
export const deletePaint = async (req, res, id) => {
  try {
    await prisma.paint.delete({ where: { id: Number(id) } });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Paint deleted" }));
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

// ===== Export Paints to Excel =====
export const exportPaintsToExcel = async (res) => {
  try {
    const paints = await prisma.paint.findMany();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Paints");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "الاسم (عربي)", key: "name_ar", width: 30 },
      { header: "Name (EN)", key: "name_en", width: 30 },
      { header: "Category", key: "category", width: 20 },
      { header: "Price", key: "price", width: 15 },
      { header: "Stock", key: "stock", width: 15 },
    ];

    paints.forEach((paint) =>
      worksheet.addRow({
        id: paint.id,
        name: paint.name,
        base: paint.base,
        price: paint.price,
        stock: paint.stock,
        inStock: paint.stock > 0 ? "Yes" : "No",
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
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: err.message }));
  }
};

// ===== Import Paints from Excel (Final Fixed Version) =====
export const importPaintsFromExcel = async (req, res, decodedUser) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "File upload error" }));
    }

    try {
      if (!req.file) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "No file uploaded" }));
      }

      let finalVendorId = 1;

      if (decodedUser.role === "admin") {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const queryVendorId = url.searchParams.get("vendorId");
        finalVendorId = queryVendorId ? Number(queryVendorId) : 1;
      } else {
        const vendorRecord = await prisma.vendor.findUnique({
          where: { userId: Number(decodedUser.id) },
        });
        if (!vendorRecord)
          throw new Error("You are not registered as a vendor");
        finalVendorId = vendorRecord.id;
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.getWorksheet(1);
      const paints = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        let rawBase = String(row.getCell(3).value || "water");
        let formattedBase = rawBase.toLowerCase();

        paints.push({
          name: String(row.getCell(2).value || "Unnamed Paint"),
          base: formattedBase,
          price: parseFloat(row.getCell(4).value) || 0,
          stock: parseInt(row.getCell(5).value) || 0,
          description: "Imported from Excel",
          finish: "matte",
          unit: "liter",
          usage: "indoor",
          coverage: 10,
          coatHours: 2,
          dryDays: 1,
          vendorId: finalVendorId,
          categoryId: 1,
        });
      });

      const result = await prisma.paint.createMany({
        data: paints,
        skipDuplicates: true,
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "Paints Imported Successfully",
          count: result.count,
          linkedToVendorId: finalVendorId,
        }),
      );
    } catch (error) {
      console.error("Import Logic Error:", error.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
};

export const getLowStockAlerts = async (req, res) => {
  try {
    const lowStockPaints = await prisma.paint.findMany({
      where: {
        stock: { lte: 5 },
      },
      select: {
        id: true,
        name: true,
        stock: true,
        minStockLevel: true,
        vendor: { select: { shopName: true } },
      },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        count: lowStockPaints.length,
        data: lowStockPaints,
      }),
    );
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
};

export const getPaintAvailability = async (req, res) => {
  const { barcodeOrId } = req.params;
  // const lang = getLang(req);
  try {
    const paint = await prisma.paint.findFirst({
      where: {
        OR: [{ id: Number(barcodeOrId) || 0 }, { barcode: barcodeOrId }],
      },
    });

    if (!paint) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "المنتج غير موجود" }));
    }

    let currentStatus = "متوفر";
    if (paint.stock <= 0) currentStatus = "غير متوفر";
    else if (paint.stock <= paint.minStockLevel) currentStatus = "تحت الطلب";

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        name: paint.name,
        price: paint.price,
        stock: paint.stock,
        status: currentStatus,
      }),
    );
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
};
