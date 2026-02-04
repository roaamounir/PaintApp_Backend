import { PrismaClient } from "@prisma/client";
import { calculateRecommendedQuantity } from "./src/utils/calc.js";

const prisma = new PrismaClient();

async function testCalc() {
  const userId = 1;      
  const paintId = 2;    
  const length = 5;
  const width = 4;
  const height = 1;

  const area = length * width; 

  const paint = await prisma.paint.findUnique({ where: { id: paintId } });
  const recommendedQuantity = calculateRecommendedQuantity({ area, length, width, height }, paint);

  const selection = await prisma.selection.create({
    data: {
      user: { connect: { id: userId } },
      paint: { connect: { id: paintId } },
      length,
      width,
      height,
      area,                     
      recommendedQuantity
    }
  });

  console.log("Selection created:", selection);
}

testCalc()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
