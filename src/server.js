import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import url from "url";
import { handleAuthRoutes } from "./routes/authRoutes.js";

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
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  getPendingVendorRequests,
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
  getPainters,
  getPainterById,
  createPainter,
  updatePainter,
  deletePainter,
  getPainterFinancial,
  getPainterReviews,
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
  if (pathname.startsWith("/signup") || pathname.startsWith("/login")) {
    return handleAuthRoutes(req, res);
  }

  // ===== Painter Reviews أولاً (لتجنب 404) =====
  if (method === "GET" && (pathname === "/painter-reviews" || pathname === "/api/painter-reviews")) {
    return getPainterReviews(req, res);
  }
  if (method === "DELETE" && (pathname.startsWith("/painter-reviews/") || pathname.startsWith("/api/painter-reviews/"))) {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[2] : parts[1];
    return deletePainterReview(req, res, id);
  }

  // ===== صحّة السيرفر (تحقق أن الكود محدّث) =====
  if (pathname === "/api/ping" && method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, routes: "users,paints,painters,painter-reviews,admin/orders,admin/visits,vendors,categories,offers,colors,audit-logs,api/customers,api/invoices" }));
  }

  // ===== Users (قائمة المستخدمين) — يدعم /users و /api/users =====
  if ((pathname === "/users" || pathname === "/api/users") && method === "GET") return getUsers(req, res);
  if (pathname.startsWith("/users/") || pathname.startsWith("/api/users/")) {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "api" ? parts[2] : parts[1];
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

  // ===== Painters (الفنيون، بدون أو مع بادئة /api) =====
  if ((pathname === "/painters" || pathname === "/api/painters") && method === "GET") return getPainters(req, res);
  if ((pathname === "/painters" || pathname === "/api/painters") && method === "POST") return createPainter(req, res);
  if (pathname.startsWith("/painters/") || pathname.startsWith("/api/painters/")) {
    const parts = pathname.split("/").filter(Boolean);
    const base = parts[0] === "api" ? 1 : 0;
    const id = parts[base + 1];
    const sub = parts[base + 2];
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
  if ((pathname === "/paint" || pathname === "/paints") && method === "GET") {
    return getAllPaints(req, res).catch((err) => {
      console.error("[server] getAllPaints", err?.message);
      if (!res.headersSent) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([]));
      }
    });
  }

  if (pathname === "/paint" && method === "POST") {
    try {
      authorize(req, ["admin", "vendor"]);
      return await createPaint(req, res);
    } catch (err) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  if (pathname === "/paint/export" && method === "GET")
    return await exportPaintsToExcel(res);

  if (pathname === "/paint/export-low-stock" && method === "GET")
    return await exportLowStockPaintsToExcel(res);

  if (pathname === "/paint/import" && method === "POST") {
    return upload.single("file")(req, res, () =>
      importPaintsFromExcel(req, res),
    );
  }

  if (pathname.startsWith("/paint/")) {
    const id = pathname.split("/")[2];
    if (isNaN(Number(id))) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid paint id" }));
    }

    if (method === "GET") {
      return getPaintById(req, res, Number(id)).catch((err) => {
        console.error("[server] getPaintById", err?.message);
        if (!res.headersSent) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Paint not found" }));
        }
      });
    }

    if (method === "PUT") {
      try {
        authorize(req, ["admin", "vendor"]);
        return updatePaint(req, res, id);
      } catch (err) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    if (method === "DELETE") {
      try {
        authorize(req, ["admin", "vendor"]);
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

  // ===== Categories =====
  if (pathname === "/categories" && method === "GET") return getCategories(req, res);
  if (pathname === "/categories" && method === "POST")
    return createCategory(req, res);
  if (pathname.startsWith("/categories/") && method === "PUT") {
    const id = pathname.split("/")[2];
    return updateCategory(req, res, id);
  }
  if (pathname.startsWith("/categories/") && method === "DELETE") {
    const id = pathname.split("/")[2];
    return deleteCategory(req, res, id);
  }

  // ===== Offers =====
  if (pathname === "/offers" && method === "GET") return getOffers(req, res);
  if (pathname === "/offers" && method === "POST") return createOffer(req, res);
  if (pathname.startsWith("/offers/")) {
    const id = pathname.split("/")[2];
    if (method === "PATCH") return updateOffer(req, res, id);
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
  const designBaseMatch = pathname.match(/^\/(?:api\/)?designs\/?$/);
  const designIdMatch = pathname.match(/^\/(?:api\/)?designs\/(\d+)\/?$/);
  const designSubMatch = pathname.match(/^\/(?:api\/)?designs\/(\d+)\/(comments|favorite|requests)\/?$/);
  const designCommentIdMatch = pathname.match(/^\/(?:api\/)?designs\/(\d+)\/comments\/(\d+)\/?$/);

  if (designBaseMatch && method === "GET") {
    return getDesigns(req, res, parsedUrl.query || {});
  }
  if (designBaseMatch && method === "POST") {
    return createDesign(req, res);
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
  }
  if (designCommentIdMatch && method === "DELETE") {
    return deleteDesignComment(req, res, designCommentIdMatch[1], designCommentIdMatch[2]);
  }

  // ===== طلبات الزيارة (العميل يطلب زيارة من الفني: التاريخ، الوقت، المساحة، العنوان) =====
  const visitReqBase = /^\/(?:api\/)?visit-requests\/?$/;
  const visitReqId = /^\/(?:api\/)?visit-requests\/(\d+)\/?$/;
  const visitReqStatus = /^\/(?:api\/)?visit-requests\/(\d+)\/status\/?$/;
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
