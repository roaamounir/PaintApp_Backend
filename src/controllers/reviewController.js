import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";

export const addReview = async (req, res, decodedUser) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const lang = getLang(req);
      const { rating, comment, painterId } = JSON.parse(body);

      const reviewData = await prisma.painterReview.create({
        data: {
          rating: parseFloat(rating),
          review: comment,
          userId: Number(decodedUser.id),
          painterId: Number(painterId),
        },
      });

      const avg = await prisma.painterReview.aggregate({
        where: { painterId: Number(painterId) },
        _avg: { rating: true },
      });

      await prisma.painter.update({
        where: { id: Number(painterId) },
        data: { rating: avg._avg.rating || 0 },
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message:
            lang === "en"
              ? "Review added successfully!"
              : "تم إضافة تقييمك بنجاح!",
          review: reviewData,
        }),
      );
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

export const getAllPainterReviews = async (req, res) => {
  try {
    const reviews = await prisma.painterReview.findMany({
      include: {
        user: { select: { name: true } },
        painter: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(reviews));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const deleteReview = async (req, res, id) => {
  try {
    const lang = getLang(req);
    await prisma.painterReview.delete({
      where: { id: Number(id) },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message:
          lang === "en"
            ? "Review deleted successfully"
            : "تم حذف التقييم بنجاح",
      }),
    );
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
