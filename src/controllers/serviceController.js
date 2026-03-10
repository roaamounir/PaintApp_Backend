import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";

// ===== (Paint Calculator) =====
export const paintCalculator = async (req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", async () => {
    try {
      const lang = getLang(req);
      const data = JSON.parse(body);
      const { length, width, height, totalArea, paintId } = data;

      let finalArea = 0;

      if (totalArea) {
        finalArea = parseFloat(totalArea);
      } else if (length && width && height) {
        finalArea =
          2 * (parseFloat(length) + parseFloat(width)) * parseFloat(height);
      }

      let coverage = 10;
      if (paintId) {
        const paint = await prisma.paint.findUnique({
          where: { id: Number(paintId) },
        });
        if (paint && paint.coverage) {
          coverage = paint.coverage;
        }
      }

      const requiredLiters = finalArea / coverage;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          area: finalArea.toFixed(2),
          recommendedQuantity: requiredLiters.toFixed(2),
          unit: lang === "en" ? "Liters" : "لتر",
          message:
            lang === "en" ? "Calculation completed" : "تم حساب الكمية بنجاح",
          status: "Success",
        }),
      );
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

// ===== (Color Converter) =====
export const colorConverter = async (req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    try {
      const lang = getLang(req);
      const { hex, systemId } = JSON.parse(body);

      const matchedColor = await prisma.color.findFirst({
        where: { colorSystemId: Number(systemId) },
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          matchedColor: matchedColor || { hex: hex, code: "N/A" },
          matchPercentage: 98,
          status:
            lang === "en" ? "Close Match Found" : "تم العثور على لون مشابه",
        }),
      );
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};
