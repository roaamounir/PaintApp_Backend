// src/controllers/simulationController.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import { hexToLab } from "../utils/colorConverter.js";

const getRequestBody = (req) => {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
};  
export const matchColor = async (req, res) => {
  const body = await getRequestBody(req);
  const { hex } = body;

  if (!hex) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Missing hex code" }));
  }

  try {
    const allColors = await prisma.color.findMany();
    const targetLab = hexToLab(hex);

    const matches = allColors.map((color) => {
      const distance = Math.sqrt(
        Math.pow(targetLab.lab_l - color.lab_l, 2) +
          Math.pow(targetLab.lab_a - color.lab_a, 2) +
          Math.pow(targetLab.lab_b - color.lab_b, 2),
      );
      const matchPercentage = Math.max(0, 100 - distance * 2).toFixed(1);
      return { ...color, distance, matchPercentage };
    });

    const result = matches.sort((a, b) => a.distance - b.distance).slice(0, 5);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data: result }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const saveSimulation = async (req, res, user) => {
  try {
    const body = await getRequestBody(req);
    const { originalImage, resultImage, colorId, coordinates } = body;

    if (!originalImage || !resultImage) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Missing image data" }));
    }

    const simulation = await prisma.colorSimulation.create({
      data: {
        userId: user.id,
        originalImage,
        resultImage,
        colorId: colorId ? parseInt(colorId) : null,
        appliedSelections: {
          colorId: colorId || null,
          coordinates: coordinates || {},
        },
      },
    });

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data: simulation }));
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to save log: " + err.message }));
  }
};

export const deleteSimulation = async (req, res, user) => {
  try {
    const segments = req.url.split("/");
    const id = parseInt(segments[segments.length - 1]);

    const simulation = await prisma.colorSimulation.findUnique({
      where: { id },
    });

    if (!simulation || simulation.userId !== user.id) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Unauthorized or not found" }));
    }

    await prisma.colorSimulation.delete({ where: { id } });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, message: "Deleted successfully" }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const getMySimulations = async (req, res, user) => {
  try {
    const simulations = await prisma.colorSimulation.findMany({
      where: { userId: user.id },
      include: {
        color: {
          include: { paints: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data: simulations }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const getAdminSimulations = async (req, res) => {
  try {
    const simulations = await prisma.colorSimulation.findMany({
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data: simulations }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const getSimulationStats = async (req, res) => {
  try {
    const topColors = await prisma.colorSimulation.groupBy({
      by: ["colorId"],
      _count: { colorId: true },
      orderBy: { _count: { colorId: "desc" } },
      take: 5,
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data: topColors }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
