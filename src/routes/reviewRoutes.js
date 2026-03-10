/**
 * Review Routes
 * Handles all review-related endpoints
 */
import {
  addReview,
  getAllPainterReviews,
  deleteReview,
} from "../controllers/reviewController.js";
import { authorize } from "../middlewares/auth.js";
import {
  error,
  notFound,
  forbidden,
  unauthorized,
  badRequest,
} from "../utils/apiResponse.js";

export const handleReviewRoutes = async (req, res) => {
  const path = req.url.split("?")[0];
  const method = req.method;
  const segments = path.split("/").filter(Boolean);
  try {
    // GET /painter-reviews
    if (
      (path === "/painter-reviews" || path === "/api/painter-reviews") &&
      method === "GET"
    ) {
      return await getAllPainterReviews(req, res);
    }
    // POST /painter-reviews
    if (
      (path === "/painter-reviews" || path === "/api/painter-reviews") &&
      method === "POST"
    ) {
      const user = authorize(req, ["user"]);
      return await addReview(req, res, user);
    }
    // DELETE /painter-reviews/:id
    if (
      segments[0] === "painter-reviews" &&
      segments.length === 2 &&
      method === "DELETE"
    ) {
      const id = parseInt(segments[1]);
      if (isNaN(id)) return badRequest(req, res, "Invalid Review ID");
      authorize(req, ["admin"]);
      return await deleteReview(req, res, id);
    }

    return notFound(req, res, "Review route");
  } catch (err) {
    console.error("Review Routes Error:", err.message);

    if (err.message === "Unauthorized" || err.message.includes("No token")) {
      return unauthorized(req, res, err.message);
    }
    if (err.message === "Access denied") {
      return forbidden(req, res, err.message);
    }

    return error(req, res, err.message, 500);
  }
};

export default handleReviewRoutes;
