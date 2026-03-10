import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";
export const addToCart = async (req, res, decodedUser) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const lang = getLang(req);
      const { paintId, quantity } = JSON.parse(body);

      let userCart = await prisma.cart.findUnique({
        where: { userId: Number(decodedUser.id) },
      });

      if (!userCart) {
        userCart = await prisma.cart.create({
          data: { userId: Number(decodedUser.id) },
        });
      }

      const existingItem = await prisma.cartItem.findFirst({
        where: {
          cartId: userCart.id,
          paintId: Number(paintId),
        },
      });

      let cartItem;
      if (existingItem) {
        cartItem = await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: Number(quantity) },
        });
      } else {
        cartItem = await prisma.cartItem.create({
          data: {
            cartId: userCart.id,
            paintId: Number(paintId),
            quantity: Number(quantity),
          },
        });
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "تم تحديث السلة بنجاح", cartItem }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

export const getMyCart = async (req, res, decodedUser) => {
  try {
    const lang = getLang(req);
    const userCart = await prisma.cart.findUnique({
      where: { userId: Number(decodedUser.id) },
      include: {
        items: {
          include: { paint: true },
        },
      },
    });

    if (!userCart || userCart.items.length === 0) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ items: [], totalCartPrice: 0 }));
    }
    const localizedItems = userCart.items.map((item) => ({
      ...item,
      paint: {
        ...item.paint,
        name:
          lang === "en"
            ? item.paint.name_en || item.paint.name
            : item.paint.name_ar || item.paint.name,
        description:
          lang === "en"
            ? item.paint.description_en || item.paint.description
            : item.paint.description_ar || item.paint.description,
      },
    }));
    const totalCartPrice = userCart.items.reduce((sum, item) => {
      return sum + item.quantity * item.paint.price;
    }, 0);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        cartId: userCart.id,
        items: userCart.items,
        totalCartPrice,
      }),
    );
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const removeFromCart = async (req, res, decodedUser, paintId) => {
  try {
    const userCart = await prisma.cart.findUnique({
      where: { userId: Number(decodedUser.id) },
    });

    if (!userCart) throw new Error("السلة غير موجودة");

    const deleted = await prisma.cartItem.deleteMany({
      where: {
        cartId: userCart.id,
        paintId: Number(paintId),
      },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "تم حذف المنتج من السلة" }));
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "فشل الحذف، المنتج قد لا يكون في السلة" }));
  }
};
