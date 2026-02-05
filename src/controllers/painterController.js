// controllers/painterController.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ===== Get Painters by City and ServiceType =====
export const getPaintersByCityAndService = (req, res) => {
  let body = "";

  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      const parsedBody = body && body.length > 0 ? JSON.parse(body) : {};
      const { city, serviceType } = parsedBody;

      console.log("BODY:", parsedBody);

      if (!city || !serviceType) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({ error: "city and serviceType are required" }),
        );
      }

      const cityNormalized = city.trim().toLowerCase();
      const serviceTypeNormalized = serviceType.trim().toLowerCase();

      const painters = await prisma.painter.findMany({
        where: {
          city: cityNormalized,
          OR: [{ serviceType: serviceTypeNormalized }, { serviceType: "both" }],
        },
        select: {
          id: true,
          userId: true,
          rating: true,
          experience: true,
          serviceType: true,
          address: true,
        },
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(painters));
    } catch (err) {
      console.error("FILTER ERROR:", err);

      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: err.message }));
    }
  });

  req.on("error", (err) => {
    console.error("REQ ERROR:", err);
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error reading request body" }));
  });
};

// ===== Get Painter Details =====
export const getPainterDetails = async (req, res, painterId) => {
  try {
    const painter = await prisma.painter.findUnique({
      where: { id: Number(painterId) },
      include: {
        user: { select: { name: true } },
        gallery: true,
        reviews: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!painter) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Painter not found" }));
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(painter));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

// ===== Create Order =====
export const createOrder = async (req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const {
        userId,
        painterId,
        serviceDate,
        serviceTime,
        area,
        zone,
        serviceType,
        totalPrice,
      } = JSON.parse(body);

      if (
        !userId ||
        !painterId ||
        !serviceDate ||
        !serviceTime ||
        !area ||
        !zone ||
        !serviceType ||
        !totalPrice
      ) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Missing required fields" }));
      }

      const order = await prisma.order.create({
        data: {
          userId,
          painterId,
          serviceDate: new Date(serviceDate),
          serviceTime,
          area,
          zone,
          totalPrice,
        },
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Order created", order }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};
