import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";

const reportController = {
  // ==============================
  //  (Sales Report)
  // ==============================
  getSalesReport: async (req, res) => {
    try {
      const lang = getLang(req);

      const sales = await prisma.order.aggregate({
        where: { status: "completed" },
        _sum: { totalPrice: true },
        _count: { id: true },
        _avg: { totalPrice: true },
      });

      const dailySales = await prisma.order.groupBy({
        by: ["createdAt"],
        where: { status: "completed" },
        _sum: { totalPrice: true },
      });

      res.status(200).json({
        totalRevenue: sales._sum.totalPrice || 0,
        ordersCount: sales._count.id,
        averageOrderValue: sales._avg.totalPrice || 0,
        currency: lang === "en" ? "EGP" : "ج.م",
        chartData: dailySales,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ==============================
  //  (Inventory Report)
  // ==============================
  getInventoryReport: async (req, res) => {
    try {
      const lang = getLang(req);

      const lowStock = await prisma.paint.findMany({
        where: { stock: { lte: 10 } },
        include: { vendor: { select: { shopName: true } } },
      });

      const localizedLowStock = lowStock.map((p) => ({
        ...p,
        name: lang === "en" ? p.name_en || p.name : p.name_ar || p.name,
      }));

      const topProductsRaw = await prisma.orderItem.groupBy({
        by: ["paintId"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      });

      const topProductsDetails = await Promise.all(
        topProductsRaw.map(async (item) => {
          const paint = await prisma.paint.findUnique({
            where: { id: item.paintId },
            select: { name_ar: true, name_en: true, name: true },
          });
          return {
            ...item,
            name:
              lang === "en"
                ? paint.name_en || paint.name
                : paint.name_ar || paint.name,
          };
        }),
      );

      res.status(200).json({
        lowStock: localizedLowStock,
        topProducts: topProductsDetails,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ==============================
  //(Customers Report)
  // ==============================
  getCustomersReport: async (req, res) => {
    try {
      const lang = getLang(req);

      const topCustomers = await prisma.user.findMany({
        where: { role: "user" },
        orderBy: { orders: { _count: "desc" } },
        take: 10,
        select: {
          name: true,
          email: true,
          balance: true,
          _count: { select: { orders: true } },
        },
      });

      const totalDebts = await prisma.user.aggregate({
        _sum: { balance: true },
      });

      res.status(200).json({
        topCustomers,
        totalDebts: totalDebts._sum.balance,
        summaryMessage:
          lang === "en"
            ? `Analysis of ${topCustomers.length} top customers`
            : `تحليل لـ ${topCustomers.length} من أفضل العملاء`,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

export default reportController;
