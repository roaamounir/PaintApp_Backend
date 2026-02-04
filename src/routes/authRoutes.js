import { signup, login } from "../controllers/authController.js";

export const handleAuthRoutes = async (req, res) => {
  if (req.url === "/signup" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => signup(req, res, body));
  } else if (req.url === "/login" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => login(req, res, body));
  }
};
