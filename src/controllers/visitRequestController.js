import prisma from "../prismaClient.js";
import { authenticate } from "../utils/auth.js";
import crypto from "crypto";

/**
 * @swagger
 * tags:
 *   - name: VisitRequests
 *     description: طلبات زيارة الفني (موعد، عنوان، منطقة)
 * /visit-requests:
 *   get:
 *     tags: [VisitRequests]
 *     summary: قائمة طلبات الزيارة (الفني يرى طلباته عبر forPainter=true)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: mine
 *         schema: { type: string, enum: ['1', 'true'] }
 *       - in: query
 *         name: forPainter
 *         schema: { type: string, enum: ['1', 'true'] }
 *         description: عند إرسالها يستطيع الفني جلب جميع الطلبات الموجهة له
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VisitRequest'
 *   post:
 *     tags: [VisitRequests]
 *     summary: إنشاء طلب زيارة
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VisitRequestCreateBody'
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitRequest'
 * /visit-requests/{id}:
 *   get:
 *     tags: [VisitRequests]
 *     summary: طلب زيارة بالمعرف
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitRequest'
 * /visit-requests/{id}/status:
 *   put:
 *     tags: [VisitRequests]
 *     summary: تحديث حالة الطلب (الفني أو الأدمن)
 *     description: الفني يستطيع تحديث حالة طلباته فقط إلى pending/accepted/rejected/completed
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, accepted, rejected, completed]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VisitRequest'
 */

const json = (res, code, data) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

const readBody = (req) =>
  new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });

const safeId = (id) => {
  const s = id != null ? String(id).trim() : "";
  return s.length > 0 ? s : null;
};

const rowToVisitRequest = (row) => ({
  id: row.id,
  clientUserId: row.clientUserId,
  painterId: row.painterId,
  scheduledDate: row.scheduledDate instanceof Date ? row.scheduledDate.toISOString().slice(0, 10) : row.scheduledDate,
  scheduledTime: row.scheduledTime,
  area: row.area != null ? Number(row.area) : null,
  region: row.region ?? null,
  address: row.address,
  status: row.status,
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  notes: row.notes ?? null,
  clientPhone: row.clientPhone ?? null,
  clientName: row.clientName ?? null,
});

const attachClientContact = async (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return [];
  const userIds = [...new Set(list.map((r) => r.clientUserId).filter(Boolean))];
  if (userIds.length === 0) return list;
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, phone: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  return list.map((r) => ({
    ...r,
    clientPhone: userMap[r.clientUserId]?.phone || null,
    clientName: userMap[r.clientUserId]?.name || null,
  }));
};

// POST /visit-requests — العميل يطلب زيارة من الفني (التاريخ، الوقت، المساحة، العنوان)
export const createVisitRequest = async (req, res) => {
  try {
    const user = authenticate(req);
    const body = await readBody(req);
    const data = JSON.parse(body || "{}");
    const painterId = safeId(data.painterId);
    const scheduledDate = data.scheduledDate; // YYYY-MM-DD
    const scheduledTime = data.scheduledTime || "";
    const area = data.area != null ? parseFloat(data.area) : null;
    const region = (data.region || "").trim() || null;
    const address = (data.address || "").trim();
    const notes = (data.notes || "").trim() || null;

    if (!painterId || !scheduledDate || !scheduledTime || !address) {
      return json(res, 400, {
        error: "painterId, scheduledDate, scheduledTime, and address are required",
      });
    }

    const dateObj = new Date(scheduledDate);
    if (isNaN(dateObj.getTime())) {
      return json(res, 400, { error: "Invalid scheduledDate format (use YYYY-MM-DD)" });
    }

    const id = crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO visit_request (id, clientUserId, painterId, scheduledDate, scheduledTime, area, region, address, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      id,
      user.id,
      painterId,
      dateObj,
      scheduledTime,
      area,
      region,
      address,
      notes
    );

    const [inserted] = await prisma.$queryRawUnsafe(
      "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, region, address, status, createdAt, notes FROM visit_request WHERE id = ? LIMIT 1",
      id
    );
    const enriched = inserted ? (await attachClientContact([inserted]))[0] : null;
    json(res, 201, enriched ? rowToVisitRequest(enriched) : { ok: true });
  } catch (err) {
    if (err.message === "No token provided" || err.message?.includes("token")) {
      return json(res, 401, { error: err.message });
    }
    console.error("[createVisitRequest]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

// GET /visit-requests — قائمة طلبات الزيارة (العميل: طلباتي، الفني: الطلبات الموجهة لي)
export const getVisitRequests = async (req, res, query = {}) => {
  try {
    const user = authenticate(req);
    const mine = query.mine === "1" || query.mine === "true"; // طلباتي كعميل
    const forPainter = query.forPainter === "1" || query.forPainter === "true"; // الطلبات الموجهة للفني

    let raw;
    if (forPainter && (user.role === "painter" || user.role === "admin")) {
      const painterRow = await prisma.$queryRawUnsafe(
        "SELECT id FROM painter WHERE userId = ? LIMIT 1",
        user.id
      );
      const painter = Array.isArray(painterRow) ? painterRow[0] : painterRow;
      const painterId = painter?.id;
      if (!painterId && user.role !== "admin") {
        return json(res, 200, []);
      }
      if (user.role === "admin" && query.painterId) {
        raw = await prisma.$queryRawUnsafe(
          "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, region, address, status, createdAt, notes FROM visit_request WHERE painterId = ? ORDER BY createdAt DESC",
          safeId(query.painterId)
        );
      } else if (painterId) {
        raw = await prisma.$queryRawUnsafe(
          "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, region, address, status, createdAt, notes FROM visit_request WHERE painterId = ? ORDER BY createdAt DESC",
          painterId
        );
      } else {
        raw = [];
      }
    } else {
      // طلباتي كعميل (أو كل الطلبات للمدير)
      if (user.role === "admin" && !mine) {
        raw = await prisma.$queryRawUnsafe(
          "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, region, address, status, createdAt, notes FROM visit_request ORDER BY createdAt DESC"
        );
      } else {
        raw = await prisma.$queryRawUnsafe(
          "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, region, address, status, createdAt, notes FROM visit_request WHERE clientUserId = ? ORDER BY createdAt DESC",
          user.id
        );
      }
    }

    const withClient = await attachClientContact(raw);
    const list = withClient.map(rowToVisitRequest);
    json(res, 200, list);
  } catch (err) {
    if (err.message === "No token provided" || err.message?.includes("token")) {
      return json(res, 401, { error: err.message });
    }
    console.error("[getVisitRequests]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

// GET /visit-requests/:id
export const getVisitRequestById = async (req, res, id) => {
  try {
    const user = authenticate(req);
    const reqId = safeId(id);
    if (!reqId) return json(res, 400, { error: "Invalid id" });

    const raw = await prisma.$queryRawUnsafe(
      "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, region, address, status, createdAt, notes FROM visit_request WHERE id = ? LIMIT 1",
      reqId
    );
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row) return json(res, 404, { error: "Visit request not found" });

    const painterRow = await prisma.$queryRawUnsafe("SELECT id, userId FROM painter WHERE id = ? LIMIT 1", row.painterId);
    const painter = Array.isArray(painterRow) ? painterRow[0] : painterRow;
    const canAccess =
      user.role === "admin" ||
      row.clientUserId === user.id ||
      (painter && painter.userId === user.id);
    if (!canAccess) return json(res, 403, { error: "Access denied" });

    const enriched = (await attachClientContact([row]))[0];
    json(res, 200, rowToVisitRequest(enriched));
  } catch (err) {
    if (err.message === "No token provided" || err.message?.includes("token")) {
      return json(res, 401, { error: err.message });
    }
    console.error("[getVisitRequestById]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

// PUT /visit-requests/:id/status — الفني أو المدير يحدّث الحالة (accepted, rejected, completed)
export const updateVisitRequestStatus = async (req, res, id) => {
  try {
    const user = authenticate(req);
    const reqId = safeId(id);
    if (!reqId) return json(res, 400, { error: "Invalid id" });

    const body = await readBody(req);
    const data = JSON.parse(body || "{}");
    const status = (data.status || "").trim().toLowerCase();
    if (!["pending", "accepted", "rejected", "completed"].includes(status)) {
      return json(res, 400, { error: "status must be one of: pending, accepted, rejected, completed" });
    }

    const raw = await prisma.$queryRawUnsafe(
      "SELECT id, clientUserId, painterId FROM visit_request WHERE id = ? LIMIT 1",
      reqId
    );
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row) return json(res, 404, { error: "Visit request not found" });

    const painterRow = await prisma.$queryRawUnsafe("SELECT id, userId FROM painter WHERE id = ? LIMIT 1", row.painterId);
    const painter = Array.isArray(painterRow) ? painterRow[0] : painterRow;
    const canUpdate = user.role === "admin" || (painter && painter.userId === user.id);
    if (!canUpdate) return json(res, 403, { error: "Access denied" });

    await prisma.$executeRawUnsafe(
      "UPDATE visit_request SET status = ? WHERE id = ?",
      status,
      reqId
    );

    const updated = await prisma.$queryRawUnsafe(
      "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, region, address, status, createdAt, notes FROM visit_request WHERE id = ? LIMIT 1",
      reqId
    );
    const out = Array.isArray(updated) ? updated[0] : updated;
    const enriched = out ? (await attachClientContact([out]))[0] : null;
    json(res, 200, enriched ? rowToVisitRequest(enriched) : { id: reqId, status });
  } catch (err) {
    if (err.message === "No token provided" || err.message?.includes("token")) {
      return json(res, 401, { error: err.message });
    }
    console.error("[updateVisitRequestStatus]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};
