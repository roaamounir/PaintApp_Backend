import prisma from "../prismaClient.js";

/**
 * تحويل قيمة unitPrice المخزّنة (رقم، سلسلة، Prisma.Decimal) إلى رقم أو null.
 */
export function parseStoredUnitPrice(unitPrice) {
  if (unitPrice == null) return null;
  if (
    typeof unitPrice === "object" &&
    unitPrice !== null &&
    typeof unitPrice.toNumber === "function"
  ) {
    const n = unitPrice.toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(unitPrice);
  return Number.isFinite(n) ? n : null;
}

/** نفس منطق الدفع: من يستحق سعر الجملة عند الشراء */
export async function getCanBuyWholesaleForUser(userId, role) {
  if (role === "vendor" || role === "designer") return true;
  const vendor = await prisma.vendor.findFirst({
    where: { userId },
    select: { isApproved: true },
  });
  return Boolean(vendor?.isApproved);
}

/**
 * خريطة userId → هل يُطبَّق سعر الجملة (استعلام واحد عن التجار المعتمدين).
 */
export async function getWholesaleEligibilityByUserIds(userRows) {
  const ids = [...new Set(userRows.map((u) => u.id))];
  const needVendorCheck = ids.filter((id) => {
    const r = userRows.find((u) => u.id === id)?.role;
    return r !== "vendor" && r !== "designer";
  });
  const approved =
    needVendorCheck.length === 0
      ? []
      : await prisma.vendor.findMany({
          where: { userId: { in: needVendorCheck }, isApproved: true },
          select: { userId: true },
        });
  const approvedSet = new Set(approved.map((v) => v.userId));
  const map = {};
  for (const id of ids) {
    const r = userRows.find((u) => u.id === id)?.role;
    map[id] = r === "vendor" || r === "designer" || approvedSet.has(id);
  }
  return map;
}

/**
 * تصنيف سطر البيع للعرض: جملة / قطاعي / سعر آخر (عروض أو تغيّر الأسعار).
 */
export function classifySalePriceType(unit, retail, wholesaleNullable) {
  const r = Number.isFinite(Number(retail)) ? Number(retail) : 0;
  const w =
    wholesaleNullable != null && Number.isFinite(Number(wholesaleNullable))
      ? Number(wholesaleNullable)
      : null;
  const u = Number(unit);
  const eps = 0.02;
  if (w != null && Math.abs(u - w) <= eps) return "wholesale";
  if (Math.abs(u - r) <= eps) return "retail";
  return "other";
}

/**
 * سعر الوحدة عند الشراء حسب دور المشتري (يتطابق مع منطق الواجهة في Products / ProductDetails).
 * - vendor / designer: سعر الجملة إن وُجد، وإلا سعر التجزئة
 * - أي دور آخر (عميل user، فني، إلخ): سعر التجزئة دائماً
 */
export function getUnitPriceForBuyer(role, paint, canBuyWholesale = false) {
  const retail = Number(paint?.price);
  const r = Number.isFinite(retail) ? retail : 0;
  const wp = paint?.wholesalePrice;
  const wholesale =
    wp != null && Number.isFinite(Number(wp)) ? Number(wp) : null;

  if (role === "vendor" || role === "designer" || Boolean(canBuyWholesale)) {
    return wholesale != null ? wholesale : r;
  }
  return r;
}

export function getLineTotal(role, paint, quantity, canBuyWholesale = false) {
  const q = Math.max(1, Math.floor(Number(quantity) || 1));
  return getUnitPriceForBuyer(role, paint, canBuyWholesale) * q;
}
