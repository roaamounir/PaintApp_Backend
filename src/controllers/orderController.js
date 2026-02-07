import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const finalCheckoutTest = async (req, res, decodedUser) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const userId = Number(decodedUser.id);

      const userCart = await prisma.cart.findUnique({
        where: { userId: userId },
        include: {
          items: { include: { paint: true } },
        },
      });

      console.log("Cart Data Found:", userCart);

      if (!userCart || !userCart.items || userCart.items.length === 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            error: "السلة فارغة، لا يمكن إتمام الطلب.",
            details: "تأكد من إضافة منتجات للسلة أولاً",
          }),
        );
      }

      const cartItems = userCart.items;

      const total = cartItems.reduce((sum, item) => {
        return sum + item.quantity * (item.paint?.price || 0);
      }, 0);

      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            userId: userId,
            totalPrice: total,
            status: "pending",
            items: {
              create: cartItems.map((item) => ({
                paintId: item.paintId,
                quantity: item.quantity,
              })),
            },
          },
        });

        for (const item of cartItems) {
          await tx.paint.update({
            where: { id: item.paintId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        await tx.cartItem.deleteMany({
          where: { cartId: userCart.id },
        });

        return order;
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ message: "تم تسجيل الطلب!", orderId: result.id }),
      );
    } catch (err) {
      console.error("ORDER ERROR:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "خطأ في السيرفر: " + err.message }));
    }
  });
};
