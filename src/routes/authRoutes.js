import {
  signup,
  login,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
} from "../controllers/authController.js";

const normPath = (pathname) =>
  String(pathname || "")
    .split("?")[0]
    .replace(/\/+/g, "/");

export const handleAuthRoutes = async (req, res, pathnameOpt) => {
  const path = normPath(pathnameOpt ?? req.url ?? "");

  const readJsonBody = () =>
    new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          resolve(body);
        } catch (e) {
          reject(e);
        }
      });
      req.on("error", reject);
    });

  if ((path === "/signup" || path === "/api/signup") && req.method === "POST") {
    const body = await readJsonBody();
    return signup(req, res, body);
  }

  if ((path === "/login" || path === "/api/login") && req.method === "POST") {
    const body = await readJsonBody();
    return login(req, res, body).catch((err) => {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || "Login failed" }));
      }
    });
  }

  if (
    (path === "/auth/forgot-password/otp" || path === "/api/auth/forgot-password/otp") &&
    req.method === "POST"
  ) {
    const body = await readJsonBody();
    return requestPasswordResetOtp(req, res, body);
  }

  if (
    (path === "/auth/forgot-password/verify-otp" || path === "/api/auth/forgot-password/verify-otp") &&
    req.method === "POST"
  ) {
    const body = await readJsonBody();
    return verifyPasswordResetOtp(req, res, body);
  }

  if (
    (path === "/auth/forgot-password/reset" || path === "/api/auth/forgot-password/reset") &&
    req.method === "POST"
  ) {
    const body = await readJsonBody();
    return resetPasswordWithOtp(req, res, body);
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
};
