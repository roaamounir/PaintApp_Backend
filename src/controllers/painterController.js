// controllers/painterController.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";
// ==============================
// Helper: Read JSON Body
// ==============================
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

// ==============================
// GET ALL PAINTERS
// ==============================
export const getAllPainters = async (req, res) => {
  try {
    const lang = getLang(req);
    const painters = await prisma.painter.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            role: true,
          },
        },
        gallery: {
          orderBy: { createdAt: "desc" },
        },
        reviews: true,
        _count: {
          select: { visits: true },
        },
      },
    });
    const localizedPainters = painters.map((p) => ({
      ...p,
      service:
        lang === "ar"
          ? p.service === "indoor"
            ? "داخلي"
            : p.service === "outdoor"
              ? "خارجي"
              : "كلاهما"
          : p.service,
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(painters));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
};
// ==============================
// GET PAINTER DETAILS BY ID
// ==============================
export const getPainterDetails = async (req, res, id) => {
  try {
    const lang = getLang(req);
    const painter = await prisma.painter.findUnique({
      where: { id: Number(id) },
      include: {
        user: {
          select: {
            name: true,
            phone: true,
            email: true,
            status: true,
            role: true,
            balance: true,
            walletTransactions: {
              orderBy: { createdAt: "desc" },
            },
            orders: {
              include: {
                items: {
                  include: { paint: true },
                },
              
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        documents: true,
        reviews: {
          include: {
            user: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { visits: true, reviews: true },
        },
      },
    });

    if (!painter) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          error: lang === "en" ? "Painter not found" : "الفني غير موجود",
        }),
      );
    }
    if (painter.user && painter.user.orders) {
      painter.user.orders.forEach((order) => {
        order.items.forEach((item) => {
          if (item.paint) {
            item.paint.name =
              lang === "en"
                ? item.paint.name_en || item.paint.name
                : item.paint.name_ar || item.paint.name;
          }
        });
      });
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(painter));
  } catch (err) {
    console.error("❌ Error fetching painter details:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
// ==============================
// CREATE PAINTER
// ==============================
export const createPainter = async (req, res) => {
  try {
    const data = await getJSONBody(req);

    const newPainter = await prisma.painter.create({
      data: {
        userId: Number(data.userId),
        experience: Number(data.experience),
        city: data.city,
        address: data.address,
        service: data.service,
      },
    });

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify(newPainter));
  } catch (error) {
    console.error("❌ Add Error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
};
// ==============================
// UPDATE VISIT STATUS (ADMIN)
// ==============================
export const updateVisitStatus = async (req, res, id) => {
  try {
    const data = await getJSONBody(req);
    const visitId = Number(id);

    const updatedVisit = await prisma.painterVisit.update({
      where: { id: visitId },
      data: {
        status: data.status,
      },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, visit: updatedVisit }));
  } catch (error) {
    console.error("❌ Visit Update Error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
};
// ==============================
// GET PAINTERS BY CITY & SERVICE
// ==============================
export const getPaintersByCityAndService = (req, res) => {
  let body = "";

  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      const { city, service } = JSON.parse(body || "{}");

      if (!city || !service) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({ error: "city and service are required" }),
        );
      }

      const painters = await prisma.painter.findMany({
        where: {
          city,
          OR: [{ service }, { service: "both" }],
        },
        include: {
          user: { select: { name: true } },
        },
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(painters));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};
// ==============================
// UPDATE PAINTER STATUS (VIA USER MODEL)
// ==============================
export const updatePainterStatus = async (req, res, id) => {
  try {
    const data = await getJSONBody(req);
    const painterId = Number(id);

    const painter = await prisma.painter.findUnique({
      where: { id: painterId },
    });

    if (!painter) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Painter not found" }));
    }

    const updatedUser = await prisma.user.update({
      where: { id: painter.userId },
      data: {
        status: data.status === "accepted" ? true : false,
      },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        userStatus: updatedUser.status,
        id: painterId,
      }),
    );
  } catch (error) {
    console.error("❌ Update Error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
};
// ==============================
// CREATE PAINTER VISIT
// ==============================
export const createPainterVisit = async (req, res, decodedUser) => {
  let body = "";

  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      const lang = getLang(req);
      const data = JSON.parse(body);

      const visit = await prisma.painterVisit.create({
        data: {
          userId: Number(decodedUser.id),
          painterId: Number(data.painterId),
          visitDate: new Date(data.visitDate),
          area: Number(data.area),
          city: data.city,
          region: data.region,
        },
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message:
            lang === "en"
              ? "Visit request created"
              : "تم إنشاء طلب الزيارة بنجاح",
          visit,
        }),
      );
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};

// ==============================
// GET ALL VISITS (ADMIN)
// ==============================
// controllers/painterController.js

export const getAllVisits = async (req, res) => {
  try {
    const visits = await prisma.painterVisit.findMany({
      include: {
        user: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
        painter: {
          include: {
            user: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: {
        visitDate: "desc",
      },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(visits));
  } catch (err) {
    console.error("Fetch Visits Error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "فشل جلب الزيارات: " + err.message }));
  }
};

// ==============================
// DELETE PAINTER
// ==============================
export const deletePainter = async (req, res, id) => {
  try {
    const lang = getLang(req);
    const painterId = Number(id);

    await prisma.$transaction(async (tx) => {
      const painter = await tx.painter.findUnique({ where: { id: painterId } });
      if (!painter)
        throw new Error(
          lang === "en" ? "Painter not found" : "الفني غير موجود",
        );

      await tx.painterGallery.deleteMany({ where: { painterId } });
      await tx.painterVisit.deleteMany({ where: { painterId } });
      await tx.painter.delete({ where: { id: painterId } });

      await tx.user.update({
        where: { id: painter.userId },
        data: { role: "user" },
      });
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message:
          lang === "en"
            ? "Painter role removed"
            : "تم إزالة صفة الفني وتحويله لمستخدم عادي",
      }),
    );
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
};
export const updatePainterInfo = async (req, res, id) => {
  try {
    const data = await getJSONBody(req);
    const updatedPainter = await prisma.painter.update({
      where: { id: Number(id) },
      data: {
        experience: data.experience ? Number(data.experience) : undefined,
        city: data.city,
        address: data.address,
        service: data.service, // indoor, outdoor, both
      },
      include: { user: true },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(updatedPainter));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
};

export const getReviewQueue = async (req, res) => {
  try {
    const queue = await prisma.painter.findMany({
      where: {
        OR: [
          { verificationStatus: "pending" },
          { documents: { some: { status: "pending" } } },
        ],
      },
      include: {
        user: {
          select: { name: true, phone: true, email: true, createdAt: true },
        },
        documents: true,
        gallery: true,
      },
      orderBy: { id: "desc" },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(queue));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const updatePainterVerification = async (req, res, id) => {
  try {
    const data = await getJSONBody(req);

    let statusToSave = "pending";
    if (data.isVerified === true || data.verificationStatus === "verified") {
      statusToSave = "verified";
    } else if (data.status === "rejected") {
      statusToSave = "rejected";
    }

    const updated = await prisma.painter.update({
      where: { id: Number(id) },
      data: {
        verificationStatus: statusToSave,
      },
      include: { user: true },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, data: updated }));
  } catch (err) {
    console.error("❌ Verification Error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
// ==============================
// GET PAINTER GALLERY
// ==============================
export const getPainterGallery = async (req, res, id) => {
  try {
    const painterId = Number(id);

    const gallery = await prisma.painterGallery.findMany({
      where: { painterId: painterId },
      orderBy: { createdAt: "desc" },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(gallery));
  } catch (error) {
    console.error("❌ Gallery Fetch Error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
};
export const getFlaggedPainters = async (req, res) => {
  try {
    const flagged = await prisma.painter.findMany({
      where: {
        OR: [
          { reviews: { some: { rating: { lte: 2 } } } },
          { reviews: { some: { isReported: true } } },
        ],
      },
      include: {
        user: { select: { name: true, phone: true } },
        reviews: {
          where: { OR: [{ rating: { lte: 2 } }, { isReported: true }] },
          include: { user: { select: { name: true } } },
        },
      },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(flagged));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const suspendPainter = async (req, res, id) => {
  try {
    const painterId = Number(id);

    const painter = await prisma.painter.findUnique({
      where: { id: painterId },
    });

    if (!painter) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Painter not found" }));
    }

    await prisma.user.update({
      where: { id: painter.userId },
      data: { status: false },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ success: true, message: "تم تجميد حساب الفني بنجاح" }),
    );
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const updatePainterFinancials = async (req, res, id) => {
  try {
    const data = await getJSONBody(req);
    const painterId = Number(id);

    const updatedPainter = await prisma.painter.update({
      where: { id: painterId },
      data: {
        ...(data.commissionRate !== undefined && {
          commissionRate: Number(data.commissionRate),
        }),
        ...(data.debt !== undefined && { debt: Number(data.debt) }),

        user: {
          update: {
            ...(data.balance !== undefined && {
              balance: Number(data.balance),
            }),
          },
        },
      },
      include: {
        user: {
          select: { balance: true, name: true },
        },
      },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        message: "تم تحديث البيانات المالية بنجاح",
        data: updatedPainter,
      }),
    );
  } catch (error) {
    console.error("❌ Financial Update Error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
};
