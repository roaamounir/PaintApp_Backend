// src/routes/productRoutes.js
import {
  createPaint,
  getAllPaints,
  getPaintById,
  updatePaint,
  deletePaint,
} from "../controllers/productController.js";
import { authorize } from "../middlewares/auth.js";
import { error, notFound, forbidden, unauthorized } from "../utils/apiResponse.js";

/**
 * Handle all product/paint-related routes
 */
export const handleProductRoutes = async (req, res) => {
  try {
    const path = new URL(req.url, `http://${req.headers.host}`).pathname;
    const method = req.method;

    const segments = path.split("/").filter(Boolean);

    // ======================
    // GET /paints
    // ======================
    if (path === "/paints" && method === "GET") {
      return await getAllPaints(req, res);
    }

    // ======================
    // POST /paint
    // ======================
    if (path === "/paint" && method === "POST") {
      const decodedUser = authorize(req, ["admin", "vendor", "painter"]);
      return await createPaint(req, res, decodedUser);
    }

    // ======================
    // /paint/:id
    // ======================
    if (segments[0] === "paint" && segments.length >= 2) {
      const id = parseInt(segments[1]);

      if (isNaN(id)) {
        return badRequest(req, res, "Invalid Paint ID");
      }

      // GET paint by id
      if (method === "GET") {
        return await getPaintById(req, res, id);
      }

      // UPDATE paint
      if (method === "PUT") {
        authorize(req, ["admin", "vendor", "painter"]);
        return await updatePaint(req, res, id);
      }

      // DELETE paint
      if (method === "DELETE") {
        authorize(req, ["admin", "vendor", "painter"]);
        return await deletePaint(req, res, id);
      }
    }

    return notFound(req, res, "Route in Products");

  } catch (err) {
    console.error("Product Routes Error:", err.message);

    if (err.message === "Unauthorized" || err.message.includes("No token")) {
      return unauthorized(req, res, err.message);
    }

    if (err.message === "Access denied" || err.message.includes("الصلاحية")) {
      return forbidden(req, res, err.message);
    }

    return error(req, res, err.message, 500);
  }
};

export default handleProductRoutes;
