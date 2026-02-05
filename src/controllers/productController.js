import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import fs from "fs";

const prisma = new PrismaClient();

// ===== Create Paint =====
export const createPaint = async (req, res) => {
  let body = "";

  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      const {
        name,
        type,
        description,
        price,
        unit,
        coverage,
        coatHours,
        dryDays,
        finish,
        usage,
        base,
        stock,
        categoryId,
        subCategoryId,
        vendorId,
      } = JSON.parse(body);

      // ===== Validation =====
      if (
        !name ||
        !type ||
        !price ||
        !unit ||
        !coverage ||
        !coatHours ||
        !dryDays ||
        !finish ||
        !usage ||
        !base ||
        !stock ||
        !categoryId ||
        !vendorId
      ) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Missing required fields" }));
      }

      // ===== Create Paint =====
      const paint = await prisma.paint.create({
        data: {
          name,
          type,
          description: description || null,
          price: Number(price),
          unit,
          coverage: Number(coverage),
          coatHours: Number(coatHours),
          dryDays: Number(dryDays),
          finish,
          usage,
          base,
          stock: Number(stock),
          inStock: Number(stock) > 0,
          categoryId: Number(categoryId),
          vendorId: Number(vendorId),
          updatedAt: new Date(),
          ...(subCategoryId && { subCategoryId: Number(subCategoryId) }),
        },
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Paint created", paint }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

// ===== Get All Paints =====
export const getAllPaints = async (req, res) => {
  try {
    const paints = await prisma.paint.findMany();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(paints));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

// Read a Single Paint (GET /paint/:id)
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

// Update Paint (PUT /paint/:id)
export const updatePaint = async (req, res, id) => {
  let body = "";

  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      const data = JSON.parse(body);

      if (data.stock !== undefined) {
        data.inStock = Number(data.stock) > 0;
      }

      const paint = await prisma.paint.update({
        where: { id: Number(id) },
        data: {
          ...data,
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
