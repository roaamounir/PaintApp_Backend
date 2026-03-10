/**
 * Gallery Routes
 * Handles all gallery-related endpoints
 */
import {
  uploadToGallery,
  deleteGalleryItem,
  getPainterGallery,
  updateGalleryItem,
} from "../controllers/galleryController.js";
import { authorize } from "../middlewares/auth.js";
import {
  error,
  notFound,
  forbidden,
  unauthorized,
  badRequest,
} from "../utils/apiResponse.js";

export const handleGalleryRoutes = async (req, res) => {
  const path = req.url;
  const method = req.method;
  const segments = path.split("/");

  try {

    if (path.startsWith("/api/painter/gallery/") && method === "GET") {
      const painterId = segments[segments.length - 1];
      req.params = { painterId };
      return await getPainterGallery(req, res);
    }

    if (path === "/api/painter/gallery" && method === "POST") {
      const user = authorize(req, ["painter", "admin"]);
      return await uploadToGallery(req, res, user);
    }

    if (path.startsWith("/api/painter/gallery/") && method === "PUT") {
      const itemId = segments[segments.length - 1];
      req.params = { itemId };
      const user = authorize(req, ["painter", "admin"]);
      return await updateGalleryItem(req, res, user);
    }

    if (path.startsWith("/api/painter/gallery/") && method === "DELETE") {
      const itemId = segments[segments.length - 1];
      req.params = { itemId };
      const user = authorize(req, ["painter", "admin"]);
      return await deleteGalleryItem(req, res, user);
    }

    // Route not found
    return notFound(req, res, "Gallery route");
  } catch (err) {
    console.error("Gallery Routes Error:", err.message);

    if (err.message === "Unauthorized" || err.message.includes("No token")) {
      return unauthorized(req, res, err.message);
    }
    if (err.message === "Access denied") {
      return forbidden(req, res, err.message);
    }
    return error(req, res, err.message, 500);
  }
};

export default handleGalleryRoutes;
