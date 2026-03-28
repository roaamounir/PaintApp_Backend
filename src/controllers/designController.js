import prisma from "../prismaClient.js";
import { authorize } from "../utils/auth.js";

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

const rowToDesign = (row) => ({
  id: row.id,
  designerId: row.designerId,
  designerName: row.designerName ?? null,
  title: row.title,
  description: row.description,
  imageUrl: row.imageUrl,
  videoUrl: row.videoUrl ?? null,
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
});

/**
 * @swagger
 * /designs:
 *   get:
 *     tags: [Designs]
 *     summary: عرض التصاميم
 *     description: يدعم الفلترة بـ `designerId` أو `designerName`.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: designerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: designerName
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: قائمة التصاميم
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Design'
 *   post:
 *     tags: [Designs]
 *     summary: إضافة تصميم (مصمم/أدمن)
 *     description: المصمم أو الأدمن فقط يمكنه إضافة تصميم.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DesignCreateBody'
 *     responses:
 *       201:
 *         description: تم إضافة التصميم
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Design'
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// GET /designs — list all (optional ?designerId= & ?designerName=) — raw SQL لتجنب أخطاء Prisma
export const getDesigns = async (req, res, query = {}) => {
  try {
    const designerId = query.designerId ? safeId(query.designerId) : undefined;
    const designerName =
      query.designerName != null && String(query.designerName).trim()
        ? `%${String(query.designerName).trim()}%`
        : undefined;
    let raw;
    if (designerId && designerName) {
      raw = await prisma.$queryRawUnsafe(
        `SELECT d.id, d.designerId, d.title, d.description, d.imageUrl, d.videoUrl, d.createdAt, d.updatedAt, u.name AS designerName
         FROM design d
         LEFT JOIN \`user\` u ON u.id = d.designerId
         WHERE d.designerId = ? AND u.name LIKE ?
         ORDER BY d.createdAt DESC`,
        designerId,
        designerName
      );
    } else if (designerId) {
      raw = await prisma.$queryRawUnsafe(
        `SELECT d.id, d.designerId, d.title, d.description, d.imageUrl, d.videoUrl, d.createdAt, d.updatedAt, u.name AS designerName
         FROM design d
         LEFT JOIN \`user\` u ON u.id = d.designerId
         WHERE d.designerId = ?
         ORDER BY d.createdAt DESC`,
        designerId
      );
    } else if (designerName) {
      raw = await prisma.$queryRawUnsafe(
        `SELECT d.id, d.designerId, d.title, d.description, d.imageUrl, d.videoUrl, d.createdAt, d.updatedAt, u.name AS designerName
         FROM design d
         LEFT JOIN \`user\` u ON u.id = d.designerId
         WHERE u.name LIKE ?
         ORDER BY d.createdAt DESC`,
        designerName
      );
    } else {
      raw = await prisma.$queryRawUnsafe(
        `SELECT d.id, d.designerId, d.title, d.description, d.imageUrl, d.videoUrl, d.createdAt, d.updatedAt, u.name AS designerName
         FROM design d
         LEFT JOIN \`user\` u ON u.id = d.designerId
         ORDER BY d.createdAt DESC`
      );
    }
    const designs = (Array.isArray(raw) ? raw : []).map(rowToDesign);
    json(res, 200, designs);
  } catch (err) {
    console.error("[getDesigns]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

/**
 * @swagger
 * /designs/{id}:
 *   get:
 *     tags: [Designs]
 *     summary: تفاصيل تصميم
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: بيانات التصميم
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Design'
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   put:
 *     tags: [Designs]
 *     summary: تعديل تصميم (صاحب التصميم/أدمن)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DesignUpdateBody'
 *     responses:
 *       200:
 *         description: تم التعديل
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   delete:
 *     tags: [Designs]
 *     summary: حذف تصميم (صاحب التصميم/أدمن)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تم الحذف
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// GET /designs/:id — raw SQL
export const getDesignById = async (req, res, id) => {
  try {
    const designId = safeId(id);
    if (!designId) return json(res, 400, { error: "Invalid design id" });
    const raw = await prisma.$queryRawUnsafe(
      "SELECT id, designerId, title, description, imageUrl, videoUrl, createdAt, updatedAt FROM design WHERE id = ? LIMIT 1",
      designId
    );
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row) return json(res, 404, { error: "Design not found" });
    json(res, 200, rowToDesign(row));
  } catch (err) {
    console.error("[getDesignById]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

// POST /designs — designer or admin only
export const createDesign = async (req, res) => {
  try {
    const user = authorize(req, ["admin", "designer"]);
    const body = await readBody(req);
    const data = JSON.parse(body);
    const { title, description, imageUrl, videoUrl } = data;
    if (!title || !description || !imageUrl) {
      return json(res, 400, { error: "title, description, and imageUrl are required" });
    }
    const designerId = user.role === "admin" && data.designerId != null
      ? safeId(data.designerId)
      : user.id;
    if (!designerId) return json(res, 400, { error: "designerId required" });
    const design = await prisma.design.create({
      data: {
        designerId,
        title: String(title).trim(),
        description: String(description).trim(),
        imageUrl: String(imageUrl).trim(),
        videoUrl: videoUrl != null && String(videoUrl).trim() ? String(videoUrl).trim() : null,
      },
    });
    json(res, 201, design);
  } catch (err) {
    if (err.message === "Access denied" || err.message?.includes("token")) {
      return json(res, 403, { error: err.message });
    }
    json(res, 500, { error: err.message });
  }
};

// PUT /designs/:id — owner or admin
export const updateDesign = async (req, res, id) => {
  try {
    const user = authorize(req, ["admin", "designer"]);
    const designId = safeId(id);
    if (!designId) return json(res, 400, { error: "Invalid design id" });
    const existing = await prisma.design.findUnique({ where: { id: designId } });
    if (!existing) return json(res, 404, { error: "Design not found" });
    if (user.role !== "admin" && existing.designerId !== user.id) {
      return json(res, 403, { error: "Access denied" });
    }
    const body = await readBody(req);
    const data = JSON.parse(body);
    const design = await prisma.design.update({
      where: { id: designId },
      data: {
        ...(data.title !== undefined && { title: String(data.title).trim() }),
        ...(data.description !== undefined && { description: String(data.description).trim() }),
        ...(data.imageUrl !== undefined && { imageUrl: String(data.imageUrl).trim() }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl ? String(data.videoUrl).trim() : null }),
      },
    });
    json(res, 200, design);
  } catch (err) {
    if (err.message === "Access denied" || err.message?.includes("token")) {
      return json(res, 403, { error: err.message });
    }
    json(res, 500, { error: err.message });
  }
};

// DELETE /designs/:id — owner or admin
export const deleteDesign = async (req, res, id) => {
  try {
    const user = authorize(req, ["admin", "designer"]);
    const designId = safeId(id);
    if (!designId) return json(res, 400, { error: "Invalid design id" });
    const existing = await prisma.design.findUnique({ where: { id: designId } });
    if (!existing) return json(res, 404, { error: "Design not found" });
    if (user.role !== "admin" && existing.designerId !== user.id) {
      return json(res, 403, { error: "Access denied" });
    }
    await prisma.designcomment.deleteMany({ where: { designId } });
    await prisma.designfavorite.deleteMany({ where: { designId } });
    await prisma.designrequest.deleteMany({ where: { designId } });
    await prisma.design.delete({ where: { id: designId } });
    json(res, 200, { message: "Design deleted" });
  } catch (err) {
    if (err.message === "Access denied" || err.message?.includes("token")) {
      return json(res, 403, { error: err.message });
    }
    json(res, 500, { error: err.message });
  }
};

/**
 * @swagger
 * /designs/{id}/comments:
 *   get:
 *     tags: [Designs]
 *     summary: عرض تعليقات التصميم
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: قائمة التعليقات
 *   post:
 *     tags: [Designs]
 *     summary: تعليق على التصميم (مستخدم مسجّل)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DesignCommentBody'
 *     responses:
 *       201:
 *         description: تم إضافة التعليق
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// GET /designs/:id/comments
export const getDesignComments = async (req, res, id) => {
  try {
    const designId = safeId(id);
    if (!designId) return json(res, 400, { error: "Invalid design id" });
    const design = await prisma.design.findUnique({ where: { id: designId } });
    if (!design) return json(res, 404, { error: "Design not found" });
    const comments = await prisma.designcomment.findMany({
      where: { designId },
      orderBy: { createdAt: "asc" },
    });
    json(res, 200, comments);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
};

// POST /designs/:id/comments — any logged-in user
export const addDesignComment = async (req, res, id) => {
  try {
    const user = authorize(req, ["admin", "designer", "user", "painter", "vendor"]);
    const designId = safeId(id);
    if (!designId) return json(res, 400, { error: "Invalid design id" });
    const design = await prisma.design.findUnique({ where: { id: designId } });
    if (!design) return json(res, 404, { error: "Design not found" });
    const body = await readBody(req);
    const data = JSON.parse(body);
    const text = data.text != null ? String(data.text).trim() : "";
    if (!text) return json(res, 400, { error: "text is required" });
    const comment = await prisma.designcomment.create({
      data: { designId, userId: user.id, text },
    });
    json(res, 201, comment);
  } catch (err) {
    if (err.message === "Access denied" || err.message?.includes("token")) {
      return json(res, 403, { error: err.message });
    }
    json(res, 500, { error: err.message });
  }
};

/**
 * @swagger
 * /designs/{id}/comments/{commentId}:
 *   delete:
 *     tags: [Designs]
 *     summary: حذف تعليق (صاحب التعليق/أدمن)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: تم حذف التعليق
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// DELETE /designs/:id/comments/:commentId — comment owner or admin
export const deleteDesignComment = async (req, res, designId, commentId) => {
  try {
    const user = authorize(req, ["admin", "designer", "user", "painter", "vendor"]);
    const dId = safeId(designId);
    const cId = safeId(commentId);
    if (!dId || !cId) return json(res, 400, { error: "Invalid id" });
    const comment = await prisma.designcomment.findFirst({
      where: { id: cId, designId: dId },
    });
    if (!comment) return json(res, 404, { error: "Comment not found" });
    if (user.role !== "admin" && comment.userId !== user.id) {
      return json(res, 403, { error: "Access denied" });
    }
    await prisma.designcomment.delete({ where: { id: cId } });
    json(res, 200, { message: "Comment deleted" });
  } catch (err) {
    if (err.message === "Access denied" || err.message?.includes("token")) {
      return json(res, 403, { error: err.message });
    }
    json(res, 500, { error: err.message });
  }
};

/**
 * @swagger
 * /designs/{id}/favorite:
 *   get:
 *     tags: [Designs]
 *     summary: حالة الإعجاب للتصميم الحالي
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: حالة الإعجاب
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FavoriteToggleResponse'
 *   post:
 *     tags: [Designs]
 *     summary: إضافة/إزالة إعجاب (toggle)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: حالة الإعجاب بعد التنفيذ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FavoriteToggleResponse'
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
// POST /designs/:id/favorite — toggle; any logged-in user
export const toggleDesignFavorite = async (req, res, id) => {
  try {
    const user = authorize(req, ["admin", "designer", "user", "painter", "vendor"]);
    const designId = safeId(id);
    if (!designId) return json(res, 400, { error: "Invalid design id" });
    const design = await prisma.design.findUnique({ where: { id: designId } });
    if (!design) return json(res, 404, { error: "Design not found" });
    const existing = await prisma.designfavorite.findUnique({
      where: { userId_designId: { userId: user.id, designId } },
    });
    if (existing) {
      await prisma.designfavorite.delete({
        where: { userId_designId: { userId: user.id, designId } },
      });
      return json(res, 200, { favorited: false });
    }
    await prisma.designfavorite.create({
      data: { userId: user.id, designId },
    });
    json(res, 200, { favorited: true });
  } catch (err) {
    if (err.message === "Access denied" || err.message?.includes("token")) {
      return json(res, 403, { error: err.message });
    }
    json(res, 500, { error: err.message });
  }
};

/**
 * @swagger
 * /designs/{id}/requests:
 *   get:
 *     tags: [Designs]
 *     summary: عرض طلبات التصميم (للمصمم / الأدمن)
 *     description: "المصمم يعرض طلبات كل تصميم يملكه عبر هذا المسار لكل designId (بعد جلب تصاميمه بـ GET /designs?designerId=...). الأدمن يراها لأي تصميم. الاستجابة تتضمن clientName و clientPhone. لتحديث الحالة استخدم PUT /designs/{designId}/requests/{requestId}/status."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: قائمة الطلبات (الأحدث أولاً)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DesignRequest'
 *       403:
 *         description: ليس صاحب التصميم وليس أدمن
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   post:
 *     tags: [Designs]
 *     summary: طلب مصمم على هذا التصميم
 *     description: "أي مستخدم مسجل (مثل user، painter، vendor، designer، admin). يُحدد العميل من التوكن؛ الحقل description إلزامي."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DesignRequestBody'
 *           example:
 *             description: "طلب تنفيذ التصميم مع تفاصيل الغرفة والألوان المفضلة."
 *             imageUrl: null
 *             videoUrl: null
 *     responses:
 *       201:
 *         description: تم إنشاء الطلب (بدون تضمين clientName/clientPhone في نفس الاستجابة)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DesignRequest'
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/designs/{id}/requests:
 *   get:
 *     tags: [Designs]
 *     summary: عرض طلبات التصميم (بادئة /api)
 *     description: نفس GET `/designs/{id}/requests`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: قائمة الطلبات
 *   post:
 *     tags: [Designs]
 *     summary: إنشاء طلب تصميم (بادئة /api)
 *     description: نفس POST `/designs/{id}/requests`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DesignRequestBody'
 *     responses:
 *       201:
 *         description: تم إنشاء الطلب
 */
// GET /designs/:id/requests — design owner or admin
export const getDesignRequests = async (req, res, id) => {
  try {
    const user = authorize(req, ["admin", "designer", "user", "painter", "vendor"]);
    const designId = safeId(id);
    if (!designId) return json(res, 400, { error: "Invalid design id" });
    const design = await prisma.design.findUnique({ where: { id: designId } });
    if (!design) return json(res, 404, { error: "Design not found" });
    if (user.role !== "admin" && design.designerId !== user.id) {
      return json(res, 403, { error: "Access denied" });
    }
    const requests = await prisma.designrequest.findMany({
      where: { designId },
      orderBy: { createdAt: "desc" },
    });
    const clientIds = [...new Set(requests.map((r) => r.clientUserId).filter(Boolean))];
    const clients =
      clientIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: clientIds } },
            select: { id: true, name: true, phone: true },
          })
        : [];
    const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));
    const withClient = requests.map((r) => ({
      ...r,
      clientName: clientMap[r.clientUserId]?.name || null,
      clientPhone: clientMap[r.clientUserId]?.phone || null,
    }));
    json(res, 200, withClient);
  } catch (err) {
    if (err.message === "Access denied" || err.message?.includes("token")) {
      return json(res, 403, { error: err.message });
    }
    json(res, 500, { error: err.message });
  }
};

// POST /designs/:id/requests — client submits request (any logged-in)
export const createDesignRequest = async (req, res, id) => {
  try {
    const user = authorize(req, ["admin", "designer", "user", "painter", "vendor"]);
    const designId = safeId(id);
    if (!designId) return json(res, 400, { error: "Invalid design id" });
    const design = await prisma.design.findUnique({ where: { id: designId } });
    if (!design) return json(res, 404, { error: "Design not found" });
    const body = await readBody(req);
    const data = JSON.parse(body);
    const description = data.description != null ? String(data.description).trim() : "";
    if (!description) return json(res, 400, { error: "description is required" });
    const request = await prisma.designrequest.create({
      data: {
        designId,
        clientUserId: user.id,
        description,
        imageUrl: data.imageUrl != null && String(data.imageUrl).trim() ? String(data.imageUrl).trim() : null,
        videoUrl: data.videoUrl != null && String(data.videoUrl).trim() ? String(data.videoUrl).trim() : null,
        status: "pending",
      },
    });
    json(res, 201, request);
  } catch (err) {
    if (err.message === "Access denied" || err.message?.includes("token")) {
      return json(res, 403, { error: err.message });
    }
    json(res, 500, { error: err.message });
  }
};

/**
 * @swagger
 * /designs/{designId}/requests/{requestId}/status:
 *   put:
 *     tags: [Designs]
 *     summary: تحديث حالة طلب التصميم
 *     description: "صاحب التصميم (المصمم) أو الأدمن. استخدم نفس designId المنبثق من قائمة التصاميم أو من GET /designs/{designId}/requests."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: designId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DesignRequestStatusBody'
 *           examples:
 *             accepted:
 *               summary: قبول الطلب
 *               value:
 *                 status: accepted
 *             completed:
 *               summary: إتمام الطلب
 *               value:
 *                 status: completed
 *     responses:
 *       200:
 *         description: الطلب بعد التحديث (يتضمن clientName و clientPhone عند النجاح)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DesignRequest'
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 * /api/designs/{designId}/requests/{requestId}/status:
 *   put:
 *     tags: [Designs]
 *     summary: تحديث حالة طلب التصميم (بادئة /api)
 *     description: نفس PUT `/designs/{designId}/requests/{requestId}/status`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: designId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DesignRequestStatusBody'
 *     responses:
 *       200:
 *         description: الطلب بعد التحديث
 */
// PUT /designs/:designId/requests/:requestId/status — مصمم صاحب التصميم أو أدمن
export const updateDesignRequestStatus = async (req, res, designIdParam, requestIdParam) => {
  try {
    const user = authorize(req, ["admin", "designer"]);
    const designId = safeId(designIdParam);
    const requestId = safeId(requestIdParam);
    if (!designId || !requestId) return json(res, 400, { error: "Invalid id" });

    const design = await prisma.design.findUnique({ where: { id: designId } });
    if (!design) return json(res, 404, { error: "Design not found" });
    if (user.role !== "admin" && design.designerId !== user.id) {
      return json(res, 403, { error: "Access denied" });
    }

    const existing = await prisma.designrequest.findFirst({
      where: { id: requestId, designId },
    });
    if (!existing) return json(res, 404, { error: "Design request not found" });

    const body = await readBody(req);
    const data = JSON.parse(body || "{}");
    const status = (data.status || "").trim().toLowerCase();
    if (!["pending", "accepted", "rejected", "completed"].includes(status)) {
      return json(res, 400, {
        error: "status must be one of: pending, accepted, rejected, completed",
      });
    }

    const updated = await prisma.designrequest.update({
      where: { id: requestId },
      data: { status },
    });

    const clients =
      updated.clientUserId != null
        ? await prisma.user.findMany({
            where: { id: updated.clientUserId },
            select: { id: true, name: true, phone: true },
          })
        : [];
    const c = clients[0];
    const out = {
      ...updated,
      clientName: c?.name ?? null,
      clientPhone: c?.phone ?? null,
    };
    json(res, 200, out);
  } catch (err) {
    if (err.message === "Access denied" || err.message?.includes("token")) {
      return json(res, 403, { error: err.message });
    }
    json(res, 500, { error: err.message });
  }
};

/**
 * @swagger
 * /designs/{id}/share:
 *   get:
 *     tags: [Designs]
 *     summary: رابط مشاركة التصميم
 *     description: يعيد رابط مشاركة جاهز للواجهة.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: رابط المشاركة
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DesignShareResponse'
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
export const getDesignShareLink = async (req, res, id) => {
  try {
    const designId = safeId(id);
    if (!designId) return json(res, 400, { error: "Invalid design id" });
    const design = await prisma.design.findUnique({ where: { id: designId } });
    if (!design) return json(res, 404, { error: "Design not found" });
    const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
    const shareUrl = `${frontendBase.replace(/\/+$/, "")}/designs/${designId}`;
    return json(res, 200, { designId, shareUrl });
  } catch (err) {
    return json(res, 500, { error: err.message || "Internal server error" });
  }
};

// GET /designs/:id/favorite — check if current user has favorited (optional helper)
export const getDesignFavoriteStatus = async (req, res, id) => {
  try {
    const user = authorize(req, ["admin", "designer", "user", "painter", "vendor"]);
    const designId = safeId(id);
    if (!designId) return json(res, 400, { error: "Invalid design id" });
    const fav = await prisma.designfavorite.findUnique({
      where: { userId_designId: { userId: user.id, designId } },
    });
    json(res, 200, { favorited: !!fav });
  } catch (err) {
    if (err.message === "Access denied" || err.message?.includes("token")) {
      return json(res, 403, { error: err.message });
    }
    json(res, 500, { error: err.message });
  }
};
