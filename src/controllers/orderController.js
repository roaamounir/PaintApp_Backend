import { PrismaClient } from "@prisma/client";
import { processOrderFinancials } from "./vendorController.js";
const prisma = new PrismaClient();
const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";
export const getAdminOrders = async (req, res) => {
  try {
    const lang = getLang(req);
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: { name: true, phone: true, email: true },
        },
        items: {
          include: {
            paint: {
              include: {
                vendor: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const localizedOrders = orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        paint: item.paint
          ? {
              ...item.paint,
              name:
                lang === "en"
                  ? item.paint.name_en || item.paint.name
                  : item.paint.name_ar || item.paint.name,
              vendor: item.paint.vendor
                ? {
                    ...item.paint.vendor,
                    shopName:
                      lang === "en"
                        ? item.paint.vendor.shopName_en ||
                          item.paint.vendor.shopName
                        : item.paint.vendor.shopName_ar ||
                          item.paint.vendor.shopName,
                  }
                : null,
            }
          : null,
      })),
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(orders));
  } catch (err) {
    console.error("Error fetching orders:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "خطأ في قاعدة البيانات: " + err.message }));
  }
};

export const updateOrderStatus = async (req, res, orderId) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    const lang = getLang(req);
    try {
      const data = JSON.parse(body || "{}");
      const id = Number(orderId);

      const result = await prisma.$transaction(async (tx) => {
        const currentOrder = await tx.order.findUnique({
          where: { id: id },
          include: {
            items: { include: { paint: { include: { vendor: true } } } },
          },
        });
        if (!currentOrder)
          throw new Error(
            lang === "en" ? "Order not found" : "الطلب غير موجود",
          );
        const updatedOrder = await tx.order.update({
          where: { id: id },
          data: { status: data.status },
        });

        if (
          data.status === "completed" &&
          currentOrder.status !== "completed"
        ) {
          await tx.invoice.create({
            data: {
              invoiceNumber: currentOrder.orderNumber,
              amount: currentOrder.totalPrice,
              status: "paid",
              customerId: currentOrder.userId,
              orderId: id,
            },
          });
          for (const item of currentOrder.items) {
            const vendor = item.paint.vendor;
            if (vendor) {
              const itemTotal = item.paint.price * item.quantity;
              const platformCommission =
                itemTotal * (vendor.commissionRate / 100);
              const vendorNetProfit = itemTotal - platformCommission;

              await tx.user.update({
                where: { id: vendor.userId },
                data: { balance: { increment: vendorNetProfit } },
              });

              await tx.walletTransaction.create({
                data: {
                  userId: vendor.userId,
                  amount: vendorNetProfit,
                  type: "SALE_PROFIT",
                  orderId: id,
                },
              });
            }
          }

          if (currentOrder.painterId) {
            const painterCommission = currentOrder.totalPrice * 0.05;

            await tx.user.update({
              where: { id: currentOrder.painterId },
              data: {
                balance: { increment: painterCommission },
                totalRevenue: { increment: painterCommission },
              },
            });

            await tx.walletTransaction.create({
              data: {
                userId: currentOrder.painterId,
                amount: painterCommission,
                type: "COMMISSION",
                orderId: id,
              },
            });
          }

          await tx.order.update({
            where: { id: id },
            data: { isPaid: true },
          });
        }

        return updatedOrder;
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, order: result }));
    } catch (err) {
      console.error("Update Status Error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

export const finalCheckoutTest = async (req, res, decodedUser) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    const lang = getLang(req);
    try {
      const { painterId, paymentType, source } = JSON.parse(body || "{}");
      const userId = Number(decodedUser.id);

      const userCart = await prisma.cart.findUnique({
        where: { userId: userId },
        include: { items: { include: { paint: true } } },
      });
      if (!userCart || !userCart.items.length) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            error: lang === "en" ? "Cart is empty" : "السلة فارغة",
          }),
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        let total = 0;
        for (const item of userCart.items) {
          if (!item.paint || item.paint.stock < item.quantity) {
            const pName =
              lang === "en"
                ? item.paint?.name_en || item.paint?.name
                : item.paint?.name_ar || item.paint?.name;
            throw new Error(
              lang === "en"
                ? `Insufficient stock for: ${pName}`
                : `الكمية غير كافية للمنتج: ${pName}`,
            );
          }
          total += item.quantity * item.paint.price;
        }
        const order = await tx.order.create({
          data: {
            userId: userId,
            painterId: painterId ? Number(painterId) : null,
            totalPrice: total,
            status: "pending",
            orderNumber: `INV-${Date.now()}`,
            source: source || "app",
            paymentType: paymentType || "cash",
            items: {
              create: userCart.items.map((item) => ({
                paintId: item.paintId,
                quantity: item.quantity,
              })),
            },
          },
        });

        for (const item of userCart.items) {
          const newStock = item.paint.stock - item.quantity;
          let newStatus = "available";

          if (newStock === 0) newStatus = "out_of_stock";
          else if (newStock <= item.paint.minStockLevel)
            newStatus = "low_stock";

          await tx.paint.update({
            where: { id: item.paintId },
            data: {
              stock: newStock,
              status: newStatus,
            },
          });
        }

        await tx.cartItem.deleteMany({ where: { cartId: userCart.id } });

        return order;
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "تم تسجيل الطلب وتحديث المخزن!",
          orderId: result.id,
          orderNumber: result.orderNumber,
        }),
      );
    } catch (err) {
      console.error("Checkout Error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

export const placeOrder = async (req, res) => {
  const { userId, items, source, paymentType, type } = req.body;

  try {
    const result = await prisma.$transaction(async (tx) => {
      let totalOrderPrice = 0;

      for (const item of items) {
        const paint = await tx.paint.findUnique({
          where: { id: item.paintId },
        });

        if (!paint || paint.stock < item.quantity) {
          throw new Error(
            `عذراً، المنتج ${paint?.name || "غير معروف"} غير متوفر بالكمية المطلوبة.`,
          );
        }

        await tx.paint.update({
          where: { id: item.paintId },
          data: {
            stock: { decrement: item.quantity },
            version: { increment: 1 },
          },
        });

        totalOrderPrice += paint.price * item.quantity;
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (
        user.customerType === "credit" &&
        user.balance + totalOrderPrice > user.creditLimit
      ) {
        throw new Error(
          "عفواً، الطلب يتجاوز الحد الائتماني المسموح به لهذا العميل.",
        );
      }

      const newOrder = await tx.order.create({
        data: {
          userId,
          totalPrice: totalOrderPrice,
          orderNumber: `INV-${Date.now()}`,
          source: source || "app",
          type: type || "retail",
          paymentType: paymentType || "cash",
          isPaid: paymentType === "cash" ? true : false,
          status: "completed",
          items: {
            create: items.map((i) => ({
              paintId: i.paintId,
              quantity: i.quantity,
            })),
          },
        },
      });
      await tx.invoice.create({
        data: {
          invoiceNumber: newOrder.orderNumber,
          amount: totalOrderPrice,
          status: paymentType === "cash" ? "paid" : "pending",
          customerId: userId,
          orderId: newOrder.id,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: totalOrderPrice } },
      });

      return newOrder;
    });

    res.status(201).json({
      success: true,
      message: "تمت العملية بنجاح وتحديث المخزون",
      order: result,
    });
  } catch (error) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data: lowStockPaints }));
  }
};
export const collectPayment = async (req, res) => {
  const { userId, amount, paymentMethod } = req.body;

  try {
    const transaction = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } },
      });

      await tx.walletTransaction.create({
        data: {
          userId,
          amount: amount,
          type: "payment_received",
          createdAt: new Date(),
        },
      });

      return updatedUser;
    });

    res
      .status(200)
      .json({ success: true, currentBalance: transaction.balance });
  } catch (error) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data: lowStockPaints }));
  }
};

export const getAdminOrderById = async (req, res, orderId) => {
  try {
    const id = Number(orderId);
    const order = await prisma.order.findUnique({
      where: { id: id },
      include: {
        user: {
          select: {
            name: true,
            phone: true,
            email: true,
            role: true,
          },
        },
        items: {
          include: {
            paint: {
              include: {
                vendor: {
                  select: {
                    shopName: true,
                    city: true,
                    address: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "الطلب غير موجود" }));
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(order));
  } catch (err) {
    console.error("Prisma Error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "خطأ في السيرفر: " + err.message }));
  }
};
