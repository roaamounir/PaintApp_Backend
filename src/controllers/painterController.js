// controllers/painterController.js
import { PrismaClient, ServiceType } from "@prisma/client";
const prisma = new PrismaClient();

export const getPainters = async (req, res) => {
  const urlParams = new URL(req.url, `http://${req.headers.host}`);
  const city = urlParams.searchParams.get("city");
  const serviceType = urlParams.searchParams.get("serviceType");

  try {
    const painters = await prisma.painter.findMany({
      where: {
        ...(city && { city }),
        ...(serviceType && { serviceType }),
      },
      include: {
        user: true,
        gallery: true,
        reviews: true,
      },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(painters));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
