import http from "http";
import dotenv from "dotenv";
import url from "url";
import { handleAuthRoutes } from "./routes/authRoutes.js";
import { handleDashboardRoutes } from "./routes/dashboardRoutes.js";
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
} from "./controllers/painterController.js";

import { upload } from "./middlewares/upload.js";
import { calculateRecommendedQuantity } from "./utils/calc.js";

import {
  createSelection,
  getAllSelections,
  updateSelection,
  deleteSelection,
} from "./controllers/selectionController.js";
import { authorize } from "./utils/auth.js";

dotenv.config();
const PORT = 5000;

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // ===== Auth routes =====
  if (path.startsWith("/signup") || path.startsWith("/login")) {
    return handleAuthRoutes(req, res);
  }

  // ===== Dashboard routes =====
  if (
    path.startsWith("/admin") ||
    path.startsWith("/painter") ||
    path.startsWith("/user")
  ) {
    return handleDashboardRoutes(req, res);
  }

  // ===== Paint routes =====
  if (path === "/paint" && method === "GET") return getAllPaints(req, res);

  if (path === "/paint" && method === "POST") {
    try {
      authorize(req, ["admin", "vendor"]);
      return await createPaint(req, res);
    } catch (err) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  if (path === "/paint/export" && method === "GET")
    return await exportPaintsToExcel(res);

  if (path === "/paint/import" && method === "POST") {
    return upload.single("file")(req, res, () =>
      importPaintsFromExcel(req, res),
    );
  }

  if (path.startsWith("/paint/")) {
    const id = path.split("/")[2];
    if (isNaN(Number(id))) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid paint id" }));
    }

    if (method === "GET") return getPaintById(req, res, Number(id));

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
  if (path === "/selections" && method === "POST") {
    return createSelection(req, res);
  }

  if (path === "/selections" && method === "GET") {
    return getAllSelections(req, res);
  }

  if (path.startsWith("/selections/") && method === "PUT") {
    const id = path.split("/")[2];
    return updateSelection(req, res, id);
  }

  if (path.startsWith("/selections/") && method === "DELETE") {
    const id = path.split("/")[2];
    return deleteSelection(req, res, id);
  }
  // ===== Test calc route =====
  if (path === "/selections/test" && method === "POST") {
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
        return res.end(JSON.stringify({ recommendedQuantity }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ===== Painter Routes =====

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

  // ===== Default 404 =====
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Route not found" }));
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
