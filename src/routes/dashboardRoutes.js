import {
  adminDashboard,
  painterDashboard,
  userDashboard
} from "../controllers/dashboardController.js";

export const handleDashboardRoutes = (req, res) => {
  if (req.url === "/admin/dashboard" && req.method === "GET") adminDashboard(req, res);
  else if (req.url === "/painter/dashboard" && req.method === "GET") painterDashboard(req, res);
  else if (req.url === "/user/dashboard" && req.method === "GET") userDashboard(req, res);
};
