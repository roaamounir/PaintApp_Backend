import http from "http";
import dotenv from "dotenv";
import { URL } from "url";

import "dotenv/config";

/* ===== Route Handlers ===== */
import { handleAuthRoutes } from "./routes/authRoutes.js";
import { handleProductRoutes } from "./routes/productRoutes.js";
import { handleVendorRoutes } from "./routes/vendorRoutes.js";
import { handlePainterRoutes } from "./routes/painterRoutes.js";
import { handleOrderRoutes } from "./routes/orderRoutes.js";
import { handleCategoryRoutes } from "./routes/categoryRoutes.js";
import { handleColorRoutes } from "./routes/colorRoutes.js";
import { handleCartRoutes } from "./routes/cartRoutes.js";
import { handleOfferRoutes } from "./routes/offerRoutes.js";
import { handleGalleryRoutes } from "./routes/galleryRoutes.js";
import { handleReviewRoutes } from "./routes/reviewRoutes.js";
import { handleWalletRoutes } from "./routes/walletRoutes.js";

/* ===== Controllers that need special handling ===== */
import { getAuditLogs, wholesaleSignup } from "./controllers/authController.js";
import {
  getSettings,
  updateSettings,
  uploadBanner,
  uploadLogo,
} from "./controllers/settingsController.js";
import { upload } from "./middlewares/upload.js";
import { authorize } from "./middlewares/auth.js";
import { paintCalculator } from "./controllers/serviceController.js";
import {
  getLowStockAlerts,
  getPaintAvailability,
} from "./controllers/productController.js";
import invoiceController from "./controllers/invoiceController.js";
import customerController from "./controllers/customerController.js";
import {
  getAllVisits,
  updateVisitStatus,
} from "./controllers/painterController.js";

dotenv.config();
const PORT = process.env.PORT || 5000;

/* ===== Central Route Dispatcher ===== */
/* ===== Central Route Dispatcher ===== */
const dispatchRoute = async (req, res, path, method) => {
  // Auth routes
  if (
    path.startsWith("/signup") ||
    path.startsWith("/login") ||
    path === "/users" ||
    path.startsWith("/users/")
  ) {
    await handleAuthRoutes(req, res);
    return true;
  }

  // Vendor routes
  if (path.startsWith("/vendors")) {
    await handleVendorRoutes(req, res);
    return true;
  }

  if (path.startsWith("/api/painter/gallery")) {
    await handleGalleryRoutes(req, res);
    return true;
  }
// 2. Review routes
if (path.startsWith("/painter-reviews") || path.startsWith("/api/painter-reviews")) {
  await handleReviewRoutes(req, res);
  return true;
}

// 3. Painter routes
if (path.startsWith("/painters") || path.startsWith("/api/admin/painters") || path.startsWith("/api/painter")) {
  await handlePainterRoutes(req, res);
  return true;
}
  // 2. Painter routes
  if (
    path.startsWith("/painters") ||
    path.startsWith("/api/admin/painters") ||
    path.startsWith("/api/painter")
  ) {
    await handlePainterRoutes(req, res);
    return true;
  }
  // Painter routes
  if (
    path.startsWith("/painters") ||
    path.startsWith("/api/admin/painters") ||
    path.startsWith("/api/painter")
  ) {
    await handlePainterRoutes(req, res);
    return true;
  }

  // Product/Paint routes
  if (path.startsWith("/paint") || path.startsWith("/paints")) {
    await handleProductRoutes(req, res);
    return true;
  }

  // Category routes
  if (path.startsWith("/categories")) {
    await handleCategoryRoutes(req, res);
    return true;
  }

  // Color routes
  if (
    path.startsWith("/colors") ||
    path.startsWith("/color-systems") ||
    path.startsWith("/services/convert")
  ) {
    await handleColorRoutes(req, res);
    return true;
  }

  // Cart routes
  if (path.startsWith("/cart")) {
    await handleCartRoutes(req, res);
    return true;
  }

  // Order routes
  if (
    path.startsWith("/admin/orders") ||
    path.startsWith("/checkout") ||
    path.startsWith("/payments")
  ) {
    await handleOrderRoutes(req, res);
    return true;
  }

  // Offer routes
  if (path.startsWith("/offers")) {
    await handleOfferRoutes(req, res);
    return true;
  }


  // Wallet routes
  if (path.startsWith("/wallet")) {
    await handleWalletRoutes(req, res);
    return true;
  }

  return false;
};

/* ===== Server ===== */
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const path = parsedUrl.pathname;
  const method = req.method;

  try {
    // Try to dispatch to route files first
    const routed = await dispatchRoute(req, res, path, method);
    if (routed) return;

    /* ================= SPECIAL ROUTES (Not in route files) ================= */

    // Wholesale signup
    if (path === "/signup/wholesale" && method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      return req.on("end", () => wholesaleSignup(req, res, body));
    }

    // Audit logs
    if (path === "/audit-logs" && method === "GET") {
      try {
        authorize(req, ["admin"]);
        return getAuditLogs(req, res);
      } catch (err) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "غير مسموح لك بالدخول" }));
      }
    }

    // Paint availability check
    if (path.startsWith("/paint/check/") && method === "GET") {
      const barcodeOrId = path.split("/")[3];
      req.params = { barcodeOrId };
      return getPaintAvailability(req, res);
    }

    // Low stock alerts
    if (path === "/paint/alerts/low-stock" && method === "GET") {
      authorize(req, ["admin", "vendor"]);
      return getLowStockAlerts(req, res);
    }

    // Admin visits
    if (path === "/admin/visits" && method === "GET") {
      authorize(req, ["admin"]);
      return getAllVisits(req, res);
    }

    if (path.startsWith("/admin/visits/") && method === "PUT") {
      const id = parseInt(path.split("/")[3]);
      authorize(req, ["admin"]);
      if (isNaN(id)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid Visit ID" }));
      }
      return updateVisitStatus(req, res, id);
    }

    // Service calculator
    if (path === "/services/calculate" && method === "POST") {
      return paintCalculator(req, res);
    }

    // Customers
    if (path === "/api/customers" && method === "GET") {
      authorize(req, ["admin"]);
      return customerController.getAllCustomers(req, res);
    }

    // Invoices
    if (path === "/api/invoices" && method === "GET") {
      authorize(req, ["admin"]);
      return invoiceController.getAllInvoices(req, res);
    }

    if (path.startsWith("/api/invoices/") && method === "GET") {
      const id = path.split("/")[3];
      authorize(req, ["admin"]);
      return invoiceController.getInvoiceById(req, res, id);
    }

    if (path === "/api/invoices" && method === "POST") {
      authorize(req, ["admin"]);
      return invoiceController.createInvoice(req, res);
    }

    // Settings
    if (path === "/api/settings" && method === "GET") {
      return getSettings(req, res);
    }

    if (path === "/api/settings/update" && method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      return req.on("end", () => {
        try {
          updateSettings(req, res, JSON.parse(body));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
    }

    if (path === "/api/settings/upload-banner" && method === "POST") {
      return upload.single("banner")(req, res, () => uploadBanner(req, res));
    }

    if (path === "/api/settings/upload-logo" && method === "POST") {
      return upload.single("logo")(req, res, () => uploadLogo(req, res));
    }

    // Color simulation routes
    if (path === "/api/admin/simulations" && method === "GET") {
      const { getAdminSimulations } =
        await import("./controllers/simulationController.js");
      authorize(req, ["admin"]);
      return getAdminSimulations(req, res);
    }

    if (path === "/api/admin/simulation-stats" && method === "GET") {
      const { getSimulationStats } =
        await import("./controllers/simulationController.js");
      authorize(req, ["admin"]);
      return getSimulationStats(req, res);
    }

    if (path === "/api/simulation/match" && method === "POST") {
      const { matchColor } =
        await import("./controllers/simulationController.js");
      return matchColor(req, res);
    }

    if (path === "/api/simulation/save" && method === "POST") {
      const { saveSimulation } =
        await import("./controllers/simulationController.js");
      const user = authorize(req, ["user", "painter", "admin", "vendor"]);
      return saveSimulation(req, res, user);
    }

    if (path.startsWith("/api/admin/simulations/") && method === "DELETE") {
      const { deleteSimulation } =
        await import("./controllers/simulationController.js");
      const user = authorize(req, ["admin", "user"]);
      return deleteSimulation(req, res, user);
    }

    // Default 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Route not found" }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
