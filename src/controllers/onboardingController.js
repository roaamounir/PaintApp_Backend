import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getOnboardingSlides = async (req, res) => {
  try {
    const slides = await prisma.onboarding.findMany({
      orderBy: { order: "asc" }, 
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(slides));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};