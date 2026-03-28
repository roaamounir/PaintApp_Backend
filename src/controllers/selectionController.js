import { PrismaClient } from "@prisma/client";
import { calculateRecommendedQuantity } from "../utils/calc.js";

const prisma = new PrismaClient();

// ===== Create Selection =====
export const createSelection = async (req, res) => {
  let body = "";
  req.on("data", chunk => (body += chunk));
  req.on("end", async () => {
    try {
      const { userId, paintId, area, length, width, height, colorCode, imagePath } = JSON.parse(body);

      const paint = await prisma.paint.findUnique({ where: { id: paintId } });
      if (!paint) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Paint not found" }));
      }

      const recommendedQuantity = calculateRecommendedQuantity({ area, length, width, height }, paint);

      const selection = await prisma.selection.create({
        data: { userId, paintId, area, length, width, height, recommendedQuantity, colorCode, imagePath },
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Selection created", selection }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

// ===== Get All Selections =====
export const getAllSelections = async (req, res) => {
  try {
    const selections = await prisma.selection.findMany({ include: { paint: true, user: true } });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(selections));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

// ===== Update Selection =====
export const updateSelection = async (req, res, id) => {
  let body = "";
  req.on("data", chunk => (body += chunk));
  req.on("end", async () => {
    try {
      const { area, length, width, height, colorCode, imagePath } = JSON.parse(body);

      const selectionDb = await prisma.selection.findUnique({ where: { id: id } });
      if (!selectionDb) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Selection not found" }));
      }

      const paint = await prisma.paint.findUnique({ where: { id: selectionDb.paintId } });
      const recommendedQuantity = calculateRecommendedQuantity({ area, length, width, height }, paint);

      const updatedSelection = await prisma.selection.update({
        where: { id: id },
        data: { area, length, width, height, recommendedQuantity, colorCode, imagePath },
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Selection updated", updatedSelection }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

// ===== Delete Selection =====
export const deleteSelection = async (req, res, id) => {
  try {
    await prisma.selection.delete({ where: { id: id } });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Selection deleted" }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
