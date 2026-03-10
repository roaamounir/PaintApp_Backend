import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";

const customerController = {
  getAllCustomers: async (req, res) => {
    const lang = getLang(req);
    try {
      const customers = await prisma.user.findMany({
        where: {
          role: "user",
        },
        select: {
          id: true,
          name: true,
          phone: true,
          balance: true,
          creditLimit: true,
          _count: {
            select: { orders: true },
          },
        },
      });

      const formattedCustomers = customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        balance: c.balance,
        creditLimit: c.creditLimit,
        totalOrders: c._count.orders,
      }));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(formattedCustomers));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            lang === "en" ? "Internal Server Error" : "خطأ داخلي في الخادم",
          details: error.message,
        }),
      );
    }
  },
};

export default customerController;
