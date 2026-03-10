import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";

const invoiceController = {
  getAllInvoices: async (req, res) => {
    try {
      const lang = getLang(req);
      const invoices = await prisma.invoice.findMany({
        include: {
          customer: {
            select: { name: true, phone: true },
          },
          order: {
            select: { orderNumber: true, source: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(invoices));
    } catch (error) {
      const lang = getLang(req);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            lang === "en" ? "Failed to fetch invoices" : "فشل في جلب الفواتير",
        }),
      );
    }
  },

  getInvoiceById: async (req, res, id) => {
    try {
      const lang = getLang(req);
      const invoice = await prisma.invoice.findUnique({
        where: { id: parseInt(id) },
        include: {
          customer: true,
          order: {
            include: {
              items: {
                include: { paint: true },
              },
            },
          },
        },
      });

      if (!invoice) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            error: lang === "en" ? "Invoice not found" : "الفاتورة غير موجودة",
          }),
        );
      }

      const localizedInvoice = {
        ...invoice,
        order: {
          ...invoice.order,
          items: invoice.order.items.map((item) => ({
            ...item,
            paint: {
              ...item.paint,
              name:
                lang === "en"
                  ? item.paint.name_en || item.paint.name
                  : item.paint.name_ar || item.paint.name,
              description:
                lang === "en"
                  ? item.paint.description_en || item.paint.description
                  : item.paint.description_ar || item.paint.description,
            },
          })),
        },
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(localizedInvoice));
    } catch (error) {
      const lang = getLang(req);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: lang === "en" ? "Server error" : "خطأ في السيرفر",
        }),
      );
    }
  },

  createInvoice: async (req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const lang = getLang(req);
        const data = JSON.parse(body);
        const newInvoice = await prisma.invoice.create({
          data: {
            invoiceNumber: `INV-${Date.now()}`,
            orderId: data.orderId,
            customerId: data.customerId,
            amount: data.amount,
            status: data.status || "unpaid",
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
          },
        });

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify(newInvoice));
      } catch (error) {
        const lang = getLang(req);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error:
              lang === "en"
                ? "Invalid data or invoice already exists"
                : "بيانات خاطئة أو الفاتورة موجودة مسبقاً",
          }),
        );
      }
    });
  },
};

export default invoiceController;
