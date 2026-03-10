/**
 * Color Routes
 * Handles all color-related endpoints
 */
import {
  getAllColors,
  toggleFavorite,
  getColorCompatibility,
  getAllColorSystems,
  createColor,
  updateColor,
  deleteColor,
  convertColor,
} from "../controllers/colorController.js";
import { authorize } from "../middlewares/auth.js";
import {
  error,
  notFound,
  forbidden,
  unauthorized,
  badRequest,
} from "../utils/apiResponse.js";

export const handleColorRoutes = async (req, res) => {
  const path = req.url;
  const method = req.method;
  const segments = path.split("/");

  try {
    // POST /colors/favorite - Toggle favorite
    if (path === "/colors/favorite" && method === "POST") {
      const user = authorize(req, ["user", "painter", "admin", "vendor"]);
      return await toggleFavorite(req, res, user);
    }

    // GET /colors/compatibility/:colorId - Get color compatibility
    if (path.startsWith("/colors/compatibility/") && method === "GET") {
      const colorId = segments[3];
      return await getColorCompatibility(req, res, colorId);
    }

    // GET /color-systems - Get all color systems
    if (path === "/color-systems" && method === "GET") {
      return await getAllColorSystems(req, res);
    }

    // GET /colors - Get all colors
    if (path.startsWith("/colors") && method === "GET") {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

      return await getAllColors(req, res, parsedUrl);
    }

    // POST /colors - Create new color (admin only)
    if (path === "/colors" && method === "POST") {
      authorize(req, ["admin"]);
      return await createColor(req, res);
    }

    // PUT /colors/:id - Update color
    if (
      path.startsWith("/colors/") &&
      segments.length === 3 &&
      method === "PUT"
    ) {
      const id = segments[2];
      authorize(req, ["admin"]);
      return await updateColor(req, res, id);
    }

    // DELETE /colors/:id - Delete color
    if (
      path.startsWith("/colors/") &&
      segments.length === 3 &&
      method === "DELETE"
    ) {
      const id = segments[2];
      authorize(req, ["admin"]);
      return await deleteColor(req, res, id);
    }

    // POST /services/convert - Convert color
    if (path === "/services/convert" && method === "POST") {
      return await convertColor(req, res);
    }

    // Route not found
    return notFound(req, res, "Color route");
  } catch (err) {
    console.error("Color Routes Error:", err.message);

    if (err.message === "Unauthorized" || err.message.includes("No token")) {
      return unauthorized(req, res, err.message);
    }
    if (err.message === "Access denied") {
      return forbidden(req, res, err.message);
    }
    return error(req, res, err.message, 500);
  }
};

export default handleColorRoutes;
