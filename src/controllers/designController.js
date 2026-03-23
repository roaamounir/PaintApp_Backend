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
  const n = parseInt(id, 10);
  return Number.isFinite(n) ? n : null;
};

const rowToDesign = (row) => ({
  id: row.id,
  designerId: row.designerId,
  title: row.title,
  description: row.description,
  imageUrl: row.imageUrl,
  videoUrl: row.videoUrl ?? null,
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
});

// GET /designs — list all (optional ?designerId=) — raw SQL لتجنب أخطاء Prisma
export const getDesigns = async (req, res, query = {}) => {
  try {
    const designerId = query.designerId ? safeId(query.designerId) : undefined;
    let raw;
    if (designerId) {
      raw = await prisma.$queryRawUnsafe(
        "SELECT id, designerId, title, description, imageUrl, videoUrl, createdAt, updatedAt FROM design WHERE designerId = ? ORDER BY createdAt DESC",
        designerId
      );
    } else {
      raw = await prisma.$queryRawUnsafe(
        "SELECT id, designerId, title, description, imageUrl, videoUrl, createdAt, updatedAt FROM design ORDER BY createdAt DESC"
      );
    }
    const designs = (Array.isArray(raw) ? raw : []).map(rowToDesign);
    json(res, 200, designs);
  } catch (err) {
    console.error("[getDesigns]", err?.message);
    json(res, 500, { error: err.message || "Internal server error" });
  }
};

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
    json(res, 200, requests);
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
