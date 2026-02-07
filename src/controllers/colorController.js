// src/controllers/colorController.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const hexToRgb = (hex) => {
  hex = hex.replace(/^#/, "");
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgb(${r}, ${g}, ${b})`;
};

export const convertAndSearchColor = async (req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { code, systemName } = JSON.parse(body);

      let hexQuery = code;
      let rgbQuery = code;

      if (code.startsWith("#")) {
        rgbQuery = hexToRgb(code);
      }

      const foundColor = await prisma.color.findFirst({
        where: {
          OR: [{ hex: hexQuery }, { rgb: rgbQuery }, { code: code }],
        },
        include: {
          colorSystem: true,
        },
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          input: code,
          converted: { hex: hexQuery, rgb: rgbQuery },
          match: foundColor
            ? {
                name: foundColor.code,
                system: foundColor.colorSystem.name,
                details: foundColor,
              }
            : "لم يتم العثور على تطابق دقيق في شركاتنا حالياً",
        }),
      );
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};
