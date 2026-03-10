import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";

export const createCategory = async (req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { name_ar, name_en } = JSON.parse(body);

      if (!name_ar) throw new Error("Arabic category name is required");

      const category = await prisma.category.create({
        data: {
          name: name_ar.trim(),
          name_ar: name_ar.trim(),
          name_en: name_en ? name_en.trim() : null,
        },
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(category));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

export const getAllCategories = async (req, res) => {
  try {
    const lang = getLang(req);
    const categories = await prisma.category.findMany({
      include: {
        SubCategory: true,
        _count: {
          select: { paints: true },
        },
      },
    });

    const localizedCategories = categories.map((cat) => ({
      ...cat,
      name: lang === "en" ? cat.name_en || cat.name : cat.name_ar || cat.name,
      SubCategory: cat.SubCategory.map((sub) => ({
        ...sub,
        name: lang === "en" ? sub.name_en || sub.name : sub.name_ar || sub.name,
      })),
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(localizedCategories));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const deleteCategory = async (req, res, id) => {
  try {
    const lang = getLang(req);
    await prisma.category.delete({
      where: { id: Number(id) },
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: lang === "en" ? "Category deleted" : "تم حذف القسم بنجاح",
      }),
    );
  } catch (err) {
    const lang = getLang(req);
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error:
          lang === "en"
            ? "Cannot delete category (Check related paints)"
            : "لا يمكن حذف القسم (تأكد من عدم وجود منتجات مرتبطة به)",
      }),
    );
  }
};

export const updateCategory = async (req, res, id) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    try {
      const lang = getLang(req);
      const { name_ar, name_en } = JSON.parse(body || "{}");

      const updated = await prisma.category.update({
        where: { id: Number(id) },
        data: {
          name: name_ar || undefined,
          name_ar: name_ar || undefined,
          name_en: name_en || undefined,
        },
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(updated));
    } catch (innerError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to update category" }));
    }
  });
};
