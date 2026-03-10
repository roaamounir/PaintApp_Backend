import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";

export const addToFavorites = async (req, res, decodedUser) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const lang = getLang(req);
      const { colorCode } = JSON.parse(body);

      const favorite = await prisma.favoriteColor.create({
        data: {
          userId: Number(decodedUser.id),
          colorCode: colorCode,
        },
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: lang === "en" ? "Added to favorites" : "تمت الإضافة للمفضلة",
          favorite,
        }),
      );
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

export const getMyFavorites = async (req, res, decodedUser) => {
  try {
    const favorites = await prisma.favoriteColor.findMany({
      where: { userId: Number(decodedUser.id) },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(favorites));
  } catch (err) {
    const lang = getLang(req);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: lang === "en" ? "Internal Server Error" : "خطأ داخلي في الخادم",
      }),
    );
  }
};
