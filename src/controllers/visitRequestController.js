import prisma from "../prismaClient.js";
import { authenticate, authorize } from "../utils/auth.js";

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
  const n = parseInt(id, 10);
  return Number.isFinite(n) ? n : null;
};

const rowToVisitRequest = (row) => ({
  id: row.id,
  clientUserId: row.clientUserId,
  painterId: row.painterId,
  scheduledDate: row.scheduledDate instanceof Date ? row.scheduledDate.toISOString().slice(0, 10) : row.scheduledDate,
  scheduledTime: row.scheduledTime,
  area: row.area != null ? Number(row.area) : null,
  address: row.address,
  status: row.status,
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  notes: row.notes ?? null,
});

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

    await prisma.$executeRawUnsafe(
      `INSERT INTO visit_request (clientUserId, painterId, scheduledDate, scheduledTime, area, address, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      user.id,
      painterId,
      dateObj,
      scheduledTime,
      area,
      address,
      notes
    );

    const [inserted] = await prisma.$queryRawUnsafe(
      "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, address, status, createdAt, notes FROM visit_request WHERE clientUserId = ? ORDER BY id DESC LIMIT 1",
      user.id
    );
    json(res, 201, inserted ? rowToVisitRequest(inserted) : { ok: true });
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
          "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, address, status, createdAt, notes FROM visit_request WHERE painterId = ? ORDER BY createdAt DESC",
          safeId(query.painterId)
        );
      } else if (painterId) {
        raw = await prisma.$queryRawUnsafe(
          "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, address, status, createdAt, notes FROM visit_request WHERE painterId = ? ORDER BY createdAt DESC",
          painterId
        );
      } else {
        raw = [];
      }
    } else {
      // طلباتي كعميل (أو كل الطلبات للمدير)
      if (user.role === "admin" && !mine) {
        raw = await prisma.$queryRawUnsafe(
          "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, address, status, createdAt, notes FROM visit_request ORDER BY createdAt DESC"
        );
      } else {
        raw = await prisma.$queryRawUnsafe(
          "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, address, status, createdAt, notes FROM visit_request WHERE clientUserId = ? ORDER BY createdAt DESC",
          user.id
        );
      }
    }

    const list = (Array.isArray(raw) ? raw : []).map(rowToVisitRequest);
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
      "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, address, status, createdAt, notes FROM visit_request WHERE id = ? LIMIT 1",
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

    json(res, 200, rowToVisitRequest(row));
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
      "SELECT id, clientUserId, painterId, scheduledDate, scheduledTime, area, address, status, createdAt, notes FROM visit_request WHERE id = ? LIMIT 1",
      reqId
    );
    const out = Array.isArray(updated) ? updated[0] : updated;
    json(res, 200, out ? rowToVisitRequest(out) : { id: reqId, status });
  } catch (err) {
    if (err.message === "No token provided" || err.message?.includes("token")) {
      return json(res, 401, { error: err.message });
    }
    console.error("[updateVisitRequestStatus]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};
