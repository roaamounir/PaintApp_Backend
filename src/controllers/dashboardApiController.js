import prisma from "../prismaClient.js";
import bcrypt from "bcrypt";
import chroma from "chroma-js";
import { colorSystems, systemPalettes } from "../data/colorPalettes.js";

const json = (res, code, data) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

/** من كائن chroma إلى صيغة الاستجابة: hex, rgb, cmyk, hsl, lab_* */
function chromaToFormats(c) {
  if (!c) return null;
  const [r, g, b] = c.rgb();
  const [cyan, magenta, yellow, black] = c.cmyk();
  const [h, s, l] = c.hsl();
  const [labL, labA, labB] = c.lab();
  return {
    hex: c.hex(),
    rgb: { r: Math.round(r), g: Math.round(g), b: Math.round(b) },
    cmyk: {
      c: Math.round(cyan * 100),
      m: Math.round(magenta * 100),
      y: Math.round(yellow * 100),
      k: Math.round(black * 100),
    },
    hsl: { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) },
    lab_l: labL,
    lab_a: labA,
    lab_b: labB,
  };
}

const readBody = (req) =>
  new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });

const withoutPassword = (user) => {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
};

// ========== Users (قائمة المستخدمين للداشبورد) ==========
/** استعلام خام لتجنب خطأ Prisma عند وجود role غير معرّف في العميل (مثل designer) */
export const getUsers = async (req, res) => {
  try {
    const raw = await prisma.$queryRawUnsafe(
      "SELECT id, name, email, phone, role, createdAt FROM `user` ORDER BY createdAt DESC"
    );
    const users = (raw || []).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    }));
    json(res, 200, users);
  } catch (err) {
    console.error("[getUsers]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

export const getUserById = async (req, res, id) => {
  try {
    const raw = await prisma.$queryRawUnsafe(
      "SELECT id, name, email, phone, role, createdAt FROM `user` WHERE id = ? LIMIT 1",
      Number(id)
    );
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row) return json(res, 404, { error: "User not found" });
    const user = {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    };
    json(res, 200, user);
  } catch (err) {
    console.error("[getUserById]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

export const updateUserById = async (req, res, id) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    if (data.password !== undefined && data.password === "") delete data.password;
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.password !== undefined && { password: data.password }),
      },
    });
    json(res, 200, withoutPassword(user));
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const deleteUserById = async (req, res, id) => {
  try {
    await prisma.user.delete({ where: { id: Number(id) } });
    json(res, 200, { message: "User deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Vendors (لا توجد relation في الـ schema، نربط user يدوياً) ==========
export const getVendors = async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany();
    const userIds = vendors.map((v) => v.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const withUser = vendors.map((v) => ({ ...v, user: userMap[v.userId] || null }));
    json(res, 200, withUser);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const getVendorById = async (req, res, id) => {
  try {
    const vendor = await prisma.vendor.findFirst({
      where: { OR: [{ id: Number(id) }, { userId: Number(id) }] },
    });
    if (!vendor) return json(res, 404, { error: "Vendor not found" });
    const user = await prisma.user.findUnique({ where: { id: vendor.userId } });
    json(res, 200, { ...vendor, user: user || null });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const createVendor = async (req, res) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const vendor = await prisma.vendor.create({
      data: {
        userId: data.userId,
        shopName: data.shopName || "",
        city: data.city || "",
        address: data.address || null,
        region: data.region || null,
        taxRegistration: data.taxRegistration || null,
        isApproved: data.isApproved ?? false,
        paymentStatus: data.paymentStatus ?? false,
      },
    });
    const user = await prisma.user.findUnique({ where: { id: vendor.userId } });
    json(res, 201, { ...vendor, user: user || null });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const updateVendor = async (req, res, id) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const updateData = {};
    if (data.shopName != null) updateData.shopName = data.shopName;
    if (data.city != null) updateData.city = data.city;
    if (data.address != null) updateData.address = data.address;
    if (data.region != null) updateData.region = data.region;
    if (data.taxRegistration != null) updateData.taxRegistration = data.taxRegistration;
    if (data.isApproved != null) updateData.isApproved = data.isApproved;
    if (data.paymentStatus != null) updateData.paymentStatus = data.paymentStatus;
    const vendor = await prisma.vendor.update({
      where: { id: Number(id) },
      data: updateData,
    });
    const user = await prisma.user.findUnique({ where: { id: vendor.userId } });
    json(res, 200, { ...vendor, user: user || null });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

/** طلبات الموردين (قيد الانتظار) — موردين غير معتمدين بعد */
export const getPendingVendorRequests = async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { isApproved: false },
    });
    const userIds = vendors.map((v) => v.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const withUser = vendors.map((v) => ({
      ...v,
      user: userMap[v.userId] || null,
    }));
    json(res, 200, withUser);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

/** الموافقة على المورد أو تحديث حالة الدفع (يُستدعى من لوحة طلبات الموردين) */
export const approveVendor = async (req, res, id) => {
  try {
    const body = await readBody(req).catch(() => "{}");
    const data = body ? JSON.parse(body) : {};
    const updateData = {};
    if (data.isApproved != null) updateData.isApproved = data.isApproved;
    if (data.paymentStatus != null) updateData.paymentStatus = data.paymentStatus;
    const vendor = await prisma.vendor.update({
      where: { id: Number(id) },
      data: updateData,
    });
    const user = await prisma.user.findUnique({ where: { id: vendor.userId } });
    json(res, 200, { ...vendor, user: user || null });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const deleteVendor = async (req, res, id) => {
  try {
    const numId = Number(id);
    const byId = await prisma.vendor.findUnique({ where: { id: numId } });
    const byUserId = await prisma.vendor.findFirst({ where: { userId: numId } });
    const target = byId || byUserId;
    if (!target) return json(res, 404, { error: "Vendor not found" });
    await prisma.vendor.delete({ where: { id: target.id } });
    json(res, 200, { message: "Vendor deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Categories ==========
export const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    json(res, 200, categories);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const name = data.name_en || data.name_ar || data.name || "";
    const category = await prisma.category.create({
      data: { name, description: data.description || null },
    });
    json(res, 201, category);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const updateCategory = async (req, res, id) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const name = data.name_en ?? data.name_ar ?? data.name;
    const category = await prisma.category.update({
      where: { id: Number(id) },
      data: { ...(name && { name }), ...(data.description !== undefined && { description: data.description }) },
    });
    json(res, 200, category);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const deleteCategory = async (req, res, id) => {
  try {
    await prisma.category.delete({ where: { id: Number(id) } });
    json(res, 200, { message: "Category deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Offers ==========
export const getOffers = async (req, res) => {
  try {
    const offers = await prisma.offer.findMany();
    json(res, 200, offers);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const createOffer = async (req, res) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const offer = await prisma.offer.create({
      data: {
        title: data.title,
        discount: Number(data.discount),
        isActive: data.isActive !== false,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        discountType: data.discountType || "percentage",
      },
    });
    json(res, 201, offer);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const updateOffer = async (req, res, id) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const offer = await prisma.offer.update({
      where: { id: Number(id) },
      data,
    });
    json(res, 200, offer);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const deleteOffer = async (req, res, id) => {
  try {
    await prisma.offer.delete({ where: { id: Number(id) } });
    json(res, 200, { message: "Offer deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Color systems (من ملف الباليتات — بدون داتابيز) ==========
export const getColorSystems = async (req, res) => {
  try {
    const list = colorSystems.map((s) => ({ id: s.id, name: s.name, slug: s.slug || null }));
    json(res, 200, list);
  } catch (err) {
    json(res, 200, []);
  }
};

// ========== Colors: عند systemId من الباليتات، وإلا من favoritecolor ==========
export const getColors = async (req, res) => {
  try {
    const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const systemId = url.searchParams.get("systemId");
    if (systemId != null && systemId !== "") {
      const sid = Number(systemId);
      if (!Number.isFinite(sid)) return json(res, 200, []);
      const palette = systemPalettes[sid];
      const list = Array.isArray(palette)
        ? palette.map((item, i) => ({
            id: i + 1,
            colorSystemId: sid,
            code: item.code,
            hex: item.hex,
            labL: null,
            labA: null,
            labB: null,
          }))
        : [];
      return json(res, 200, list);
    }
    const rows = await prisma.favoritecolor.findMany();
    const colors = rows.map((c) => ({
      id: c.id,
      userId: c.userId,
      code: c.colorCode || c.name || "",
      hex: c.colorCode && /^#[0-9A-Fa-f]{6}$/.test(c.colorCode) ? c.colorCode : c.colorCode || "#000000",
      colorCode: c.colorCode,
      name: c.name,
      colorSystemId: null,
      colorSystem: { id: null, name: c.name || "—" },
    }));
    json(res, 200, colors);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== تحويل لون إلى أقرب لون في نظام (POST /services/convert) — chroma + باليتات ==========
export const handleServicesConvert = async (req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");
      let hex = data.hex != null ? String(data.hex).trim().replace(/^#/, "") : "";
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      if (hex.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(hex)) hex = "";
      if (data.rgb && typeof data.rgb === "object" && Number.isFinite(data.rgb.r + data.rgb.g + data.rgb.b)) {
        const r = Math.max(0, Math.min(255, Math.round(data.rgb.r)));
        const g = Math.max(0, Math.min(255, Math.round(data.rgb.g)));
        const b = Math.max(0, Math.min(255, Math.round(data.rgb.b)));
        hex = [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
      }
      hex = hex ? "#" + hex : "";
      const targetSystemId = data.targetSystemId != null ? Number(data.targetSystemId) : null;
      if (!hex || !Number.isFinite(targetSystemId) || targetSystemId < 1) {
        json(res, 400, { error: "Invalid input: provide hex (or rgb) and targetSystemId" });
        return;
      }
      if (!chroma.valid(hex)) {
        json(res, 400, { error: "Invalid color" });
        return;
      }
      const sourceChroma = chroma(hex);
      const sourceFormats = chromaToFormats(sourceChroma);
      if (!sourceFormats) {
        json(res, 400, { error: "Invalid color" });
        return;
      }
      const palette = systemPalettes[targetSystemId];
      const systemColors = Array.isArray(palette) ? palette : [];
      if (systemColors.length === 0) {
        json(res, 200, {
          originalColor: {
            hex: sourceFormats.hex,
            code: "—",
            rgb: sourceFormats.rgb,
            cmyk: sourceFormats.cmyk,
            hsl: sourceFormats.hsl,
            lab_l: sourceFormats.lab_l,
            lab_a: sourceFormats.lab_a,
            lab_b: sourceFormats.lab_b,
          },
          matchedColor: null,
          comparison: { deltaE: null, matchPercentage: 0, differenceNote: "No colors in target system" },
        });
        return;
      }
      let best = null;
      let bestDelta = Infinity;
      systemColors.forEach((item, index) => {
        const candidate = chroma(item.hex);
        if (!chroma.valid(item.hex)) return;
        const d = chroma.distance(sourceChroma, candidate, "lab");
        if (d < bestDelta) {
          bestDelta = d;
          best = { ...item, index };
        }
      });
      const matchPct = bestDelta < 0.01 ? 100 : Math.max(0, Math.round(100 - Math.min(bestDelta * 5, 100)));
      const matchedFormats = best ? chromaToFormats(chroma(best.hex)) : null;
      json(res, 200, {
        originalColor: {
          hex: sourceFormats.hex,
          code: "Source",
          rgb: sourceFormats.rgb,
          cmyk: sourceFormats.cmyk,
          hsl: sourceFormats.hsl,
          lab_l: sourceFormats.lab_l,
          lab_a: sourceFormats.lab_a,
          lab_b: sourceFormats.lab_b,
        },
        matchedColor: best
          ? {
              id: (best.index ?? 0) + 1,
              code: best.code,
              hex: best.hex,
              rgb: matchedFormats?.rgb,
              cmyk: matchedFormats?.cmyk,
              hsl: matchedFormats?.hsl,
              lab_l: matchedFormats?.lab_l,
              lab_a: matchedFormats?.lab_a,
              lab_b: matchedFormats?.lab_b,
            }
          : null,
        comparison: {
          deltaE: best != null ? Math.round(bestDelta * 100) / 100 : null,
          matchPercentage: best != null ? matchPct : 0,
          differenceNote:
            bestDelta < 2 ? "Excellent match" : bestDelta < 4 ? "Good match" : bestDelta < 6 ? "Noticeable difference" : "Visible difference",
        },
      });
    } catch (err) {
      console.error("[handleServicesConvert]", err?.message);
      json(res, 500, { error: err.message || "Conversion failed" });
    }
  });
};

// ========== Audit logs (سجلات التدقيق) — لا نُرجع 500 أبداً ==========
export const getAuditLogs = async (req, res) => {
  let logs = [];
  try {
    try {
      logs = await prisma.auditlog.findMany({
        orderBy: { createdAt: "desc" },
      });
    } catch (_) {
      try {
        const raw = await prisma.$queryRawUnsafe(
          "SELECT * FROM `auditlog` ORDER BY `createdAt` DESC"
        );
        logs = Array.isArray(raw) ? raw : [];
      } catch (_) {
        logs = [];
      }
    }
    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))];
    let userMap = {};
    if (userIds.length > 0) {
      try {
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        });
        userMap = Object.fromEntries(users.map((u) => [u.id, u]));
      } catch (_) {}
    }
    const withUser = logs.map((l) => ({
      ...l,
      user: l.userId ? userMap[l.userId] || null : null,
    }));
    json(res, 200, withUser);
  } catch (err) {
    console.error("[getAuditLogs]", err.message);
    json(res, 200, []);
  }
};

// ========== API Customers (مستخدمون بدور user) ==========
export const getApiCustomers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "user" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });
    const customers = users.map((u) => ({ ...u, balance: 0, creditLimit: 0 }));
    json(res, 200, customers);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== API Invoices (الطلبات كفواتير) ==========
export const getApiInvoices = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });
    const userIds = [...new Set(orders.map((o) => o.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const invoices = orders.map((order) => ({
      id: order.id,
      invoiceNumber: `INV-${order.id}`,
      amount: order.totalPrice,
      status: order.status === "delivered" ? "paid" : "pending",
      createdAt: order.createdAt,
      customer: userMap[order.userId] || null,
      order: { ...order, source: "web" },
    }));
    json(res, 200, invoices);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Painters (الفنيون/الدهانون) ==========
export const getPainters = async (req, res) => {
  try {
    const painters = await prisma.painter.findMany();
    const userIds = painters.map((p) => p.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const withUser = painters.map((p) => ({ ...p, user: userMap[p.userId] || null }));
    json(res, 200, withUser);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const getPainterById = async (req, res, id) => {
  try {
    const painter = await prisma.painter.findUnique({
      where: { id: Number(id) },
    });
    if (!painter) return json(res, 404, { error: "Painter not found" });
    const user = await prisma.user.findUnique({ where: { id: painter.userId } });
    json(res, 200, { ...painter, user: user ? withoutPassword(user) : null });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const createPainter = async (req, res) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const painter = await prisma.painter.create({
      data: {
        userId: data.userId,
        city: data.city || "",
        address: data.address || null,
        experience: Number(data.experience) || 0,
        serviceType: data.serviceType || "interior",
        rating: data.rating != null ? Number(data.rating) : 0,
      },
    });
    const user = await prisma.user.findUnique({ where: { id: painter.userId } });
    json(res, 201, { ...painter, user: user ? withoutPassword(user) : null });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const updatePainter = async (req, res, id) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const painter = await prisma.painter.update({
      where: { id: Number(id) },
      data: {
        ...(data.city !== undefined && { city: data.city }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.experience !== undefined && { experience: Number(data.experience) }),
        ...(data.serviceType !== undefined && { serviceType: data.serviceType }),
        ...(data.rating !== undefined && { rating: Number(data.rating) }),
      },
    });
    const user = await prisma.user.findUnique({ where: { id: painter.userId } });
    json(res, 200, { ...painter, user: user ? withoutPassword(user) : null });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const deletePainter = async (req, res, id) => {
  try {
    await prisma.painter.delete({ where: { id: Number(id) } });
    json(res, 200, { message: "Painter deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const getPainterFinancial = async (req, res, id) => {
  try {
    const painter = await prisma.painter.findUnique({
      where: { id: Number(id) },
    });
    if (!painter) return json(res, 404, { error: "Painter not found" });
    json(res, 200, { balance: 0, totalEarnings: 0, pendingPayout: 0 });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Painter Reviews (تقييمات الفنيين) — مع user و painter.user للداشبورد ==========
export const getPainterReviews = async (req, res) => {
  try {
    const reviews = await prisma.painterreview.findMany({
      orderBy: { createdAt: "desc" },
    });
    const userIds = [...new Set(reviews.map((r) => r.userId))];
    const painterIds = [...new Set(reviews.map((r) => r.painterId))];
    const [users, painters] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
      prisma.painter.findMany({ where: { id: { in: painterIds } } }),
    ]);
    const painterUserIds = [...new Set(painters.map((p) => p.userId))];
    const painterUsers = await prisma.user.findMany({
      where: { id: { in: painterUserIds } },
      select: { id: true, name: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const painterUserMap = Object.fromEntries(painterUsers.map((u) => [u.id, u]));
    const painterMap = Object.fromEntries(
      painters.map((p) => [p.id, { ...p, user: painterUserMap[p.userId] || null }])
    );
    const result = reviews.map((r) => ({
      ...r,
      user: userMap[r.userId] || null,
      painter: painterMap[r.painterId] || null,
    }));
    json(res, 200, result);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const deletePainterReview = async (req, res, id) => {
  try {
    await prisma.painterreview.delete({ where: { id: Number(id) } });
    json(res, 200, { message: "Review deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Admin Orders (طلبات الأدمن) — لا نُرجع 500 أبداً ==========
export const getAdminOrders = async (req, res) => {
  try {
    let orders = [];
    try {
      orders = await prisma.order.findMany({
        orderBy: { createdAt: "desc" },
      });
    } catch (_) {
      try {
        const raw = await prisma.$queryRawUnsafe(
          "SELECT * FROM `order` ORDER BY `createdAt` DESC"
        );
        orders = Array.isArray(raw) ? raw : [];
      } catch (_) {
        orders = [];
      }
    }
    if (orders.length === 0) {
      return json(res, 200, []);
    }
    const userIds = [...new Set(orders.map((o) => o.userId))];
    const painterIds = [...new Set(orders.map((o) => o.painterId).filter(Boolean))];
    let userMap = {};
    let painterMap = {};
    try {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, phone: true },
      });
      userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    } catch (_) {}
    try {
      const painters = await prisma.painter.findMany({
        where: { id: { in: painterIds } },
      });
      const painterUserIds = painters.map((p) => p.userId).filter(Boolean);
      const painterUsers = painterUserIds.length
        ? await prisma.user.findMany({
            where: { id: { in: painterUserIds } },
            select: { id: true, name: true },
          })
        : [];
      const painterUserMap = Object.fromEntries(painterUsers.map((u) => [u.id, u]));
      painterMap = Object.fromEntries(
        painters.map((p) => [p.id, { ...p, user: painterUserMap[p.userId] || null }])
      );
    } catch (_) {}

    const orderIds = orders.map((o) => o.id);
    let orderItems = [];
    let paintMap = {};
    try {
      orderItems = await prisma.orderitem.findMany({
        where: { orderId: { in: orderIds } },
      });
      const paintIds = [...new Set(orderItems.map((i) => i.paintId))];
      const paints = paintIds.length
        ? await prisma.paint.findMany({ where: { id: { in: paintIds } } })
        : [];
      const vendorIds = [...new Set(paints.map((p) => p.vendorId))];
      const vendors = vendorIds.length
        ? await prisma.vendor.findMany({ where: { id: { in: vendorIds } } })
        : [];
      const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v]));
      paintMap = Object.fromEntries(
        paints.map((p) => [p.id, { ...p, vendor: vendorMap[p.vendorId] || null }])
      );
    } catch (_) {}

    const itemsByOrderId = {};
    for (const oi of orderItems) {
      if (!itemsByOrderId[oi.orderId]) itemsByOrderId[oi.orderId] = [];
      itemsByOrderId[oi.orderId].push({
        ...oi,
        paint: paintMap[oi.paintId] || null,
      });
    }

    const withRelations = orders.map((o) => ({
      ...o,
      orderNumber: `ORD-${o.id}`,
      user: userMap[o.userId] ? { ...userMap[o.userId], city: o.zone || "", region: "" } : null,
      painter: o.painterId ? painterMap[o.painterId] || null : null,
      source: o.id % 2 === 0 ? "pos" : "app",
      items: itemsByOrderId[o.id] || [],
    }));
    json(res, 200, withRelations);
  } catch (err) {
    console.error("[getAdminOrders]", err.message);
    json(res, 200, []);
  }
};

export const getAdminOrderById = async (req, res, id) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(id) },
    });
    if (!order) return json(res, 404, { error: "Order not found" });
    const [user, painter] = await Promise.all([
      prisma.user.findUnique({ where: { id: order.userId }, select: { id: true, name: true, email: true, phone: true } }),
      order.painterId ? prisma.painter.findUnique({ where: { id: order.painterId } }) : null,
    ]);
    const orderItems = await prisma.orderitem.findMany({
      where: { orderId: order.id },
    });
    const paintIds = orderItems.map((i) => i.paintId);
    const paints = await prisma.paint.findMany({ where: { id: { in: paintIds } } });
    const vendorIds = [...new Set(paints.map((p) => p.vendorId))];
    const vendors = await prisma.vendor.findMany({ where: { id: { in: vendorIds } } });
    const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v]));
    const paintMap = Object.fromEntries(
      paints.map((p) => [p.id, { ...p, vendor: vendorMap[p.vendorId] || null }])
    );
    const items = orderItems.map((i) => ({ ...i, paint: paintMap[i.paintId] || null }));
    json(res, 200, {
      ...order,
      orderNumber: `ORD-${order.id}`,
      source: order.id % 2 === 0 ? "pos" : "app",
      user: user ? { ...user, city: order.zone || "", region: "" } : null,
      painter: painter || null,
      items,
      orderitems: items,
    });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const updateAdminOrder = async (req, res, id) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const order = await prisma.order.update({
      where: { id: Number(id) },
      data: { ...(data.status && { status: data.status }) },
    });
    json(res, 200, order);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Admin Visits (الزيارات - نستخدم الطلبات كزيارات لأن لا يوجد جدول visits) ==========
export const getAdminVisits = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { painterId: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    const userIds = [...new Set(orders.map((o) => o.userId))];
    const painterIds = [...new Set(orders.map((o) => o.painterId).filter(Boolean))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, phone: true },
    });
    const painters = await prisma.painter.findMany({
      where: { id: { in: painterIds } },
    });
    const painterUserIds = painters.map((p) => p.userId);
    const painterUsers = await prisma.user.findMany({
      where: { id: { in: painterUserIds } },
      select: { id: true, name: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const painterUserMap = Object.fromEntries(painterUsers.map((u) => [u.id, u]));
    const painterMap = Object.fromEntries(
      painters.map((p) => [p.id, { ...p, user: painterUserMap[p.userId] }])
    );
    const visits = orders.map((o) => ({
      id: o.id,
      visitDate: o.serviceDate || o.createdAt,
      visitTime: o.serviceTime || "Morning Slot",
      city: o.zone || "",
      region: "",
      area: o.area ?? 0,
      status: o.status === "completed" ? "completed" : o.status === "delivered" ? "completed" : "pending",
      user: userMap[o.userId] ? { ...userMap[o.userId], city: o.zone || "", region: "" } : null,
      painter: o.painterId ? painterMap[o.painterId] || null : null,
    }));
    json(res, 200, visits);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const getAdminVisitById = async (req, res, id) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: Number(id), painterId: { not: null } },
    });
    if (!order) return json(res, 404, { error: "Visit not found" });
    const [user, painter] = await Promise.all([
      prisma.user.findUnique({ where: { id: order.userId } }),
      prisma.painter.findUnique({ where: { id: order.painterId } }),
    ]);
    json(res, 200, {
      ...order,
      user: user ? withoutPassword(user) : null,
      painter: painter || null,
    });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const updateAdminVisit = async (req, res, id) => {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const order = await prisma.order.update({
      where: { id: Number(id) },
      data: { ...(data.status && { status: data.status }) },
    });
    json(res, 200, order);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// ========== Admin Simulations (محاكاة الألوان — من جدول selection) ==========
export const getAdminSimulations = async (req, res) => {
  try {
    const selections = await prisma.selection.findMany({
      orderBy: { createdAt: "desc" },
    });
    const userIds = [...new Set(selections.map((s) => s.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const data = selections.map((s) => ({
      id: s.id,
      resultImage: s.imagePath || "https://placehold.co/400x300/e2e8f0/64748b?text=Result",
      originalImage: "https://placehold.co/400x300/cbd5e1/475569?text=Original",
      user: userMap[s.userId] || null,
      appliedSelections: {
        colorId: s.colorCode || "N/A",
        coordinates: { x: s.width ?? 0, y: s.length ?? 0 },
      },
      createdAt: s.createdAt,
    }));
    json(res, 200, { data });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

export const deleteAdminSimulation = async (req, res, id) => {
  try {
    await prisma.selection.delete({ where: { id: Number(id) } });
    json(res, 200, { message: "Simulation deleted" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};
