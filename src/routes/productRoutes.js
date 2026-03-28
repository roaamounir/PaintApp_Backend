import { createPaint, getAllPaints } from "../controllers/productController.js";
import { authorize } from "../utils/auth.js";

export const productRoutes = async (req, res) => {
  const url = req.url;
  const method = req.method;

  if (url === "/paint" && method === "POST") {
    try {
      authorize(req, ["admin"]);
      await createPaint(req, res);
    } catch (err) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  // Get All Paints
  else if (url === "/paints" && method === "GET") {
    await getAllPaints(req, res);
  } else if (url.startsWith("/paint/") && method === "GET") {
    const id = url.split("/")[2];
    return await getPaintById(req, res, id);
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Route not found" }));
  }
  
  if (url.startsWith("/paint/") && method === "GET") {
    const id = url.split("/")[2];
    // authorize(req, ["admin", "vendor"]);
    return await getPaintById(req, res, id);
  }
};
