// src/controllers/productController.js
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import fs from "fs";

const prisma = new PrismaClient();

// ===== Create Paint =====
export const createPaint = async (req, res, decodedUser, body) => {
  try {
    if (!body) return res.end(JSON.stringify({ error: "No data" }));
    const data = JSON.parse(body);

    const vendorRecord = await prisma.vendor.findUnique({
      where: { userId: Number(decodedUser.id) },
    });

    if (!vendorRecord) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({ error: "User is not a vendor in Vendor table" }),
      );
    }

    const paint = await prisma.paint.create({
      data: {
        name: data.name,
        price: Number(data.price),
        stock: Number(data.stock),
        base: data.base,
        finish: data.finish,
        unit: data.unit,
        usage: data.usage,
        coverage: Number(data.coverage),
        coatHours: Number(data.coatHours),
        dryDays: Number(data.dryDays),
        categoryId: Number(data.categoryId),
        vendorId: vendorRecord.id,
      },
    });

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Paint created!", paint }));
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

// ===== Get All Paints =====
export const getAllPaints = async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const search = url.searchParams.get("search");
    const categoryId = url.searchParams.get("categoryId");
    const base = url.searchParams.get("base");
    const minPrice = url.searchParams.get("minPrice");
    const maxPrice = url.searchParams.get("maxPrice");

    const paints = await prisma.paint.findMany({
      where: {
        AND: [
          search ? { name: { contains: search } } : {},
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

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(paints));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

// ===== Get Paint by ID =====
export const getPaintById = async (req, res, id) => {
  try {
    const paint = await prisma.paint.findUnique({
      where: { id: Number(id) },
    });

    if (!paint) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Paint not found" }));
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(paint));
  } catch (err) {
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

      delete data.inStock;

      const paint = await prisma.paint.update({
        where: { id: Number(id) },
        data: {
          ...data,
          ...(data.price && { price: Number(data.price) }),
          ...(data.stock && { stock: Number(data.stock) }),
          ...(data.coverage && { coverage: Number(data.coverage) }),
          ...(data.coatHours && { coatHours: Number(data.coatHours) }),
          ...(data.dryDays && { dryDays: Number(data.dryDays) }),
          ...(data.categoryId && { categoryId: Number(data.categoryId) }),
          ...(data.vendorId && { vendorId: Number(data.vendorId) }),
          ...(data.subCategoryId && {
            subCategoryId: Number(data.subCategoryId),
          }),
        },
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Paint updated", paint }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
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
      { header: "Name", key: "name", width: 20 },
      { header: "Base", key: "base", width: 15 },
      { header: "Price", key: "price", width: 10 },
      { header: "Stock", key: "stock", width: 10 },
      { header: "In Stock", key: "inStock", width: 10 },
    ];

    paints.forEach((paint) =>
      worksheet.addRow({
        id: paint.id,
        name: paint.name,
        base: paint.base,
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
};

// ===== Import Paints from Excel =====
export const importPaintsFromExcel = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const worksheet = workbook.getWorksheet(1);
    const paints = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      paints.push({
        name: row.getCell(2).value,
        base: row.getCell(3).value,
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
};
