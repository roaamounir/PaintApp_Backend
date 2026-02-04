import jwt from "jsonwebtoken";

export const authenticate = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error("No token provided");

  const token = authHeader.split(" ")[1];
  return jwt.verify(token, process.env.JWT_SECRET);
};

export const authorize = (req, roles) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error("Access denied");

  const token = authHeader.split(" ")[1];
  const user = jwt.verify(token, process.env.JWT_SECRET);

  if (!roles.includes(user.role)) throw new Error("Access denied");
  return user;
};

