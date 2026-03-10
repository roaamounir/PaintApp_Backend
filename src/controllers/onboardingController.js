import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";

export const getOnboardingSlides = async (req, res) => {
  try {
    const lang = getLang(req);
    const slides = await prisma.onboarding.findMany({
      orderBy: { order: "asc" },
    });

    const localizedSlides = slides.map((slide) => ({
      id: slide.id,
      imageUrl: slide.imageUrl,
      order: slide.order,
      title:
        lang === "en"
          ? slide.title_en || slide.title
          : slide.title_ar || slide.title,
      description:
        lang === "en"
          ? slide.description_en || slide.description
          : slide.description_ar || slide.description,
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(localizedSlides));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
