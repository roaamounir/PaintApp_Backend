import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const getLang = (req) =>
  req.headers["accept-language"] === "en" ? "en" : "ar";

export const updatePainterVerification = async (req, res) => {
  const { painterId } = req.params;
  const { status, adminNotes, documentId, docStatus } = req.body;
  const lang = getLang(req);

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (documentId) {
        await tx.painterDocument.update({
          where: { id: documentId },
          data: { status: docStatus },
        });
      }

      const updatedPainter = await tx.painter.update({
        where: { id: parseInt(painterId) },
        data: {
          verificationStatus: status,
          adminNotes: adminNotes,
        },
        include: { user: true },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: `PAINTER_VERIFICATION_${status.toUpperCase()}`,
          details:
            lang === "en"
              ? `Admin ${req.user.name} changed painter ${updatedPainter.user.name} status to ${status}. Notes: ${adminNotes}`
              : `قام الأدمن ${req.user.name} بتغيير حالة الفني ${updatedPainter.user.name} إلى ${status}. ملاحظات: ${adminNotes}`,
          ipAddress: req.ip || "0.0.0.0",
        },
      });

      return updatedPainter;
    });

    res.status(200).json({
      success: true,
      message:
        lang === "en"
          ? "Verification status updated"
          : "تم تحديث حالة التوثيق بنجاح",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        lang === "en" ? "Failed to update verification" : "فشل تحديث التوثيق",
      details: error.message,
    });
  }
};
