// src/middlewares/auth.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export const authenticate = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error("No token provided");

  const token = authHeader.split(" ")[1];
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
};

export const authorize = (req, roles) => {
  const user = authenticate(req);
  console.log("Decoded user:", user);
  console.log("Allowed roles:", roles);
  console.log("user.role typeof:", typeof user.role);
  if (!roles.map(String).includes(String(user.role)))
    throw new Error("Access denied");
  return user;
};

export const checkPermission = async (req, prisma, requiredPermission) => {
  const decoded = authenticate(req);

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
  });

  if (!user) throw new Error("User not found");

  if (user.role === "admin") return user;

  const userPermissions = user.permissions || {};

  if (userPermissions[requiredPermission] === true) {
    return user;
  }

  throw new Error("عذراً، لا تملك الصلاحية الكافية");
};
