import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";

export const getAllOffers = async (req, res) => {
  try {
    const lang = getLang(req);
    const offers = await prisma.offer.findMany({
      orderBy: { id: "desc" },
    });

    const localizedOffers = offers.map((offer) => ({
      ...offer,
      title:
        lang === "en"
          ? offer.title_en || offer.title
          : offer.title_ar || offer.title,
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(localizedOffers));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const createOffer = async (req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    try {
      const lang = getLang(req);
      const { title_ar, title_en, discount, discountType, isActive } =
        JSON.parse(body);

      if (!title_ar) throw new Error("Arabic title is required");

      const newOffer = await prisma.offer.create({
        data: {
          title: title_ar,
          title_ar: title_ar,
          title_en: title_en || null,
          discount: parseFloat(discount),
          discountType,
          isActive: isActive !== undefined ? isActive : true,
        },
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(newOffer));
    } catch (err) {
      const lang = getLang(req);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: lang === "en" ? "Invalid data provided" : "بيانات غير صالحة",
        }),
      );
    }
  });
};

export const deleteOffer = async (req, res, id) => {
  try {
    const lang = getLang(req);
    await prisma.offer.delete({ where: { id: Number(id) } });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message:
          lang === "en" ? "Offer deleted successfully" : "تم حذف العرض بنجاح",
      }),
    );
  } catch (err) {
    const lang = getLang(req);
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: lang === "en" ? "Offer not found" : "العرض غير موجود",
      }),
    );
  }
};

export const toggleOfferStatus = async (req, res, id) => {
  try {
    const currentOffer = await prisma.offer.findUnique({
      where: { id: Number(id) },
    });
    if (!currentOffer) throw new Error("Not Found");

    const updated = await prisma.offer.update({
      where: { id: Number(id) },
      data: { isActive: !currentOffer.isActive },
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(updated));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
