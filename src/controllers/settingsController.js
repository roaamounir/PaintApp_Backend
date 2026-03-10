import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getSettings = async (req, res) => {
  try {
    const settings = await prisma.appSetting.findMany();
    const banners = await prisma.homeBanner.findMany({
      orderBy: { displayOrder: "asc" },
    });

    const settingsObj = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const response = { settings: settingsObj, banners };
    
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const updateSettings = async (req, res, body) => {
  try {
    const { settings } = body; 

    await Promise.all(
      Object.entries(settings).map(([key, value]) =>
        prisma.appSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    );

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Settings updated successfully" }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const uploadBanner = async (req, res) => {
  try {
    if (!req.file) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "No file uploaded" }));
    }

    const newBanner = await prisma.homeBanner.create({
      data: {
        imageUrl: `/uploads/${req.file.filename}`,
        title_ar: "صورة جديدة",
        isActive: true
      }
    });

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify(newBanner));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: "No file uploaded" }));
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    await prisma.appSetting.upsert({
      where: { key: "app_logo_url" },
      update: { value: imageUrl },
      create: { key: "app_logo_url", value: imageUrl },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ imageUrl, message: "Logo updated successfully" }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
};