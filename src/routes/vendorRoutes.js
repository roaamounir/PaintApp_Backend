/**
 * Vendor Routes
 * Handles all vendor-related endpoints
 */

import {
  getAllVendors,
  approveWholesaleRequest,
  getAllPendingVendors,
  CreateWholesaleRequest,
  verifyVendorPayment,
  updateVendorProfile,
  processVendorPayout,
  getVendorById,
} from "../controllers/vendorController.js";

import { authorize } from "../middlewares/auth.js";

import {
  error,
  notFound,
  forbidden,
  unauthorized,
  badRequest,
} from "../utils/apiResponse.js";

export const handleVendorRoutes = async (req, res) => {
  const path = req.url.split("?")[0]; // remove query params
  const method = req.method;
  const segments = path.split("/");

  try {
    /* ==============================
       POST /vendors
       Create wholesale request
    ============================== */
    if (path === "/vendors" && method === "POST") {
      const decodedUser = authorize(req, ["admin", "user"]);
      return await CreateWholesaleRequest(req, res, decodedUser);
    }

    /* ==============================
       GET /vendors/pending
       Get pending vendors
    ============================== */
    if (path === "/vendors/pending" && method === "GET") {
      authorize(req, ["admin"]);
      return await getAllPendingVendors(req, res);
    }

    /* ==============================
       PUT /vendors/approve/:id
    ============================== */
    if (
      segments.length === 4 &&
      segments[1] === "vendors" &&
      segments[2] === "approve" &&
      method === "PUT"
    ) {
      const vendorId = segments[3];

      if (!vendorId || isNaN(Number(vendorId))) {
        return badRequest(req, res, "Invalid Vendor ID");
      }

      authorize(req, ["admin"]);
      return await approveWholesaleRequest(req, res, vendorId);
    }

    /* ==============================
       PUT /vendors/verify-payment/:id
    ============================== */
    if (
      segments.length === 4 &&
      segments[1] === "vendors" &&
      segments[2] === "verify-payment" &&
      method === "PUT"
    ) {
      const vendorId = segments[3];

      if (!vendorId || isNaN(Number(vendorId))) {
        return badRequest(req, res, "Invalid Vendor ID");
      }

      authorize(req, ["admin", "user"]);
      return await verifyVendorPayment(req, res, vendorId);
    }

    /* ==============================
       POST /vendors/:id/payout
    ============================== */
    if (
      segments.length === 4 &&
      segments[1] === "vendors" &&
      segments[3] === "payout" &&
      method === "POST"
    ) {
      const vendorId = segments[2];

      if (!vendorId || isNaN(Number(vendorId))) {
        return badRequest(req, res, "Invalid Vendor ID");
      }

      authorize(req, ["admin"]);
      return await processVendorPayout(req, res, vendorId);
    }

    /* ==============================
       GET /vendors/:id
    ============================== */
    if (
      segments.length === 3 &&
      segments[1] === "vendors" &&
      method === "GET" &&
      !isNaN(Number(segments[2]))
    ) {
      const vendorId = segments[2];
      return await getVendorById(req, res, vendorId);
    }

    /* ==============================
       PUT /vendors/:id
       Update vendor profile
    ============================== */
    if (
      segments.length === 3 &&
      segments[1] === "vendors" &&
      method === "PUT" &&
      !isNaN(Number(segments[2]))
    ) {
      const vendorId = segments[2];

      authorize(req, ["admin", "vendor"]);
      return await updateVendorProfile(req, res, vendorId);
    }

    /* ==============================
       GET /vendors
       Get all vendors
    ============================== */
    if (path === "/vendors" && method === "GET") {
      return await getAllVendors(req, res);
    }

    /* ==============================
       Route Not Found
    ============================== */
    return notFound(req, res, "Vendor route");
  } catch (err) {
    console.error("Vendor Routes Error:", err.message);

    if (err.message === "Unauthorized" || err.message.includes("No token")) {
      return unauthorized(req, res, err.message);
    }

    if (err.message === "Access denied") {
      return forbidden(req, res, err.message);
    }

    return error(req, res, err.message, 500);
  }
};

export default handleVendorRoutes;