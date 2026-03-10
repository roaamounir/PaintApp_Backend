/**
 * Offer Routes
 * Handles all offer-related endpoints
 */
import {
  getAllOffers,
  createOffer,
  deleteOffer,
  toggleOfferStatus,
} from "../controllers/offerController.js";
import { authorize } from "../middlewares/auth.js";
import { error, notFound, forbidden, unauthorized, badRequest } from "../utils/apiResponse.js";

export const handleOfferRoutes = async (req, res) => {
  const path = req.url;
  const method = req.method;
  const segments = path.split("/");

  try {
    // GET /offers - Get all offers
    if (path === "/offers" && method === "GET") {
      return await getAllOffers(req, res);
    }

    // POST /offers - Create new offer (admin only)
    if (path === "/offers" && method === "POST") {
      authorize(req, ["admin"]);
      return await createOffer(req, res);
    }

    // DELETE /offers/:id - Delete offer
    if (path.startsWith("/offers/") && segments.length === 3 && method === "DELETE") {
      const id = segments[2];
      authorize(req, ["admin"]);
      return await deleteOffer(req, res, id);
    }

    // PATCH /offers/:id - Toggle offer status
    if (path.startsWith("/offers/") && segments.length === 3 && method === "PATCH") {
      const id = segments[2];
      authorize(req, ["admin"]);
      return await toggleOfferStatus(req, res, id);
    }

    // Route not found
    return notFound(req, res, "Offer route");

  } catch (err) {
    console.error("Offer Routes Error:", err.message);
    
    if (err.message === "Unauthorized" || err.message.includes("No token")) {
      return unauthorized(req, res, err.message);
    }
    if (err.message === "Access denied") {
      return forbidden(req, res, err.message);
    }
    return error(req, res, err.message, 500);
  }
};

export default handleOfferRoutes;
