import {
  createPaint,
  getAllPaints,
  getPaintById,
  updatePaint,
  deletePaint,
} from "../controllers/productController.js";
import { authorize } from "../middlewares/auth.js";

export const handleProductRoutes = async (req, res) => {
  const url = req.url;
  const method = req.method;

  try {
    if (url === "/paint" && method === "POST") {
      const user = authorize(req, ["admin", "vendor"]);
      return await createPaint(req, res, user);
    }

    if (url === "/paints" && method === "GET") {
      return await getAllPaints(req, res);
    }

    if (url.startsWith("/paint/")) {
      const id = url.split("/")[2].split("?")[0];
      const user = authorize(req, ["admin", "vendor"]);

      if (method === "GET") return await getPaintById(req, res, id);
      if (method === "PUT") return await updatePaint(req, res, id);
      if (method === "DELETE") return await deletePaint(req, res, id);
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Route not found in Products" }));
  } catch (err) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
