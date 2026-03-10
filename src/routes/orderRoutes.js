/**
 * Order Routes
 * Handles all order-related endpoints
 */
import {
  finalCheckoutTest,
  getAdminOrders,
  updateOrderStatus,
  collectPayment,
  getAdminOrderById,
} from "../controllers/orderController.js";
import { authorize } from "../middlewares/auth.js";
import { error, notFound, forbidden, unauthorized, badRequest } from "../utils/apiResponse.js";

export const handleOrderRoutes = async (req, res) => {
  const path = req.url;
  const method = req.method;
  const segments = path.split("/");

  try {
    // GET /admin/orders - Get all admin orders
    if (path.startsWith("/admin/orders") && method === "GET") {
      const id = segments[3];
      authorize(req, ["admin"]);
      
      if (!id) {
        return await getAdminOrders(req, res);
      }
      return await getAdminOrderById(req, res, id);
    }

    // PUT /admin/orders/:id - Update order status
    if (path.startsWith("/admin/orders/") && method === "PUT") {
      const id = segments[3];
      authorize(req, ["admin"]);
      return await updateOrderStatus(req, res, id);
    }

    // POST /checkout - Final checkout
    if (path === "/checkout" && method === "POST") {
      const decodedUser = authorize(req, ["user", "painter", "admin"]);
      return await finalCheckoutTest(req, res, decodedUser);
    }

    // POST /payments/collect - Collect payment (admin)
    if (path === "/payments/collect" && method === "POST") {
      authorize(req, ["admin"]);
      return await collectPayment(req, res);
    }

    // Route not found
    return notFound(req, res, "Order route");

  } catch (err) {
    console.error("Order Routes Error:", err.message);
    
    if (err.message === "Unauthorized" || err.message.includes("No token")) {
      return unauthorized(req, res, err.message);
    }
    if (err.message === "Access denied") {
      return forbidden(req, res, err.message);
    }
    return error(req, res, err.message, 500);
  }
};

export default handleOrderRoutes;
