import {
  signup,
  login,
  getAllUsers,
  updateUser,
  deleteUser,
  getAuditLogs,
  getUserById,
} from "../controllers/authController.js";
import { checkPermission } from "../middlewares/auth.js";
import prisma from "../prismaClient.js";
import { parseBody } from "../utils/bodyParser.js";
import { success, error, notFound, forbidden } from "../utils/apiResponse.js";

/**
 * Handle all authentication-related routes
 */
export const handleAuthRoutes = async (req, res) => {
  const { method, url } = req;
  const cleanUrl = url.split("?")[0];
  const parts = cleanUrl.split("/").filter(Boolean);

  try {
    // GET /users - Get all users
    if (method === "GET" && parts.length === 1 && parts[0] === "users") {
      return await getAllUsers(req, res);
    }

    // GET /users/:id - Get user by ID
    if (method === "GET" && parts.length === 2 && parts[0] === "users") {
      const id = parts[1];
      return await getUserById(req, res, id);
    }

    // POST /signup - User registration
    if (method === "POST" && parts[0] === "signup") {
      const body = await parseBody(req);
      return await signup(req, res, JSON.stringify(body));
    }

    // POST /login - User login
    if (method === "POST" && parts[0] === "login") {
      const body = await parseBody(req);
      return await login(req, res, JSON.stringify(body));
    }

    // PUT /users/:id - Update user
    if (method === "PUT" && parts.length === 2 && parts[0] === "users") {
      const id = parts[1];
      await checkPermission(req, prisma, "manage_users");
      const body = await parseBody(req);
      return await updateUser(req, res, id, JSON.stringify(body));
    }

    // DELETE /users/:id - Delete user
    if (method === "DELETE" && parts.length === 2 && parts[0] === "users") {
      const id = parts[1];
      await checkPermission(req, prisma, "manage_users");
      return await deleteUser(req, res, id);
    }

    // Route not found
    return notFound(req, res, `Route ${method} ${cleanUrl}`);

  } catch (err) {
    console.error("Auth Routes Error:", err.message);
    
    // Handle specific error types
    if (err.message.includes("Permission") || err.message.includes("الصلاحية")) {
      return forbidden(req, res, err.message);
    }
    
    return error(req, res, err.message, 500);
  }
};

export default handleAuthRoutes;
