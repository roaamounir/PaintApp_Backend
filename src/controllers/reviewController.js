import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const addReview = async (req, res, decodedUser) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { rating, comment, paintId, painterId } = JSON.parse(body);

      const review = await prisma.review.create({
        data: {
          rating: Number(rating),
          comment,
          userId: Number(decodedUser.id),
          paintId: paintId ? Number(paintId) : null,
          painterId: painterId ? Number(painterId) : null,
        },
      });

      if (painterId) {
        const avg = await prisma.review.aggregate({
          where: { painterId: Number(painterId) },
          _avg: { rating: true },
        });

        await prisma.painter.update({
          where: { id: Number(painterId) },
          data: { rating: avg._avg.rating || 0 },
        });
      }

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "تم إضافة تقييمك بنجاح!", review }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};
