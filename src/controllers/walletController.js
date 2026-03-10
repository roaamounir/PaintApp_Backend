import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";

// ===== Financial Statement) =====
export const getVendorTransactions = async (req, res, userId) => {
  try {
    const lang = getLang(req);
    const id = Number(userId);

    if (!id || isNaN(id)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          error: lang === "en" ? "Invalid User ID" : "معرف المستخدم غير صحيح",
        }),
      );
    }

    const transactions = await prisma.walletTransaction.findMany({
      where: { userId: id },
      include: {
        order: {
          select: { orderNumber: true, totalPrice: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedTransactions = transactions.map((t) => {
      let typeLabel = t.type;
      if (lang === "ar") {
        if (t.type === "SALE_PROFIT") typeLabel = "ربح مبيعات";
        else if (t.type === "PAYOUT") typeLabel = "سحب أرباح";
        else if (t.type === "REFUND") typeLabel = "مرتجع";
      } else {
        if (t.type === "SALE_PROFIT") typeLabel = "Sale Profit";
        else if (t.type === "PAYOUT") typeLabel = "Payout";
        else if (t.type === "REFUND") typeLabel = "Refund";
      }

      return {
        id: t.id,
        amount: t.amount,
        type: t.type,
        typeLabel: typeLabel,
        orderNumber:
          t.order?.orderNumber || (lang === "en" ? "N/A" : "غير متاح"),
        date: t.createdAt,
        isCredit: t.amount > 0,
      };
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(formattedTransactions));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        error:
          lang === "en"
            ? "Failed to fetch transactions"
            : "فشل في جلب المعاملات",
      }),
    );
  }
};
