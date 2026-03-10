import { URL } from "url";
import {
  matchColor,
  saveSimulation,
  getMySimulations,
  deleteSimulation,
  getAdminSimulations,
  getSimulationStats,
} from "../controllers/simulationController.js";
import { authorize } from "../middlewares/auth.js";

export const simulationRoutes = (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const path = parsedUrl.pathname;
  const method = req.method;

  if (path === "/api/simulation/match" && method === "POST") {
    return matchColor(req, res);
  }

  if (path === "/api/simulation/save" && method === "POST") {
    const user = authorize(req, ["user", "painter", "admin"]);
    return saveSimulation(req, res, user);
  }

  if (path === "/api/simulation/my-saved" && method === "GET") {
    const user = authorize(req, ["user", "painter", "admin"]);
    return getMySimulations(req, res, user);
  }

  if (path.startsWith("/api/simulation/delete/") && method === "DELETE") {
    const user = authorize(req, ["user", "painter", "admin"]);
    return deleteSimulation(req, res, user);
  }

  if (path === "/api/admin/simulations" && method === "GET") {
    authorize(req, ["admin"]);
    return getAdminSimulations(req, res);
  }

  if (path === "/api/admin/simulations/stats" && method === "GET") {
    authorize(req, ["admin"]);
    return getSimulationStats(req, res);
  }

  return false;
};
