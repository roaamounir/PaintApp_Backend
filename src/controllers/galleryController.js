import cloudinary from "../../config/cloudinary.js";
import formidable from "formidable";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const getJSONBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
export const uploadToGallery = async (req, res, user) => {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Error parsing the files" }));
    }

    try {
      const { itemId } = req.params;

      console.log("--- DEBUG START ---");
      console.log("Full Params Object:", req.params);
      console.log("Item ID from URL:", itemId);
      console.log("--- DEBUG END ---");
      const file = Array.isArray(files.file) ? files.file[0] : files.file;

      if (!file) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            error: "No file uploaded. Make sure the key name is 'file'",
          }),
        );
      }

      const getFieldValue = (field) =>
        Array.isArray(field) ? field[0] : field;

      let painterId;
      if (user.role === "admin") {
        const pId = getFieldValue(fields.painterId);
        if (!pId) throw new Error("painterId is required for admin uploads");
        painterId = parseInt(pId);
      } else {
        const painter = await prisma.painter.findUnique({
          where: { userId: user.id },
        });
        if (!painter)
          throw new Error("Painter profile not found for this user");
        painterId = painter.id;
      }

      const pathOnDisk = file.filepath || file.path;

      const uploadResult = await cloudinary.uploader.upload(pathOnDisk, {
        folder: "painter_portfolios",
        resource_type: "auto",
      });

      const galleryItem = await prisma.painterGallery.create({
        data: {
          painterId: painterId,
          url: uploadResult.secure_url,
          mediaType: uploadResult.resource_type === "video" ? "video" : "image",
          title_ar: getFieldValue(fields.title_ar) || null,
          title_en: getFieldValue(fields.title_en) || null,
          thumbnail:
            uploadResult.resource_type === "video"
              ? uploadResult.secure_url.replace(/\.[^/.]+$/, ".jpg")
              : null,
        },
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: galleryItem }));
    } catch (error) {
      console.error("Gallery Upload Error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: error.message || "Database or Upload Error" }),
      );
    }
  });
};

export const deleteGalleryItem = async (req, res, user) => {
  try {
    const { itemId } = req.params;

    const item = await prisma.painterGallery.findUnique({
      where: { id: parseInt(itemId) },
    });

    if (!item) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Item not found" }));
    }

    if (user.role !== "admin") {
      const painter = await prisma.painter.findUnique({
        where: { userId: user.id },
      });
      if (item.painterId !== painter.id) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({ error: "Unauthorized to delete this item" }),
        );
      }
    }

    const urlParts = item.url.split("/");
    const folderAndFile = urlParts.slice(-2).join("/");
    const publicId = folderAndFile.split(".")[0];

    await cloudinary.uploader.destroy(publicId);

    await prisma.painterGallery.delete({
      where: { id: parseInt(itemId) },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        message: "Deleted successfully from Cloud and DB",
      }),
    );
  } catch (error) {
    console.error("Delete Error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Delete failed" }));
  }
};
export const getPainterGallery = async (req, res) => {
  try {
    const { painterId } = req.params;

    const gallery = await prisma.painterGallery.findMany({
      where: { painterId: parseInt(painterId) },
      orderBy: { createdAt: "desc" },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data: gallery }));
  } catch (error) {
    console.error("Get Gallery Error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch gallery" }));
  }
};
export const updateGalleryItem = async (req, res, user) => {
  try {
    const { itemId } = req.params;
    const data = await getJSONBody(req);

    const item = await prisma.painterGallery.findUnique({
      where: { id: parseInt(itemId) },
    });

    if (!item) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Item not found" }));
    }

    if (user.role !== "admin") {
      const painter = await prisma.painter.findUnique({
        where: { userId: user.id },
      });
      if (item.painterId !== painter.id) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Unauthorized" }));
      }
    }

    const updated = await prisma.painterGallery.update({
      where: { id: parseInt(itemId) },
      data: {
        title_ar: data.title_ar,
        title_en: data.title_en,
        displayOrder: data.displayOrder
          ? parseInt(data.displayOrder)
          : undefined,
      },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data: updated }));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
};
