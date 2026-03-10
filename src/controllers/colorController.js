import { PrismaClient } from "@prisma/client";
import { hexToLab } from "../utils/colorConverter.js";
const prisma = new PrismaClient();
const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";

export const getAllColors = async (req, res, parsedUrl) => {
  try {
    const lang = getLang(req);
    const systemId = parsedUrl.searchParams.get("systemId");
    const search = parsedUrl.searchParams.get("search");
    const userId = parsedUrl.searchParams.get("userId");

    const colors = await prisma.color.findMany({
      where: {
        AND: [
          systemId ? { colorSystemId: parseInt(systemId) } : {},
          search
            ? {
                OR: [
                  { code: { contains: search } },
                  { hex: { contains: search } },
                ],
              }
            : {},
        ],
      },
      include: { colorSystem: true },
    });
    const localizedColors = colors.map((color) => ({
      ...color,
      colorSystem: color.colorSystem
        ? {
            ...color.colorSystem,
            name:
              lang === "en"
                ? color.colorSystem.name_en || color.colorSystem.name
                : color.colorSystem.name_ar || color.colorSystem.name,
          }
        : null,
    }));

    let favorites = [];
    if (userId) {
      const userFavs = await prisma.favoriteColor.findMany({
        where: { userId: parseInt(userId) },
      });
      favorites = userFavs.map((f) => f.colorCode);
    }

    const colorsWithFavStatus = localizedColors.map((color) => ({
      ...color,
      isFavorite: favorites.includes(color.code),
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(colorsWithFavStatus));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
};

export const getAllColorSystems = async (req, res) => {
  try {
    const lang = getLang(req);
    const systems = await prisma.colorSystem.findMany({
      include: { _count: { select: { colors: true } } },
    });

    const localizedSystems = systems.map((system) => ({
      ...system,
      name:
        lang === "en"
          ? system.name_en || system.name
          : system.name_ar || system.name,
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(localizedSystems));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
};
export const toggleFavorite = async (req, res, user) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    try {
      const { colorCode } = JSON.parse(body);
      const userId = user.id;

      const existing = await prisma.favoriteColor.findFirst({
        where: { userId, colorCode },
      });

      if (existing) {
        await prisma.favoriteColor.delete({ where: { id: existing.id } });
        res.writeHead(200);
        res.end(
          JSON.stringify({
            message: "Removed from favorites",
            isFavorite: false,
          }),
        );
      } else {
        await prisma.favoriteColor.create({
          data: { userId, colorCode },
        });
        res.writeHead(201);
        res.end(
          JSON.stringify({ message: "Added to favorites", isFavorite: true }),
        );
      }
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};
export const getColorCompatibility = async (req, res, colorId) => {
  try {
    const color = await prisma.color.findUnique({
      where: { id: parseInt(colorId) },
      include: { colorSystem: true },
    });

    if (!color) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Color not found" }));
    }

    const suggestedPaints = await prisma.paint.findMany({
      where: {
        usage: color.colorSystem.name.toLowerCase().includes("out")
          ? "outdoor"
          : "indoor",
      },
      take: 5,
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ color, suggestedPaints }));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
};
export const createColor = async (req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    try {
      const { code, hex, colorSystemId } = JSON.parse(body);

      const labValues = hexToLab(hex);

      const newColor = await prisma.color.create({
        data: {
          code,
          hex,
          ...labValues,
          colorSystemId: parseInt(colorSystemId),
        },
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(newColor));
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
};

export const updateColor = async (req, res, id) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    try {
      const data = JSON.parse(body);
      const updated = await prisma.color.update({
        where: { id: parseInt(id) },
        data: {
          ...data,
          colorSystemId: data.colorSystemId
            ? parseInt(data.colorSystemId)
            : undefined,
        },
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(updated));
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
};

export const deleteColor = async (req, res, id) => {
  try {
    await prisma.color.delete({ where: { id: parseInt(id) } });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Color deleted successfully" }));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
};

const calculateDeltaE = (color1, color2) => {
  return Math.sqrt(
    Math.pow(color1.lab_l - color2.lab_l, 2) +
      Math.pow(color1.lab_a - color2.lab_a, 2) +
      Math.pow(color1.lab_b - color2.lab_b, 2),
  );
};

export const convertColor = async (req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    try {
      const lang = getLang(req);
      const parsedBody = JSON.parse(body);
      const sourceColorId = parseInt(parsedBody.sourceColorId);
      const targetSystemId = parseInt(parsedBody.targetSystemId);

      const sourceColor = await prisma.color.findUnique({
        where: { id: sourceColorId },
      });

      if (!sourceColor || sourceColor.lab_l === null) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            error:
              lang === "en"
                ? "Selected color doesn't support smart conversion"
                : "اللون المختار لا يدعم تقنية التحويل الذكي",
          }),
        );
      }

      const targetColors = await prisma.color.findMany({
        where: { colorSystemId: targetSystemId },
      });

      if (targetColors.length === 0) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            error:
              lang === "en"
                ? "Target system is empty"
                : "نظام الألوان المستهدف فارغ حالياً",
          }),
        );
      }

      let bestMatch = null;
      let minDeltaE = Infinity;

      targetColors.forEach((color) => {
        if (color.lab_l !== null) {
          const deltaE = calculateDeltaE(sourceColor, color);
          if (deltaE < minDeltaE) {
            minDeltaE = deltaE;
            bestMatch = color;
          }
        }
      });

      const lDiff = bestMatch.lab_l - sourceColor.lab_l;
      let note = "";
      if (lang === "en") {
        note =
          minDeltaE < 1.0
            ? "Excellent Match"
            : lDiff > 0
              ? "Slightly Lighter"
              : "Slightly Darker";
      } else {
        note =
          minDeltaE < 1.0
            ? "تطابق ممتاز"
            : lDiff > 0
              ? "البديل أفتح قليلاً"
              : "البديل أغمق قليلاً";
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          originalColor: sourceColor,
          matchedColor: bestMatch,
          comparison: {
            deltaE: minDeltaE.toFixed(2),
            matchPercentage: `${Math.max(0, 100 - minDeltaE * 4).toFixed(1)}%`,
            differenceNote: note,
          },
        }),
      );
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};
