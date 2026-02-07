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
      const { city, service } = parsedBody;

      if (!city || !service) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({ error: "city and service are required" }),
        );
      }

      const painters = await prisma.painter.findMany({
        where: {
          city: city,
          OR: [{ service: service }, { service: "both" }],
        },
        include: {
          user: { select: { name: true } },
        },
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(painters));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: err.message }));
    }
  });
};

// ===== Get Painter Details =====
export const getPainterDetails = async (req, res, id) => {
  try {
    const painter = await prisma.painter.findUnique({
      where: { id: Number(id) },
      include: {
        user: {
          select: { name: true, phone: true, email: true },
        },
        gallery: true,
        reviews: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!painter) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "الفني غير موجود" }));
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(painter));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
export const createPainterVisit = async (req, res, decodedUser) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const data = JSON.parse(body);

      const visit = await prisma.painterVisit.create({
        data: {
          userId: Number(decodedUser.id),
          painterId: Number(data.painterId),
          visitDate: new Date(data.visitDate),
          area: Number(data.area),
          city: data.city,
          region: data.region,
          status: "pending",
        },
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "تم إرسال طلبك بنجاح", visit }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "تأكد من صحة البيانات: " + err.message }),
      );
    }
  });
};
// ===== Create Order =====
export const createOrder = async (req, res, decodedUser) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const data = JSON.parse(body);

      const order = await prisma.order.create({
        data: {
          userId: Number(decodedUser.id),
          totalPrice: Number(data.totalPrice),
          status: "pending",
          items: {
            create: data.items.map((item) => ({
              paintId: item.paintId,
              quantity: item.quantity,
            })),
          },
        },
      });

      for (const item of data.items) {
        await prisma.paint.update({
          where: { id: item.paintId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Order placed successfully", order }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

export const getTopPainters = async (req, res) => {
  try {
    const topPainters = await prisma.painter.findMany({
      where: {
        isApproved: true,
      },
      take: 10,
      orderBy: {
        rating: "desc",
      },
      include: {
        user: {
          select: { name: true, profilePic: true },
        },
      },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(topPainters));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
