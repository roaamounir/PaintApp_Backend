/**
 * Category Routes
 * Handles all category-related endpoints
 */
import {
  getAllCategories,
  createCategory,
  deleteCategory,
  updateCategory,
} from "../controllers/categoryController.js";
import { authorize } from "../middlewares/auth.js";
import { error, notFound, forbidden, unauthorized, badRequest } from "../utils/apiResponse.js";

export const handleCategoryRoutes = async (req, res) => {
  const path = req.url;
  const method = req.method;
  const segments = path.split("/");

  try {
    // GET /categories - Get all categories
    if (path === "/categories" && method === "GET") {
      return await getAllCategories(req, res);
    }

    // POST /categories - Create new category (admin only)
    if (path === "/categories" && method === "POST") {
      authorize(req, ["admin"]);
      return await createCategory(req, res);
    }

    // PUT /categories/:id - Update category
    if (path.startsWith("/categories/") && segments.length === 3 && method === "PUT") {
      const id = parseInt(segments[2]);
      authorize(req, ["admin"]);
      return await updateCategory(req, res, id);
    }

    // DELETE /categories/:id - Delete category
    if (path.startsWith("/categories/") && segments.length === 3 && method === "DELETE") {
      const id = parseInt(segments[2]);
      authorize(req, ["admin"]);
      return await deleteCategory(req, res, id);
    }

    // Route not found
    return notFound(req, res, "Category route");

  } catch (err) {
    console.error("Category Routes Error:", err.message);
    
    if (err.message === "Unauthorized" || err.message.includes("No token")) {
      return unauthorized(req, res, err.message);
    }
    if (err.message === "Access denied") {
      return forbidden(req, res, err.message);
    }
    return error(req, res, err.message, 500);
  }
};

export default handleCategoryRoutes;
