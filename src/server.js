// src/server.js
import http from "http";
import dotenv from "dotenv";
import url from "url";
import { handleAuthRoutes } from "./routes/authRoutes.js";
import {
  createPaint,
  getAllPaints,
  getPaintById,
  updatePaint,
  deletePaint,
  exportPaintsToExcel,
  importPaintsFromExcel,
} from "./controllers/productController.js";
import {
  getPaintersByCityAndService,
  getPainterDetails,
  createOrder,
  createPainterVisit,
  getTopPainters,
} from "./controllers/painterController.js";

import { upload } from "./middlewares/upload.js";
import { calculateRecommendedQuantity } from "./utils/calc.js";

import {
  createSelection,
  getAllSelections,
  updateSelection,
  deleteSelection,
} from "./controllers/selectionController.js";
import { authorize } from "./middlewares/auth.js";
import { convertAndSearchColor } from "./controllers/colorController.js";
import { getOnboardingSlides } from "./controllers/onboardingController.js";
import {
  addToFavorites,
  getMyFavorites,
} from "./controllers/favoriteController.js";
import {
  addToCart,
  getMyCart,
  removeFromCart,
} from "./controllers/cartController.js";
import { finalCheckoutTest } from "./controllers/orderController.js";
import {
  RequestWholesaleAccount,
  getAllPendingVendors,
  approveWholesaleRequest,
} from "./controllers/wholesaleController.js";
import { addReview } from "./controllers/reviewController.js";
dotenv.config();
const PORT = process.env.PORT || 5000;

// ===== Helper function to read JSON body =====
const getJSONBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (err) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", (err) => reject(err));
  });

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const path = parsedUrl.pathname;
  const method = req.method;
  try {
    // 1. ===== Auth Routes =====
    if (path.startsWith("/signup") || path.startsWith("/login")) {
      return handleAuthRoutes(req, res);
    }

    // 2. ===== Paint Routes (Static paths first) =====
    if (path === "/paint") {
      if (method === "GET") {
        return getAllPaints(req, res);
      }

      if (method === "POST") {
        try {
          const decodedUser = authorize(req, ["admin", "vendor"]);

          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", async () => {
            await createPaint(req, res, decodedUser, body);
          });
          return;
        } catch (err) {
          res.writeHead(403, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: err.message }));
        }
      }
    }

    if (path === "/paint/export" && method === "GET") {
      return await exportPaintsToExcel(res);
    }

    if (path === "/paint/import" && method === "POST") {
      return upload.single("file")(req, res, () =>
        importPaintsFromExcel(req, res),
      );
    }

    if (path === "/painters/top" && method === "GET") {
      return getTopPainters(req, res);
    }
    // 3. ===== Paint Details (Dynamic ID) =====
    if (
      path.startsWith("/paint/") &&
      !path.includes("export") &&
      !path.includes("import")
    ) {
      const id = path.split("/")[2];
      const numericId = Number(id);

      if (isNaN(numericId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid paint id" }));
      }

      if (method === "GET") return getPaintById(req, res, numericId);

      if (method === "PUT") {
        const decodedUser = authorize(req, ["admin", "vendor"]);
        return await updatePaint(req, res, numericId, decodedUser);
      }

      if (method === "DELETE") {
        const decodedUser = authorize(req, ["admin", "vendor"]);
        return deletePaint(req, res, numericId, decodedUser);
      }
    }

    // 4. ===== Selections Routes =====
    if (path === "/selections") {
      if (method === "POST") return createSelection(req, res);
      if (method === "GET") return getAllSelections(req, res);
    }

    if (path.startsWith("/selections/")) {
      const id = path.split("/")[2];

      // Test calculation route
      if (id === "test" && method === "POST") {
        const data = await getJSONBody(req);
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
        return res.end(JSON.stringify({ recommendedQuantity }));
      }

      if (method === "PUT") return updateSelection(req, res, id);
      if (method === "DELETE") return deleteSelection(req, res, id);
    }

    // 5. ===== Painter Routes =====
    if (path === "/painters/filter" && method === "POST") {
      return getPaintersByCityAndService(req, res);
    }

    if (path.startsWith("/painters/") && method === "GET") {
      const painterId = path.split("/")[2];
      return getPainterDetails(req, res, painterId);
    }

    if (path === "/orders" && method === "POST") {
      return createOrder(req, res);
    }
    if (path === "/painter/visit" && method === "POST") {
      const decodedUser = authorize(req, ["user"]);
      return createPainterVisit(req, res, decodedUser);
    }

    if (path === "/orders" && method === "POST") {
      const decodedUser = authorize(req, ["user"]);
      return CreateOrder(req, res, decodedUser);
    }

    // 6. ===== Color Conversion Route =====
    if (path === "/color/convert" && method === "POST") {
      return convertAndSearchColor(req, res);
    }
    // 7. ===== Onboarding Slides Route =====
    if (path === "/onboarding" && method === "GET") {
      return getOnboardingSlides(req, res);
    }
    // 8. ===== fav =====
    if (path === "/favorites" && method === "POST") {
      const decodedUser = authorize(req, ["user"]);
      return addToFavorites(req, res, decodedUser);
    }

    if (path === "/favorites" && method === "GET") {
      const decodedUser = authorize(req, ["user"]);
      return getMyFavorites(req, res, decodedUser);
    }
    // 9. ===== Cart =====
    if (path === "/cart" && method === "POST") {
      const decodedUser = authorize(req, ["user", "painter"]);
      return addToCart(req, res, decodedUser);
    }

    if (path === "/cart" && method === "GET") {
      const decodedUser = authorize(req, ["user", "painter"]);
      return getMyCart(req, res, decodedUser);
    }

    if (path === "/cart" && method === "POST") {
      const decodedUser = authorize(req, ["user", "painter"]);
      return addToCart(req, res, decodedUser);
    }

    if (path === "/cart" && method === "GET") {
      const decodedUser = authorize(req, ["user", "painter"]);
      return getMyCart(req, res, decodedUser);
    }

    if (path.startsWith("/cart/") && method === "DELETE") {
      const decodedUser = authorize(req, ["user", "painter"]);
      const paintId = path.split("/")[2];
      return removeFromCart(req, res, decodedUser, paintId);
    }

    // 10. ===== Create Order =====
    if (path === "/orders/checkout" && method === "POST") {
      const decodedUser = authorize(req, ["user", "painter"]);
      return finalCheckoutTest(req, res, decodedUser);
    }

    // 11. ===== Wholesale Account Requests =====
    if (path === "/vendor/request" && method === "POST") {
      const decodedUser = authorize(req, ["user"]);
      return RequestWholesaleAccount(req, res, decodedUser);
    }

    if (path === "/admin/pending-vendors" && method === "GET") {
      authorize(req, ["admin"]);
      return getAllPendingVendors(req, res);
    }

    if (path.startsWith("/admin/approve-vendor/") && method === "PUT") {
      authorize(req, ["admin"]);
      const vendorId = path.split("/")[3];
      return approveWholesaleRequest(req, res, vendorId);
    }
    // 12. ===== Add Review =====
    if (path === "/reviews" && method === "POST") {
      const decodedUser = authorize(req, ["user"]);
      return addReview(req, res, decodedUser);
    }

    if (path.startsWith("/reviews/painter/") && method === "GET") {
      const painterId = path.split("/")[3];
      return getPainterReviews(req, res, painterId);
    }
    // ===== Default 404 =====
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Route not found" }));
  } catch (err) {
    // Global Error Handler
    const statusCode = err.message === "Not authorized" ? 403 : 500;
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
