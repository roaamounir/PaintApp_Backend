import { authorize } from "../utils/authHelpers.js";

export const adminDashboard = (req, res) => {
  try {
    const user = authorize(req, ["admin"]);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Welcome Admin!", user }));
  } catch (err) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const painterDashboard = (req, res) => {
  try {
    const user = authorize(req, ["painter"]);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Welcome Painter!", user }));
  } catch (err) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const userDashboard = (req, res) => {
  try {
    const user = authorize(req, ["user"]);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Welcome User!", user }));
  } catch (err) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
