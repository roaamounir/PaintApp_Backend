// src/controllers/vendorController.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";
export const getAllVendors = async (req, res) => {
  try {
    const lang = getLang(req);
    const vendorsList = await prisma.vendor.findMany({
      include: {
        user: {
          select: { name: true, email: true, phone: true, balance: true },
        },
        _count: { select: { paints: true } },
      },
    });

    const formattedVendors = vendorsList.map((v) => ({
      id: v.id,
      shopName: v.shopName || (lang === "en" ? "Unnamed Shop" : "بلا اسم"),
      isApproved: v.isApproved,
      commissionRate: v.commissionRate,
      balance: v.user?.balance || 0,
      productsCount: v._count.paints,
      city: v.city || (lang === "en" ? "Not Set" : "غير محدد"),
      owner: v.user?.name || "N/A",
      email: v.user?.email,
      phone: v.user?.phone,
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(formattedVendors));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const deleteVendor = async (req, res, id) => {
  try {
    const numericId = Number(id);

    await prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findFirst({
        where: { OR: [{ id: numericId }, { userId: numericId }] },
      });

      if (vendor) {
        await tx.paint.deleteMany({ where: { vendorId: vendor.id } });
        await tx.vendor.delete({ where: { id: vendor.id } });
      }

      await tx.user.update({
        where: { id: vendor ? vendor.userId : numericId },
        data: { role: "user" },
      });
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "تمت إزالة صلاحيات التاجر بنجاح" }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const CreateWholesaleRequest = async (req, res, decodedUser) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { companyName, taxId, companyType, city, region, address, phone } =
        JSON.parse(body);

      if (!companyName || !taxId || !city || !region) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            error: "الاسم، الرقم الضريبي، المدينة والمنطقة حقول مطلوبة",
          }),
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
            region: region,
            address: address,
            isApproved: false,
            paymentStatus: false,
          },
        });

        await tx.user.update({
          where: { id: Number(decodedUser.id) },
          data: {
            phone: phone,
            role: "vendor",
          },
        });

        return vendor;
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "تم حفظ بيانات الشركة بنجاح",
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

export const approveWholesaleRequest = async (req, res, userIdOrVendorId) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk.toString()));
  req.on("end", async () => {
    try {
      const data = body ? JSON.parse(body) : {};
      const id = parseInt(userIdOrVendorId);

      if (!id || isNaN(id)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({ error: "Invalid ID: الرقم التعريفي غير صحيح" }),
        );
      }
      const targetStatus = data.hasOwnProperty("isApproved")
        ? data.isApproved
        : true;
      const commission = data.commissionRate || 10.0;

      const result = await prisma.$transaction(async (tx) => {
        let vendorRecord = await tx.vendor.findFirst({
          where: { OR: [{ id: id }, { userId: id }] },
        });
        if (vendorRecord) {
          vendorRecord = await tx.vendor.update({
            where: { id: vendorRecord.id },
            data: {
              isApproved: targetStatus,
              commissionRate: commission,
            },
          });
        } else if (targetStatus === true) {
          vendorRecord = await tx.vendor.create({
            data: {
              userId: id,
              shopName: "New Vendor Store",
              taxRegistration: "PENDING",
              companyType: "Individual",
              city: "Cairo",
              isApproved: true,
              commissionRate: commission,
            },
          });
        }

        const finalUserId = vendorRecord ? vendorRecord.userId : id;
        await tx.user.update({
          where: { id: finalUserId },
          data: { role: targetStatus ? "vendor" : "user" },
        });

        return vendorRecord;
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, vendor: result }));
    } catch (err) {
      console.error("❌ Approve Error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
};
export const verifyVendorPayment = async (req, res, vendorId) => {
  try {
    const updatedVendor = await prisma.vendor.update({
      where: { id: Number(vendorId) },
      data: {
        paymentStatus: true,
      },
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Payment verified successfully",
        updatedVendor,
      }),
    );
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const processOrderFinancials = async (orderId) => {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { paint: { include: { vendor: true } } },
        },
      },
    });

    if (order.status === "completed")
      throw new Error("Order already processed");

    let platformTotalCommission = 0;

    for (const item of order.items) {
      const vendor = item.paint.vendor;
      const itemTotal = item.paint.price * item.quantity;
      const commission = itemTotal * (vendor.commissionRate / 100);
      const vendorNet = itemTotal - commission;

      platformTotalCommission += commission;

      await tx.user.update({
        where: { id: vendor.userId },
        data: { balance: { increment: vendorNet } },
      });

      await tx.walletTransaction.create({
        data: {
          userId: vendor.userId,
          amount: vendorNet,
          type: "SALE_PROFIT",
          orderId: order.id,
        },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "completed",
        isPaid: true,
      },
    });
  });
};

export const updateVendorProfile = async (req, res, id) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const data = JSON.parse(body);
      const numericId = Number(id);

      const result = await prisma.$transaction(async (tx) => {
        const updatedVendor = await tx.vendor.update({
          where: { id: numericId },
          data: {
            shopName: data.shopName,
            city: data.city,
            address: data.address,
            taxRegistration: data.taxRegistration,
            companyType: data.companyType,
            commissionRate: data.commissionRate ? parseFloat(data.commissionRate) : undefined,
          },
          include: { user: true } 
        });

        if (data.phone || data.email) {
          const updatedUser = await tx.user.update({
            where: { id: updatedVendor.userId },
            data: {
              phone: data.phone,
              email: data.email,
            },
          });
          updatedVendor.user = updatedUser;
        }

        return updatedVendor;
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ 
        message: "تم تحديث البيانات بنجاح", 
        vendor: result 
      }));
    } catch (err) {
      console.error("Update Error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "فشل التحديث: " + err.message }));
    }
  });
};  

export const processVendorPayout = async (req, res, incomingId) => {
  try {
    const lang = getLang(req);
    const id = Number(incomingId);

    const result = await prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findFirst({
        where: { OR: [{ id: id }, { userId: id }] },
        include: { user: true },
      });

      if (!vendor || vendor.user.balance <= 0) {
        throw new Error(
          lang === "en" ? "Insufficient balance" : "لا يوجد رصيد كافٍ للصرف",
        );
      }

      const payoutAmount = vendor.user.balance;

      await tx.user.update({
        where: { id: vendor.userId },
        data: { balance: 0 },
      });

      await tx.walletTransaction.create({
        data: {
          userId: vendor.userId,
          amount: -payoutAmount,
          type: "PAYOUT",
        },
      });

      return payoutAmount;
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message:
          lang === "en"
            ? "Payout processed successfully"
            : "تمت عملية الصرف بنجاح",
        amount: result,
      }),
    );
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
};

export const getVendorById = async (req, res, id) => {
  try {
    const numericId = Number(id);

    if (isNaN(numericId)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          error: "Invalid ID: الرقم التعريفي غير صحيح",
          received: id,
        }),
      );
    }

    const vendor = await prisma.vendor.findFirst({
      where: {
        OR: [{ id: numericId }, { userId: numericId }],
      },
      include: {
        user: true,
        _count: { select: { paints: true } },
      },
    });

    if (!vendor) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "التاجر غير موجود" }));
    }

    const formattedVendor = {
      ...vendor,
      balance: vendor.user?.balance || 0,
      productsCount: vendor._count.paints,
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(formattedVendor));
  } catch (err) {
    console.error("❌ Database Error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "خطأ داخلي في الخادم: " + err.message }));
  }
};
