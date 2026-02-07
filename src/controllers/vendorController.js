// src/controllers/vendorController.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const CreateWholesaleRequest = async (req, res, decodedUser) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { companyName, taxId, companyType, city, address, phone } =
        JSON.parse(body);

      if (!companyName || !taxId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({ error: "اسم الشركة ورقم التسجيل الضريبي مطلوبان" }),
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const vendor = await tx.vendor.create({
          data: {
            userId: Number(decodedUser.id),
            shopName: companyName,
            taxRegistration: taxId,
            companyType: companyType,
            city: city,
            address: address,
            isApproved: false,
          },
        });

        await tx.user.update({
          where: { id: Number(decodedUser.id) },
          data: { phone: phone },
        });

        return vendor;
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "تم حفظ بيانات الشركة، جاري تحويلك لطرق الدفع...",
          vendorId: result.id,
          paymentStep: true,
        }),
      );
    } catch (err) {
      console.error(err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "خطأ في معالجة الطلب: " + err.message }));
    }
  });
};
export const RequestWholesaleAccount = async (req, res, decodedUser) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const data = JSON.parse(body);

      const existingVendor = await prisma.vendor.findUnique({
        where: { userId: Number(decodedUser.id) },
      });

      if (existingVendor) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            error: "لديك حساب جملة بالفعل أو طلبك تحت المراجعة",
          }),
        );
      }

      const newVendorRequest = await prisma.vendor.create({
        data: {
          userId: Number(decodedUser.id),
          shopName: data.companyName,
          taxRegistration: data.taxId,
          companyType: data.companyType,
          city: data.city,
          address: data.address,
          isApproved: false,
        },
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message:
            "تم استلام طلبك بنجاح. يرجى إتمام عملية الدفع لتفعيل الحساب.",
          vendorId: newVendorRequest.id,
          redirectTo: "/payment-methods",
        }),
      );
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "حدث خطأ: " + err.message }));
    }
  });
};

export const getAllPendingVendors = async (req, res) => {
  try {
    const pending = await prisma.vendor.findMany({
      where: { isApproved: false },
      include: { user: true },
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(pending));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const approveWholesaleRequest = async (req, res, vendorId) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.update({
        where: { id: Number(vendorId) },
        data: { isApproved: true },
      });

      await tx.user.update({
        where: { id: vendor.userId },
        data: { role: "vendor" },
      });

      return vendor;
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "تمت الموافقة وتفعيل حساب الجملة",
        vendor: result,
      }),
    );
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};
