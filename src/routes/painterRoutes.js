/**
 * Painter Routes
 * Handles all painter-related endpoints
 */
import {
  getPaintersByCityAndService,
  getPainterDetails,
  createPainterVisit,
  getAllPainters,
  updatePainterStatus,
  deletePainter,
  getAllVisits,
  createPainter,
  updatePainterInfo,
  updateVisitStatus,
  updatePainterVerification,
  getReviewQueue,
  updatePainterFinancials,
  getPainterGallery
} from "../controllers/painterController.js";
import { authorize } from "../middlewares/auth.js";
import {
  error,
  notFound,
  forbidden,
  unauthorized,
  badRequest,
} from "../utils/apiResponse.js";

export const handlePainterRoutes = async (req, res) => {
  const path = req.url;
  const method = req.method;
  const segments = path.split("/");

  try {
    // GET /api/admin/painters/review-queue - Get painter review queue
    if (path === "/api/admin/painters/review-queue" && method === "GET") {
      authorize(req, ["admin"]);
      return await getReviewQueue(req, res);
    }

    // PATCH /api/admin/painters/verify/:id - Verify painter
    if (path.startsWith("/api/admin/painters/verify/") && method === "PATCH") {
      const id = parseInt(segments[segments.length - 1]);
      if (isNaN(id)) {
        return badRequest(req, res, "Invalid Painter ID");
      }
      authorize(req, ["admin"]);
      return await updatePainterVerification(req, res, id);
    }

    // PATCH /api/admin/painters/suspend/:id - Suspend painter
    if (path.startsWith("/api/admin/painters/suspend/") && method === "PATCH") {
      const id = parseInt(segments[segments.length - 1]);
      authorize(req, ["admin"]);
      // Note: suspendPainter function needs to be imported from controller
      // return await suspendPainter(req, res, id);
      return await updatePainterStatus(req, res, id);
    }

    // POST /painters/filter - Filter painters by city and service
    if (path === "/painters/filter" && method === "POST") {
      return await getPaintersByCityAndService(req, res);
    }

    // POST /painters/visit - Create painter visit
    if (path === "/painters/visit" && method === "POST") {
      const user = authorize(req, ["user"]);
      return await createPainterVisit(req, res, user);
    }

    // GET /painters - Get all painters
    if (path === "/painters" && method === "GET") {
      return await getAllPainters(req, res);
    }

    // POST /painters - Create new painter (admin only)
    if (path === "/painters" && method === "POST") {
      authorize(req, ["admin"]);
      return await createPainter(req, res);
    }

    // Painter by ID routes
    if (path.startsWith("/painters/") && segments.length >= 3) {
      const id = parseInt(segments[2]);

      if (isNaN(id)) {
        return badRequest(req, res, "Invalid Painter ID");
      }

      // PUT /painters/:id/financial - Update painter financials
      if (segments[3] === "financial" && method === "PUT") {
        authorize(req, ["admin"]);
        return await updatePainterFinancials(req, res, id);
      }

      // GET /painters/:id - Get painter details
      if (method === "GET") {
        return await getPainterDetails(req, res, id);
      }

      // PUT /painters/:id - Update painter info
      if (method === "PUT") {
        authorize(req, ["admin"]);

        if (path.endsWith("/status")) {
          return await updatePainterStatus(req, res, id);
        } else {
          return await updatePainterInfo(req, res, id);
        }
      }

      // DELETE /painters/:id - Delete painter
      if (method === "DELETE") {
        authorize(req, ["admin"]);
        return await deletePainter(req, res, id);
      }
    }
    // GET /painter/gallery/:id - Get painter gallery
    if (path.startsWith("/painter/gallery/") && method === "GET") {
      const painterId = parseInt(segments[3]); 
      if (isNaN(painterId)) {
        return badRequest(req, res, "Invalid Painter ID for gallery");
      }
      return await getPainterGallery(req, res, painterId);
    }
    // Route not found
    return notFound(req, res, "Painter route");
  } catch (err) {
    console.error("Painter Routes Error:", err.message);

    if (err.message === "Unauthorized" || err.message.includes("No token")) {
      return unauthorized(req, res, err.message);
    }
    if (err.message === "Access denied") {
      return forbidden(req, res, err.message);
    }
    return error(req, res, err.message, 500);
  }
};

export default handlePainterRoutes;
