// src/controllers/authController.js
import prisma from "../prismaClient.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const logAction = async (userId, action, details) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId,
        action: action,
        details: details,
      },
    });
  } catch (err) {
    console.error("Audit Log Error:", err.message);
  }
};
export const signup = async (req, res, body) => {
  try {
    const { name, email, phone, password, role } = JSON.parse(body);

    if (!name || !email || !phone || !password) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "All fields required" }));
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });

    if (existingUser) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "User already exists" }));
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, phone, password: hashedPassword, role },
    });

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "User created", user }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const login = async (req, res, body) => {
  try {
    const { phone, password } = JSON.parse(body);

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "User not found" }));
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid password" }));
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Login success", token }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
      },
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(users));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
export const getUserById = async (req, res, id) => {
  try {
    const userId = Number(id);

    if (isNaN(userId)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid User ID" }));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "User not found" }));
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(user));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const updateUser = async (req, res, id, body) => {
  try {
    const data = JSON.parse(body);
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    const decoded = token ? jwt.verify(token, process.env.JWT_SECRET) : null;

    const userId = Number(id);
    if (isNaN(userId)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid User ID" }));
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: data.role,
        status: data.status,
        name: data.name,
        permissions: data.permissions || {},
        balance:
          data.balance !== undefined ? parseFloat(data.balance) : undefined,
        creditLimit:
          data.creditLimit !== undefined
            ? parseFloat(data.creditLimit)
            : undefined,
      },
    });

    if (decoded) {
      await logAction(
        decoded.id,
        "UPDATE_USER",
        `Updated data/permissions for user: ${updatedUser.name} (ID: ${id})`,
      );
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "تم تحديث البيانات والصلاحيات بنجاح",
        updatedUser,
      }),
    );
  } catch (err) {
    console.error("Update Error Details:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
export const deleteUser = async (req, res, id) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    const decoded = token ? jwt.verify(token, process.env.JWT_SECRET) : null;

    const deletedUser = await prisma.user.delete({
      where: { id: Number(id) },
    });

    if (decoded) {
      await logAction(
        decoded.id,
        "DELETE_USER",
        `Permanently deleted user: ${deletedUser.name} (ID: ${id})`,
      );
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "User deleted successfully" }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const wholesaleSignup = async (req, res, body) => {
  try {
    const data = JSON.parse(body);
    const {
      name,
      email,
      phone,
      password,
      shopName,
      taxRegistration,
      companyType,
      city,
      region,
      address,
    } = data;

    if (
      !name ||
      !email ||
      !phone ||
      !password ||
      !shopName ||
      !taxRegistration
    ) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({ error: "Please fill all required company fields" }),
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });

    if (existingUser) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "User or Phone already exists" }));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          role: "vendor",
          status: false,
        },
      });

      const vendor = await tx.vendor.create({
        data: {
          userId: user.id,
          shopName,
          shopName_ar: shopName,
          taxRegistration,
          companyType,
          companyType_ar: companyType,
          city,
          city_ar: city,
          region,
          region_ar: region,
          address,
          address_ar: address,
          paymentStatus: false,
          commissionRate: 10.0,
        },
      });

      return { user, vendor };
    });

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Wholesale request created. Please proceed to payment.",
        vendorId: result.vendor.id,
      }),
    );
  } catch (err) {
    console.error("Wholesale Error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(logs));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
