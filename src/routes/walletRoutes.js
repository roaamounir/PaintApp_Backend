/**
 * Wallet Routes
 * Handles all wallet-related endpoints
 */
import { getVendorTransactions } from "../controllers/walletController.js";
import { authorize } from "../middlewares/auth.js";
import { error, notFound, forbidden, unauthorized, badRequest } from "../utils/apiResponse.js";

export const handleWalletRoutes = async (req, res) => {
  const path = req.url;
  const method = req.method;
  const segments = path.split("/");

  try {
    // GET /wallet/transactions/:userId - Get vendor transactions
    if (path.startsWith("/wallet/transactions/") && method === "GET") {
      const vendorIdFromUrl = segments[3];
      return await getVendorTransactions(req, res, vendorIdFromUrl);
    }

    // Route not found
    return notFound(req, res, "Wallet route");

  } catch (err) {
    console.error("Wallet Routes Error:", err.message);
    
    if (err.message === "Unauthorized" || err.message.includes("No token")) {
      return unauthorized(req, res, err.message);
    }
    if (err.message === "Access denied") {
      return forbidden(req, res, err.message);
    }
    return error(req, res, err.message, 500);
  }
};

export default handleWalletRoutes;
