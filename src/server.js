import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import url from "url";
import swaggerUiDist from "swagger-ui-dist";
import { handleAuthRoutes } from "./routes/authRoutes.js";
import { swaggerSpec } from "./swaggerConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
import { handleDashboardRoutes } from "./routes/dashboardRoutes.js";
import {
  createPaint,
  getAllPaints,
  getPaintById,
  updatePaint,
  deletePaint,
  exportPaintsToExcel,
  exportLowStockPaintsToExcel,
  importPaintsFromExcel,
  handleServicesCalculate,
} from "./controllers/productController.js";
import { upload } from "./middlewares/upload.js";
import { calculateRecommendedQuantity } from "./utils/calc.js";

import {
  createSelection,
  getAllSelections,
  updateSelection,
  deleteSelection,
} from "./controllers/selectionController.js";
import {
  getUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  getMeProfile,
  uploadUserAvatar,
  uploadUserAvatarById,
  uploadPaintImage,
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  getPendingVendorRequests,
  createWholesaleRequest,
  createVendorUpgradeRequest,
  getDesigners,
  getDesignerById,
  updateDesigner,
  deleteDesigner,
  getDesignerMe,
  updateDesignerMe,
  approveVendor,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  getColorSystems,
  getColors,
  handleServicesConvert,
  getAuditLogs,
  getApiCustomers,
  getApiInvoices,
  getMyOrders,
  getMyOrderById,
  getMyOfferNotifications,
  markOfferNotificationRead,
  markAllOfferNotificationsRead,
  getMyCart,
  getCartQuote,
  addCartItem,
  updateCartItemQuantity,
  removeCartItem,
  checkoutCart,
  getPaymentMethods,
  getPainters,
  getPainterById,
  getPainterMe,
  updatePainterMe,
  addPainterGalleryImage,
  addPainterGalleryImageForPainter,
  updatePainterGalleryImage,
  deletePainterGalleryImage,
  createPainter,
  updatePainter,
  deletePainter,
  getPainterFinancial,
  getPainterReviews,
  createPainterReview,
  deletePainterReview,
  getAdminOrders,
  getAdminOrderById,
  updateAdminOrder,
  getAdminVisits,
  getAdminVisitById,
  updateAdminVisit,
  getAdminSimulations,
  deleteAdminSimulation,
} from "./controllers/dashboardApiController.js";
import {
  getDesigns,
  getDesignById,
  createDesign,
  updateDesign,
  deleteDesign,
  getDesignComments,
  addDesignComment,
  deleteDesignComment,
  toggleDesignFavorite,
  getDesignRequests,
  createDesignRequest,
  updateDesignRequestStatus,
  getDesignShareLink,
  getDesignFavoriteStatus,
} from "./controllers/designController.js";
import {
  createVisitRequest,
  getVisitRequests,
  getVisitRequestById,
  updateVisitRequestStatus,
} from "./controllers/visitRequestController.js";
import { authorize } from "./utils/auth.js";

const PORT = 5000;
const swaggerUiPath = swaggerUiDist.getAbsoluteFSPath();

// CORS: allow frontend (Vite default 5173, etc.) to call the API
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const setCors = (res) => {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
};
// Ensure CORS is sent with every response (writeHead merges with existing setHeader)
const wrapResWriteHead = (res) => {
  const orig = res.writeHead.bind(res);
  res.writeHead = function (code, headers = {}) {
    return orig(code, { ...corsHeaders, ...headers });
  };
};
const server = http.createServer(async (req, res) => {
  setCors(res);
  wrapResWriteHead(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  let pathname = (parsedUrl.pathname || "/").trim().replace(/\/+/g, "/");
  if (pathname.endsWith("/") && pathname.length > 1) pathname = pathname.slice(0, -1);
  if (!pathname) pathname = "/";
  const method = req.method;

  // ===== Auth routes =====
  if (
    pathname === "/signup" ||
    pathname === "/api/signup" ||
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/auth/forgot-password/otp" ||
    pathname === "/api/auth/forgot-password/otp" ||
    pathname === "/auth/forgot-password/verify-otp" ||
    pathname === "/api/auth/forgot-password/verify-otp" ||
    pathname === "/auth/forgot-password/reset" ||
    pathname === "/api/auth/forgot-password/reset"
  ) {
    return handleAuthRoutes(req, res, pathname);
  }

  // ===== Painter Reviews أولاً (لتجنب 404) =====
  if (method === "GET" && (pathname === "/painter-reviews" || pathname === "/api/painter-reviews")) {
    return getPainterReviews(req, res);
  }
  if (method === "POST" && (pathname === "/painter-reviews" || pathname === "/api/painter-reviews")) {
    return createPainterReview(req, res);
  }
  if (method === "DELETE" && (pathname.startsWith("/painter-reviews/") || pathname.startsWith("/api/painter-reviews/"))) {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[2] : parts[1];
    return deletePainterReview(req, res, id);
  }

  // ===== صحّة السيرفر (تحقق أن الكود محدّث) =====
  if (pathname === "/api/ping" && method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, routes: "users,paints,painters,painter-reviews,admin/orders,admin/visits,vendors,categories,offers,colors,audit-logs,api/customers,api/invoices,payment-methods,checkout" }));
  }

  // ===== OpenAPI / Swagger Docs =====
  if ((pathname === "/openapi.json" || pathname === "/api/openapi.json") && method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(swaggerSpec));
  }
  if ((pathname === "/api-docs" || pathname === "/api-docs/") && method === "GET") {
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Paint App API Docs</title>
  <link rel="stylesheet" href="/api-docs/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api-docs/swagger-ui-bundle.js"></script>
  <script src="/api-docs/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(html);
  }
  if (pathname.startsWith("/api-docs/") && method === "GET") {
    const rel = pathname.slice("/api-docs/".length);
    if (!rel || rel.includes("..") || path.isAbsolute(rel)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid docs asset path" }));
    }
    const filePath = path.join(swaggerUiPath, rel);
    if (!filePath.startsWith(swaggerUiPath)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Forbidden" }));
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Docs asset not found" }));
      }
      const ext = path.extname(filePath).toLowerCase();
      const types = {
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".html": "text/html; charset=utf-8",
      };
      res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
      res.end(data);
    });
    return;
  }

  // ===== الملفات المرفوعة (GET /uploads/...) =====
  if (method === "GET" && pathname.startsWith("/uploads/")) {
    const uploadsRoot = path.join(__dirname, "..", "uploads");
    const rel = pathname.slice("/uploads/".length);
    if (!rel || rel.includes("..") || path.isAbsolute(rel)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid path" }));
    }
    const filePath = path.join(uploadsRoot, rel);
    if (!filePath.startsWith(uploadsRoot)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Forbidden" }));
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Not found" }));
      }
      const ext = path.extname(filePath).toLowerCase();
      const types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
      };
      res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
      res.end(data);
    });
    return;
  }

  // ===== المستخدم الحالي (قبل /users/:id) =====
  if (pathname === "/users/me" || pathname === "/api/users/me") {
    if (method === "GET") return getMeProfile(req, res);
  }
  if (pathname === "/users/me/avatar" || pathname === "/api/users/me/avatar") {
    if (method === "POST") {
      return upload.single("avatar")(req, res, () => uploadUserAvatar(req, res));
    }
  }

  // ===== Cart + Checkout =====
  if ((pathname === "/cart" || pathname === "/api/cart") && method === "GET") {
    return getMyCart(req, res);
  }
  if ((pathname === "/cart/quote" || pathname === "/api/cart/quote") && method === "POST") {
    return getCartQuote(req, res);
  }
  if (
    (pathname === "/cart/items" || pathname === "/api/cart/items") &&
    method === "POST"
  ) {
    return addCartItem(req, res);
  }
  if (
    pathname.startsWith("/cart/items/") ||
    pathname.startsWith("/api/cart/items/")
  ) {
    const parts = pathname.split("/").filter(Boolean);
    const base = parts[0] === "api" ? 1 : 0;
    const itemId = parts[base + 2];
    if (!itemId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Missing cart item id" }));
    }
    if (method === "PATCH" || method === "PUT")
      return updateCartItemQuantity(req, res, itemId);
    if (method === "DELETE") return removeCartItem(req, res, itemId);
  }
  if (
    (pathname === "/payment-methods" || pathname === "/api/payment-methods") &&
    method === "GET"
  ) {
    return getPaymentMethods(req, res);
  }
  if ((pathname === "/checkout" || pathname === "/api/checkout") && method === "POST") {
    return checkoutCart(req, res);
  }

  // ===== طلبات المستخدم وفاتورة كل طلب (JWT) =====
  if ((pathname === "/orders" || pathname === "/api/orders") && method === "GET") {
    return getMyOrders(req, res);
  }
  if ((pathname === "/notifications/offers" || pathname === "/api/notifications/offers") && method === "GET") {
    return getMyOfferNotifications(req, res);
  }
  if (
    (pathname === "/notifications/offers/read-all" || pathname === "/api/notifications/offers/read-all") &&
    (method === "PATCH" || method === "PUT")
  ) {
    return markAllOfferNotificationsRead(req, res);
  }
  if (
    (pathname.startsWith("/notifications/offers/") || pathname.startsWith("/api/notifications/offers/")) &&
    (method === "PATCH" || method === "PUT")
  ) {
    const parts = pathname.split("/").filter(Boolean);
    const base = parts[0] === "api" ? 1 : 0;
    const id = parts[base + 2];
    const action = parts[base + 3];
    if (id && action === "read") return markOfferNotificationRead(req, res, id);
  }
  if (
    (pathname.startsWith("/orders/") || pathname.startsWith("/api/orders/")) &&
    method === "GET"
  ) {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[2] : parts[1];
    if (id) return getMyOrderById(req, res, id);
  }

  // ===== Users (قائمة المستخدمين) — يدعم /users و /api/users =====
  if ((pathname === "/users" || pathname === "/api/users") && method === "GET") return getUsers(req, res);
  if (pathname.startsWith("/users/") || pathname.startsWith("/api/users/")) {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[2] : parts[1];
    const sub = parts[0] === "api" ? parts[3] : parts[2];
    if (sub === "avatar" && method === "POST") {
      return upload.single("avatar")(req, res, () => uploadUserAvatarById(req, res, id));
    }
    if (method === "GET") return getUserById(req, res, id);
    if (method === "PUT") return updateUserById(req, res, id);
    if (method === "DELETE") return deleteUserById(req, res, id);
  }

  // ===== Admin: orders & visits (بدون أو مع بادئة /api) =====
  if ((pathname === "/admin/orders" || pathname === "/api/admin/orders") && method === "GET") {
    return getAdminOrders(req, res).catch((err) => {
      console.error("[server] getAdminOrders", err?.message);
      if (!res.headersSent) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
      }
    });
  }
  if ((pathname.startsWith("/admin/orders/") || pathname.startsWith("/api/admin/orders/")) && method === "GET") {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[3] : parts[2];
    return getAdminOrderById(req, res, id);
  }
  if ((pathname.startsWith("/admin/orders/") || pathname.startsWith("/api/admin/orders/")) && method === "PUT") {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[3] : parts[2];
    return updateAdminOrder(req, res, id);
  }
  if ((pathname === "/admin/visits" || pathname === "/api/admin/visits") && method === "GET") return getAdminVisits(req, res);
  if ((pathname.startsWith("/admin/visits/") || pathname.startsWith("/api/admin/visits/")) && method === "GET") {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[3] : parts[2];
    return getAdminVisitById(req, res, id);
  }
  if ((pathname.startsWith("/admin/visits/") || pathname.startsWith("/api/admin/visits/")) && method === "PUT") {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[3] : parts[2];
    return updateAdminVisit(req, res, id);
  }

  // ===== طلبات الموردين (قيد الانتظار) — قبل /vendors =====
  if ((pathname === "/vendor-requests" || pathname === "/api/vendor-requests") && method === "GET")
    return getPendingVendorRequests(req, res);
  if ((pathname === "/vendor-requests" || pathname === "/api/vendor-requests") && method === "POST")
    return createVendorUpgradeRequest(req, res);
  if ((pathname === "/wholesale-requests" || pathname === "/api/wholesale-requests") && method === "POST")
    return createWholesaleRequest(req, res);

  // ===== Painters (الفنيون، بدون أو مع بادئة /api) — /painters/me قبل :id =====
  if ((pathname === "/painters" || pathname === "/api/painters") && method === "GET") return getPainters(req, res);
  if ((pathname === "/painters" || pathname === "/api/painters") && method === "POST") return createPainter(req, res);
  if (
    (pathname === "/painters/me" || pathname === "/api/painters/me") &&
    method === "GET"
  ) {
    return getPainterMe(req, res);
  }
  if (
    (pathname === "/painters/me" || pathname === "/api/painters/me") &&
    method === "PUT"
  ) {
    return updatePainterMe(req, res);
  }
  if (
    (pathname === "/painters/me/gallery" || pathname === "/api/painters/me/gallery") &&
    method === "POST"
  ) {
    return upload.single("image")(req, res, () => addPainterGalleryImage(req, res));
  }
  if (
    pathname.startsWith("/painters/me/gallery/") ||
    pathname.startsWith("/api/painters/me/gallery/")
  ) {
    const parts = pathname.split("/").filter(Boolean);
    const base = parts[0] === "api" ? 1 : 0;
    const galleryId = parts[base + 3];
    if (method === "DELETE" && galleryId) {
      return deletePainterGalleryImage(req, res, galleryId);
    }
  }
  if (
    pathname.startsWith("/painters/gallery/") ||
    pathname.startsWith("/api/painters/gallery/")
  ) {
    const parts = pathname.split("/").filter(Boolean);
    const base = parts[0] === "api" ? 1 : 0;
    const galleryId = parts[base + 2];
    if (method === "DELETE" && galleryId) {
      return deletePainterGalleryImage(req, res, galleryId);
    }
    if ((method === "PUT" || method === "PATCH") && galleryId) {
      return upload.single("image")(req, res, () =>
        updatePainterGalleryImage(req, res, galleryId)
      );
    }
  }
  if (pathname.startsWith("/painters/") || pathname.startsWith("/api/painters/")) {
    const parts = pathname.split("/").filter(Boolean);
    const base = parts[0] === "api" ? 1 : 0;
    const id = parts[base + 1];
    const sub = parts[base + 2];
    if (sub === "gallery" && method === "POST") {
      return upload.single("image")(req, res, () =>
        addPainterGalleryImageForPainter(req, res, id)
      );
    }
    if (sub === "financial" && method === "GET")
      return getPainterFinancial(req, res, id);
    if (sub === "status" && method === "PUT")
      return updatePainter(req, res, id);
    if (method === "GET") return getPainterById(req, res, id);
    if (method === "PUT") return updatePainter(req, res, id);
    if (method === "DELETE") return deletePainter(req, res, id);
  }

  // ===== Dashboard routes (محددة فقط: /admin/dashboard, /painter/dashboard, /user/dashboard) =====
  if (
    pathname === "/admin/dashboard" ||
    pathname === "/painter/dashboard" ||
    pathname === "/user/dashboard"
  ) {
    return handleDashboardRoutes(req, res);
  }

  // ===== Paint routes (الداشبورد يستدعي /paints) =====
  if ((pathname === "/paint/image" || pathname === "/api/paint/image") && method === "POST") {
    try {
      authorize(req, ["admin"]);
      return upload.single("image")(req, res, () => uploadPaintImage(req, res));
    } catch (err) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  if (
    (pathname === "/paint" ||
      pathname === "/paints" ||
      pathname === "/api/paint" ||
      pathname === "/api/paints") &&
    method === "GET"
  ) {
    return getAllPaints(req, res).catch((err) => {
      console.error("[server] getAllPaints", err?.message);
      if (!res.headersSent) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
      }
    });
  }

  if ((pathname === "/paint" || pathname === "/api/paint") && method === "POST") {
    try {
      authorize(req, ["admin"]);
      return await createPaint(req, res);
    } catch (err) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  if ((pathname === "/paint/export" || pathname === "/api/paint/export") && method === "GET")
    return await exportPaintsToExcel(res);

  if (
    (pathname === "/paint/export-low-stock" || pathname === "/api/paint/export-low-stock") &&
    method === "GET"
  )
    return await exportLowStockPaintsToExcel(res);

  if ((pathname === "/paint/import" || pathname === "/api/paint/import") && method === "POST") {
    try {
      authorize(req, ["admin"]);
    } catch (err) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: err.message }));
    }
    return upload.single("file")(req, res, () =>
      importPaintsFromExcel(req, res),
    );
  }

  if (pathname.startsWith("/paint/") || pathname.startsWith("/api/paint/")) {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[2] : parts[1];
    if (!id || !id.trim()) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid paint id" }));
    }

    if (method === "GET") {
      return getPaintById(req, res, id).catch((err) => {
        console.error("[server] getPaintById", err?.message);
        if (!res.headersSent) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Paint not found" }));
        }
      });
    }

    if (method === "PUT") {
      try {
        authorize(req, ["admin"]);
        return updatePaint(req, res, id);
      } catch (err) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    if (method === "DELETE") {
      try {
        authorize(req, ["admin"]);
        return deletePaint(req, res, id);
      } catch (err) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }
  }

  // ===== Selections Routes =====
  if (pathname === "/selections" && method === "POST") {
    return createSelection(req, res);
  }

  if (pathname === "/selections" && method === "GET") {
    return getAllSelections(req, res);
  }

  if (pathname.startsWith("/selections/") && method === "PUT") {
    const id = pathname.split("/")[2];
    return updateSelection(req, res, id);
  }

  if (pathname.startsWith("/selections/") && method === "DELETE") {
    const id = pathname.split("/")[2];
    return deleteSelection(req, res, id);
  }

  // ===== Vendors =====
  if (pathname === "/vendors" && method === "GET") return getVendors(req, res);
  if (pathname === "/vendors" && method === "POST") return createVendor(req, res);
  if (pathname.startsWith("/vendors/")) {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[1];
    if (parts[1] === "approve" && parts[2] && method === "PUT")
      return approveVendor(req, res, parts[2]);
    if (parts[2] === "payout" && method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Payout recorded" }));
    }
    if (method === "GET") return getVendorById(req, res, id);
    if (method === "PUT") return updateVendor(req, res, id);
    if (method === "DELETE") return deleteVendor(req, res, id);
  }

  // ===== Designers (لوحة التحكم) — /designers/me قبل :userId =====
  if ((pathname === "/designers" || pathname === "/api/designers") && method === "GET") {
    return getDesigners(req, res);
  }
  if (
    (pathname === "/designers/me" || pathname === "/api/designers/me") &&
    method === "GET"
  ) {
    return getDesignerMe(req, res);
  }
  if (
    (pathname === "/designers/me" || pathname === "/api/designers/me") &&
    method === "PUT"
  ) {
    return updateDesignerMe(req, res);
  }
  if (
    pathname.startsWith("/designers/") ||
    pathname.startsWith("/api/designers/")
  ) {
    const parts = pathname.split("/").filter(Boolean);
    const base = parts[0] === "api" ? 1 : 0;
    const userId = parts[base + 1];
    if (!userId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Missing designer id" }));
    }
    if (method === "GET") return getDesignerById(req, res, userId);
    if (method === "PUT") return updateDesigner(req, res, userId);
    if (method === "DELETE") return deleteDesigner(req, res, userId);
  }

  // ===== Categories =====
  if ((pathname === "/categories" || pathname === "/api/categories") && method === "GET")
    return getCategories(req, res);
  if ((pathname === "/categories" || pathname === "/api/categories") && method === "POST")
    return createCategory(req, res);
  if (
    (pathname.startsWith("/categories/") || pathname.startsWith("/api/categories/")) &&
    method === "PUT"
  ) {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[2] : parts[1];
    return updateCategory(req, res, id);
  }
  if (
    (pathname.startsWith("/categories/") || pathname.startsWith("/api/categories/")) &&
    method === "DELETE"
  ) {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[2] : parts[1];
    return deleteCategory(req, res, id);
  }

  // ===== Offers =====
  if ((pathname === "/offers" || pathname === "/api/offers") && method === "GET")
    return getOffers(req, res);
  if ((pathname === "/offers" || pathname === "/api/offers") && method === "POST")
    return createOffer(req, res);
  if ((pathname === "/coupons" || pathname === "/api/coupons") && method === "GET")
    return getOffers(req, res);
  if ((pathname === "/coupons" || pathname === "/api/coupons") && method === "POST")
    return createOffer(req, res);
  if (pathname.startsWith("/offers/") || pathname.startsWith("/api/offers/")) {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[2] : parts[1];
    if (method === "PATCH" || method === "PUT") return updateOffer(req, res, id);
    if (method === "DELETE") return deleteOffer(req, res, id);
  }
  if (pathname.startsWith("/coupons/") || pathname.startsWith("/api/coupons/")) {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[2] : parts[1];
    if (method === "PATCH" || method === "PUT") return updateOffer(req, res, id);
    if (method === "DELETE") return deleteOffer(req, res, id);
  }

  // ===== Color systems & Colors =====
  if (pathname === "/color-systems" && method === "GET")
    return getColorSystems(req, res);
  if (pathname === "/colors" && method === "GET") return getColors(req, res);

  // ===== Audit logs =====
  if (pathname === "/audit-logs" && method === "GET") {
    return getAuditLogs(req, res).catch((err) => {
      console.error("[server] getAuditLogs", err?.message);
      if (!res.headersSent) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
      }
    });
  }

  // ===== API: customers & invoices (للداشبورد) =====
  if (pathname === "/api/customers" && method === "GET")
    return getApiCustomers(req, res);
  if (pathname === "/api/invoices" && method === "GET")
    return getApiInvoices(req, res);

  // ===== API: verify painter =====
  if (pathname.startsWith("/api/admin/painters/verify/") && method === "PATCH") {
    const id = pathname.split("/").filter(Boolean).pop();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ success: true, message: "Painter verified" }));
  }

  // ===== API: admin simulations =====
  if (pathname === "/api/admin/simulations" && method === "GET") return getAdminSimulations(req, res);
  if (pathname.startsWith("/api/admin/simulations/") && method === "DELETE") {
    const id = pathname.split("/").filter(Boolean).pop();
    return deleteAdminSimulation(req, res, id);
  }

  // ===== حاسبة الطلاء (Services) =====
  if ((pathname === "/services/calculate" || pathname === "/api/services/calculate") && method === "POST") {
    return handleServicesCalculate(req, res);
  }
  if ((pathname === "/services/convert" || pathname === "/api/services/convert") && method === "POST") {
    return handleServicesConvert(req, res);
  }

  // ===== Designs (المصمم + التصاميم) =====
  if ((pathname === "/designs/image" || pathname === "/api/designs/image") && method === "POST") {
    try {
      authorize(req, ["admin", "designer"]);
      return upload.single("image")(req, res, () => uploadPaintImage(req, res));
    } catch (err) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  const designBaseMatch = pathname.match(/^\/(?:api\/)?designs\/?$/);
  const designIdMatch = pathname.match(/^\/(?:api\/)?designs\/([^/]+)\/?$/);
  const designSubMatch = pathname.match(/^\/(?:api\/)?designs\/([^/]+)\/(comments|favorite|requests|share)\/?$/);
  const designCommentIdMatch = pathname.match(/^\/(?:api\/)?designs\/([^/]+)\/comments\/([^/]+)\/?$/);

  if (designBaseMatch && method === "GET") {
    return getDesigns(req, res, parsedUrl.query || {});
  }
  if (designBaseMatch && method === "POST") {
    return createDesign(req, res);
  }
  const designRequestStatusMatch = pathname.match(
    /^\/(?:api\/)?designs\/([^/]+)\/requests\/([^/]+)\/status\/?$/
  );
  if (designRequestStatusMatch && method === "PUT") {
    return updateDesignRequestStatus(
      req,
      res,
      designRequestStatusMatch[1],
      designRequestStatusMatch[2]
    );
  }
  if (designIdMatch) {
    const id = designIdMatch[1];
    if (method === "GET") return getDesignById(req, res, id);
    if (method === "PUT") return updateDesign(req, res, id);
    if (method === "DELETE") return deleteDesign(req, res, id);
  }
  if (designSubMatch) {
    const id = designSubMatch[1];
    const sub = designSubMatch[2];
    if (sub === "comments" && method === "GET") return getDesignComments(req, res, id);
    if (sub === "comments" && method === "POST") return addDesignComment(req, res, id);
    if (sub === "favorite" && method === "GET") return getDesignFavoriteStatus(req, res, id);
    if (sub === "favorite" && method === "POST") return toggleDesignFavorite(req, res, id);
    if (sub === "requests" && method === "GET") return getDesignRequests(req, res, id);
    if (sub === "requests" && method === "POST") return createDesignRequest(req, res, id);
    if (sub === "share" && method === "GET") return getDesignShareLink(req, res, id);
  }
  if (designCommentIdMatch && method === "DELETE") {
    return deleteDesignComment(req, res, designCommentIdMatch[1], designCommentIdMatch[2]);
  }

  // ===== طلبات الفني/الزيارة =====
  // يدعم المسارين: /visit-requests (القديم) و /painter-requests (alias جديد)
  const visitReqBase = /^\/(?:api\/)?(?:visit-requests|painter-requests)\/?$/;
  const visitReqId = /^\/(?:api\/)?(?:visit-requests|painter-requests)\/([^/]+)\/?$/;
  const visitReqStatus = /^\/(?:api\/)?(?:visit-requests|painter-requests)\/([^/]+)\/status\/?$/;
  if (visitReqBase.test(pathname) && method === "POST") return createVisitRequest(req, res);
  if (visitReqBase.test(pathname) && method === "GET") return getVisitRequests(req, res, parsedUrl.query || {});
  if (visitReqStatus.test(pathname) && method === "PUT") {
    const id = pathname.match(visitReqStatus)[1];
    return updateVisitRequestStatus(req, res, id);
  }
  if (visitReqId.test(pathname) && method === "GET") {
    const id = pathname.match(visitReqId)[1];
    return getVisitRequestById(req, res, id);
  }

  // ===== Test calc route =====
  if (pathname === "/selections/test" && method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);

        const recommendedQuantity = calculateRecommendedQuantity(
          {
            area: data.area,
            length: data.length,
            width: data.width,
            height: data.height,
          },
          data.paint,
        );

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ recommendedQuantity })); // <--- return
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: err.message })); // <--- return
      }
    });
    return;
  }

  // ===== Default 404 =====
  console.warn("[404]", method, pathname);
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Route not found", path: pathname }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Project root:", path.join(__dirname, ".."));
  console.log("Dashboard API: /users, /paints, /painters, /painter-reviews, /admin/orders, /admin/visits, /vendors, /categories, /offers, /colors, /audit-logs, /api/customers, /api/invoices");
});
