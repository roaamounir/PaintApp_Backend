/**
 * Cart Routes
 * Handles all cart-related endpoints
 */
import {
  addToCart,
  getMyCart,
  removeFromCart,
} from "../controllers/cartController.js";
import { authorize } from "../middlewares/auth.js";
import { error, notFound, forbidden, unauthorized, badRequest } from "../utils/apiResponse.js";

export const handleCartRoutes = async (req, res) => {
  const path = req.url;
  const method = req.method;
  const segments = path.split("/");

  try {
    // GET /cart - Get user's cart
    if (path === "/cart" && method === "GET") {
      const user = authorize(req, ["user", "painter"]);
      return await getMyCart(req, res, user);
    }

    // POST /cart - Add item to cart
    if (path === "/cart" && method === "POST") {
      const user = authorize(req, ["user", "painter"]);
      return await addToCart(req, res, user);
    }

    // DELETE /cart/:paintId - Remove item from cart
    if (path.startsWith("/cart/") && method === "DELETE") {
      const paintId = segments[2];
      const user = authorize(req, ["user", "painter"]);
      return await removeFromCart(req, res, user, paintId);
    }

    // Route not found
    return notFound(req, res, "Cart route");

  } catch (err) {
    console.error("Cart Routes Error:", err.message);
    
    if (err.message === "Unauthorized" || err.message.includes("No token")) {
      return unauthorized(req, res, err.message);
    }
    if (err.message === "Access denied") {
      return forbidden(req, res, err.message);
    }
    return error(req, res, err.message, 500);
  }
};

export default handleCartRoutes;
