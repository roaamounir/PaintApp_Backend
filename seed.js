/**
 * بذور: أدمن + مستخدمين + 5 أقسام × 5 منتجات (منتجان غير متوفرين) + طلب تجريبي للعميل/التاجر.
 * تشغيل: npm run seed
 * مسح كامل ثم بذور: CONFIRM_PURGE=yes npm run db:fresh
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import prisma from "./src/prismaClient.js";
import { getUnitPriceForBuyer, getCanBuyWholesaleForUser } from "./src/utils/buyerPricing.js";

const DEMO_PASSWORD = "User@123";

/** بادئة تسجيل نوع طلب الجملة (متطابقة مع لوحة الطلبات) */
const WHOLESALE_REQ_PREFIX = "__REQ_TYPE__:WHOLESALE";

/** عملاء جملة يُربَطون بسجل vendor معتمد للاختبار */
const WHOLESALE_SEED_USERS = [
  { name: "عميل جملة — مازن", email: "wholesale1@paintapp.test", phone: "01001110011", shopName: "دهانات الجملة — مازن" },
  { name: "عميل جملة — لمى", email: "wholesale2@paintapp.test", phone: "01001110012", shopName: "دهانات الجملة — لمى" },
];

/** أقسام المنتجات التجريبية: اسم عربي + مفتاح فريد للـ SKU */
const CATALOG_SECTIONS = [
  { name: "دهانات داخلية", slug: "interior", description: "دهانات مائية وزيتية للاستخدام الداخلي" },
  { name: "دهانات واجهات", slug: "exterior", description: "مقاومة للعوامل الجوية" },
  { name: "دهانات أخشاب", slug: "wood", description: "ورنيش وحماية للخشب" },
  { name: "أساس ومعاجين", slug: "primer", description: "طبقات تحضير الأسطح" },
  { name: "أدوات دهان", slug: "tools", description: "rollers وفراشي وملحقات" },
];

/** @typedef {{ name: string; email: string; phone: string; role: import("@prisma/client").user_role }} UserSeed */

const EXTRA_USERS = [
  { name: "أحمد محمد — عميل", email: "client1@paintapp.test", phone: "01001110001", role: "user" },
  { name: "فاطمة علي — عميلة", email: "client2@paintapp.test", phone: "01001110002", role: "user" },
  { name: "محمود تاجر — دهانات", email: "vendor1@paintapp.test", phone: "01001110003", role: "vendor" },
  { name: "سارة موردة — ألوان الغد", email: "vendor2@paintapp.test", phone: "01001110004", role: "vendor" },
  { name: "خالد الدهان — فني", email: "painter1@paintapp.test", phone: "01001110005", role: "painter" },
  { name: "ياسر تنفيذ — واجهات", email: "painter2@paintapp.test", phone: "01001110006", role: "painter" },
  { name: "نورا مصممة ديكور", email: "designer1@paintapp.test", phone: "01001110007", role: "designer" },
  { name: "كريم مصمم", email: "designer2@paintapp.test", phone: "01001110008", role: "designer" },
  { name: "رانيا مصممة ألوان", email: "designer3@paintapp.test", phone: "01001110009", role: "designer" },
];

async function ensureUserIsActiveColumn() {
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `user` ADD COLUMN `isActive` TINYINT(1) NOT NULL DEFAULT 1",
    );
  } catch (_) {}
}

async function upsertUser(email, data) {
  return prisma.user.upsert({
    where: { email },
    update: {
      name: data.name,
      phone: data.phone,
      role: data.role,
      password: data.password,
    },
    create: {
      name: data.name,
      email,
      phone: data.phone,
      role: data.role,
      password: data.password,
    },
  });
}

/** طلبات جملة تجريبية اختيارية — يمكن توسعتها لاحقاً */
async function seedWholesaleDemoOrders() {
  /* لا شيء افتراضياً؛ الكتالوج والشراء عبر السلة متاحان لجميع الأدوار */
}

/**
 * تصاميم تجريبية في المعرض — designerId هو معرّف المستخدم (نفس المنطق في designController).
 * إعادة تشغيل البذرة: تُتخطى إن وُجدت مسبقاً تصاميم بعنوان يبدأ بـ [SEED] لذلك المصمم.
 */
const DESIGNER_GALLERY_SEEDS = [
  {
    email: "designer1@paintapp.test",
    items: [
      {
        title: "[SEED] صالة معيشة — نغمات ترابية",
        description:
          "تشطيب دافئ مع جدران بيج وخشب طبيعي. مناسب للمساحات المتوسطة في الشقق الحديثة.",
        imageUrl: "https://picsum.photos/seed/paintapp-d1-living/1200/800",
      },
      {
        title: "[SEED] غرفة نوم — أزرق هادئ",
        description:
          "لوحة ألوان مريحة للراحة الليلية مع إضاءة جانبية خافتة.",
        imageUrl: "https://picsum.photos/seed/paintapp-d1-bedroom/1200/800",
      },
      {
        title: "[SEED] مكتب منزلي مضيء",
        description:
          "مساحة عمل بيضاء مع لمسة لون على جدار الخلفية للتركيز.",
        imageUrl: "https://picsum.photos/seed/paintapp-d1-office/1200/800",
      },
    ],
  },
  {
    email: "designer2@paintapp.test",
    items: [
      {
        title: "[SEED] واجهة — طابع معاصر",
        description: "اقتراح ألوان واجهة مقاومة للتقلبات مع تباين الحجر والدهان.",
        imageUrl: "https://picsum.photos/seed/paintapp-d2-facade/1200/800",
      },
      {
        title: "[SEED] مدخل — درج ولون مميز",
        description: "تأطيع بصري للمدخل بدهانات ذات لمعان نصف غير لامع.",
        imageUrl: "https://picsum.photos/seed/paintapp-d2-entry/1200/800",
      },
      {
        title: "[SEED] تراس مفتوح",
        description: "ألوان خارجية مقترحة للجلوس الخارجي.",
        imageUrl: "https://picsum.photos/seed/paintapp-d2-terrace/1200/800",
      },
      {
        title: "[SEED] غرفة أطفال مرحة",
        description: "دمج لونين مع عناصر جرافيك خفيفة على الحائط.",
        imageUrl: "https://picsum.photos/seed/paintapp-d2-kids/1200/800",
      },
    ],
  },
  {
    email: "designer3@paintapp.test",
    items: [
      {
        title: "[SEED] مطبخ مفتوح على الصالة",
        description: "تنسيق ألوان كابينت وبورسلين مع جدران محايدة.",
        imageUrl: "https://picsum.photos/seed/paintapp-d3-kitchen/1200/800",
      },
      {
        title: "[SEED] حمّام سبا",
        description: "كرميد فاتح ودهان مقاوم للرطوبة بلون رمادي دافئ.",
        imageUrl: "https://picsum.photos/seed/paintapp-d3-bath/1200/800",
      },
      {
        title: "[SEED] جدار مميز — لون مزخرف",
        description: "جدار مزخرف كنقطة بصرية في الريسبشن.",
        imageUrl: "https://picsum.photos/seed/paintapp-d3-accent/1200/800",
      },
    ],
  },
];

async function seedDesignerGallery() {
  for (const block of DESIGNER_GALLERY_SEEDS) {
    const user = await prisma.user.findUnique({ where: { email: block.email } });
    if (!user) continue;

    const existing = await prisma.design.count({
      where: { designerId: user.id, title: { startsWith: "[SEED]" } },
    });
    if (existing > 0) {
      console.log(`   معرض تصاميم البذرة موجود مسبقاً (${block.email}) — تخطّي.`);
      continue;
    }

    await prisma.design.createMany({
      data: block.items.map((it) => ({
        designerId: user.id,
        title: it.title,
        description: it.description,
        imageUrl: it.imageUrl,
      })),
    });
    console.log(`   أُضيفت ${block.items.length} تصميماً لمصمم: ${block.email}`);
  }
}

/**
 * 5 أقسام × 5 منتجات؛ منتجان فقط نفاد مخزون (أول منتج في أول قسمين).
 * تكرار التشغيل: يُحدَّث المخزون والـ SKU ثابت.
 * الكتالوج للإدارة فقط: vendorId = null (التجار يشترون جملة ولا يملكون المنتج في الكتالوج العام).
 *
 * ملاحظة: بعض قواعد MySQL/إصدارات Prisma ترفض create بدون vendorId؛ طريق التوافق: upsert يضبط vendorId
 * في create فقط من `catalogVendorPlaceholderId` ثم updateMany يصفّر الجميع في الختام.
 */
async function seedCatalogProducts(catalogVendorPlaceholderId) {
  let outOfStockMarked = 0;
  const maxOos = 2;
  const placeholder =
    catalogVendorPlaceholderId != null && String(catalogVendorPlaceholderId).trim() !== ""
      ? String(catalogVendorPlaceholderId).trim()
      : null;

  for (let si = 0; si < CATALOG_SECTIONS.length; si++) {
    const sec = CATALOG_SECTIONS[si];
    const category = await prisma.category.upsert({
      where: { name: sec.name },
      update: { description: sec.description },
      create: { name: sec.name, description: sec.description },
    });

    for (let pi = 0; pi < 5; pi++) {
      const sku = `SEED-${sec.slug}-${String(pi + 1).padStart(2, "0")}`;
      const isOos = outOfStockMarked < maxOos && si < 2 && pi === 0;
      if (isOos) outOfStockMarked += 1;

      const stock = isOos ? 0 : 40 + pi * 5;
      const basePrice = 45 + si * 12 + pi * 7;
      const wholesalePrice = Math.round((basePrice * 0.72) * 100) / 100;

      const common = {
        name: `${sec.name} — عرض ${pi + 1}`,
        description: `منتج تجريبي للقسم «${sec.name}» (بذرة).`,
        price: basePrice,
        wholesalePrice,
        stock,
        inStock: stock > 0,
        isActive: true,
        categoryId: category.id,
        base: pi % 2 === 0 ? "water" : "oil",
        coatHours: 3 + pi,
        coverage: 8 + pi * 2,
        dryDays: pi % 3,
        finish: ["matte", "semi_gloss", "gloss"][pi % 3],
        unit: pi % 2 === 0 ? "liter" : "kg",
        usage: sec.slug === "exterior" ? "outdoor" : sec.slug === "interior" ? "indoor" : "both",
        type: "paint",
        weightKg: 1 + pi * 0.2,
      };

      await prisma.paint.upsert({
        where: { sku },
        update: {
          ...common,
        },
        create: {
          sku,
          ...common,
          offerId: null,
          ...(placeholder ? { vendorId: placeholder } : {}),
        },
      });
    }
  }

  await prisma.$executeRawUnsafe(
    "UPDATE `paint` SET `vendorId` = NULL WHERE `sku` IS NOT NULL AND `sku` LIKE 'SEED-%'",
  );

  console.log("   كتالوج إداري (بدون مورد): 5 أقسام، 25 منتجاً، 2 منهم غير متوفرين (مخزون 0).");
}

/** مسح سجلات محاكاة الألوان / حاسبة الكمية (جدول selection) — غير مطلوبة في البذرة */
async function clearSelectionSimulations() {
  const r = await prisma.selection.deleteMany({});
  if (r.count > 0) {
    console.log(`   حُذفت ${r.count} سجلات محاكاة الألوان (selection).`);
  }
}

const OFFER_SEEDS = [
  { title: "[SEED] Weekend Flash", discount: 10, discountType: "percentage", isActive: true, days: 14 },
  { title: "[SEED] New Customer", discount: 15, discountType: "percentage", isActive: true, days: 30 },
  { title: "[SEED] Cart Booster", discount: 20, discountType: "percentage", isActive: true, days: 10 },
  { title: "[SEED] Loyalty Drop", discount: 12, discountType: "percentage", isActive: true, days: 21 },
  { title: "[SEED] Summer Colors", discount: 18, discountType: "percentage", isActive: false, days: 60 },
  { title: "[SEED] Winter Prep", discount: 8, discountType: "percentage", isActive: false, days: 45 },
  { title: "[SEED] Painter Pro", discount: 250, discountType: "fixed", isActive: true, days: 30 },
  { title: "[SEED] Vendor Bulk", discount: 400, discountType: "fixed", isActive: true, days: 30 },
  { title: "[SEED] Designer Pack", discount: 300, discountType: "fixed", isActive: true, days: 20 },
  { title: "[SEED] Category Spotlight", discount: 9, discountType: "percentage", isActive: false, days: 35 },
];

const COUPON_SEEDS = [
  { code: "WELCOME10", discount: 10, discountType: "percentage", isActive: true, days: 90 },
  { code: "SPRING15", discount: 15, discountType: "percentage", isActive: true, days: 45 },
  { code: "FIXED50", discount: 50, discountType: "fixed", isActive: true, days: 60 },
  { code: "VIP20", discount: 20, discountType: "percentage", isActive: true, days: 30 },
  { code: "EXPIRED5", discount: 5, discountType: "percentage", isActive: false, days: -2 },
];

async function ensureOfferCampaignColumn() {
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `offer` ADD COLUMN `campaignType` VARCHAR(16) NOT NULL DEFAULT 'offer'",
    );
  } catch (_) {}
  try {
    await prisma.$executeRawUnsafe(
      "UPDATE `offer` SET `campaignType` = 'offer' WHERE `campaignType` IS NULL OR `campaignType` = ''",
    );
  } catch (_) {}
}

async function seedOffers() {
  await ensureOfferCampaignColumn();
  const now = new Date();
  for (const item of OFFER_SEEDS) {
    const startDate = new Date(now);
    const endDate = new Date(now.getTime() + item.days * 24 * 60 * 60 * 1000);
    const offer = await prisma.offer.upsert({
      where: { title: item.title },
      update: {
        discount: item.discount,
        discountType: item.discountType,
        isActive: item.isActive,
        startDate,
        endDate,
      },
      create: {
        title: item.title,
        discount: item.discount,
        discountType: item.discountType,
        isActive: item.isActive,
        startDate,
        endDate,
      },
    });
    await prisma.$executeRawUnsafe(
      "UPDATE `offer` SET `campaignType` = 'offer' WHERE `id` = ?",
      offer.id,
    );
  }
  console.log(`   أُضيف/حُدّث ${OFFER_SEEDS.length} عروض تجريبية.`);
}

async function seedCoupons() {
  await ensureOfferCampaignColumn();
  const now = new Date();
  for (const item of COUPON_SEEDS) {
    const isExpiredPreset = item.days < 0;
    const startDate = isExpiredPreset
      ? new Date(now.getTime() + (item.days - 14) * 24 * 60 * 60 * 1000)
      : new Date(now);
    const endDate = new Date(now.getTime() + item.days * 24 * 60 * 60 * 1000);
    const coupon = await prisma.offer.upsert({
      where: { title: item.code },
      update: {
        discount: item.discount,
        discountType: item.discountType,
        isActive: item.isActive,
        startDate,
        endDate,
      },
      create: {
        title: item.code,
        discount: item.discount,
        discountType: item.discountType,
        isActive: item.isActive,
        startDate,
        endDate,
      },
    });
    await prisma.$executeRawUnsafe(
      "UPDATE `offer` SET `campaignType` = 'coupon' WHERE `id` = ?",
      coupon.id,
    );
  }
  console.log(`   أُضيف/حُدّث ${COUPON_SEEDS.length} كوبونات تجريبية.`);
}

/**
 * يحاكي إتمام شراء: order + orderitem + خصم مخزون (مثل /checkout).
 * يُنشأ مرة واحدة لكل مستخدم ما دام لا يملك طلبات بعد.
 */
async function seedDemoPurchaseOrders() {
  const demoUsers = [
    { email: "client1@paintapp.test", role: "user" },
    { email: "vendor1@paintapp.test", role: "vendor" },
  ];

  for (const { email, role } of demoUsers) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;

    const existingOrders = await prisma.order.count({ where: { userId: user.id } });
    if (existingOrders > 0) continue;

    const canBuyWholesale = await getCanBuyWholesaleForUser(user.id, user.role);
    const inStockPaints = await prisma.paint.findMany({
      where: { isActive: true, inStock: true, stock: { gt: 0 }, sku: { startsWith: "SEED-" } },
      orderBy: { sku: "asc" },
      take: role === "vendor" ? 2 : 2,
    });
    if (inStockPaints.length === 0) continue;

    const lines = [];
    for (let i = 0; i < inStockPaints.length; i++) {
      const paint = inStockPaints[i];
      const quantity = i === 0 ? 2 : 1;
      if (paint.stock < quantity) continue;
      const unitPrice = getUnitPriceForBuyer(user.role, paint, canBuyWholesale);
      lines.push({
        paint,
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
        stockAfter: paint.stock - quantity,
      });
    }
    if (lines.length === 0) continue;

    const totalPrice = lines.reduce((s, l) => s + l.lineTotal, 0);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: user.id,
          totalPrice,
          status: "pending",
        },
      });
      await tx.orderitem.createMany({
        data: lines.map((l) => ({
          orderId: order.id,
          paintId: l.paint.id,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
      for (const line of lines) {
        await tx.paint.update({
          where: { id: line.paint.id },
          data: {
            stock: { decrement: line.quantity },
            inStock: line.stockAfter > 0,
          },
        });
      }
    });

    console.log(`   طلب تجريبي + فاتورة (INV-…) لمستخدم: ${email}`);
  }
}

/**
 * يضيف:
 * - طلب مصمم (design_request) من عميل على تصميم بذرة
 * - طلب معاينة فني (visit_request) من عميل لفني بذرة
 * مع منع التكرار عبر وصف يحمل بادئة [SEED].
 */
async function seedDesignerAndPainterRequests() {
  const client = await prisma.user.findUnique({
    where: { email: "client1@paintapp.test" },
  });
  const designer = await prisma.user.findUnique({
    where: { email: "designer1@paintapp.test" },
  });
  const painterUser = await prisma.user.findUnique({
    where: { email: "painter1@paintapp.test" },
  });
  if (!client || !designer || !painterUser) return;

  // 1) طلب مصمم
  const sampleDesign = await prisma.design.findFirst({
    where: {
      designerId: designer.id,
      title: { startsWith: "[SEED]" },
    },
    orderBy: { createdAt: "asc" },
  });
  if (sampleDesign) {
    const existingDesignReq = await prisma.designrequest.findFirst({
      where: {
        designId: sampleDesign.id,
        clientUserId: client.id,
        description: { contains: "[SEED] طلب مصمم" },
      },
    });
    if (!existingDesignReq) {
      await prisma.designrequest.create({
        data: {
          designId: sampleDesign.id,
          clientUserId: client.id,
          description:
            "[SEED] طلب مصمم: أريد تنفيذ التصميم مع تعديل بسيط على درجات اللون ومساحة 120م.",
          imageUrl: "https://picsum.photos/seed/paintapp-seed-design-request/900/600",
          status: "pending",
        },
      });
      console.log("   أُضيف طلب مصمم تجريبي.");
    }
  }

  // 2) طلب معاينة فني
  const painter = await prisma.painter.findUnique({
    where: { userId: painterUser.id },
  });
  if (painter) {
    const existingVisitReq = await prisma.visitrequest.findFirst({
      where: {
        clientUserId: client.id,
        painterId: painter.id,
        notes: { contains: "[SEED] طلب معاينة فني" },
      },
    });
    if (!existingVisitReq) {
      const date = new Date();
      date.setDate(date.getDate() + 2);
      date.setHours(10, 0, 0, 0);
      await prisma.visitrequest.create({
        data: {
          clientUserId: client.id,
          painterId: painter.id,
          scheduledDate: date,
          scheduledTime: "10:00 AM",
          area: 120,
          region: "الرياض",
          address: "حي الندى — شارع الأمير محمد بن سلمان",
          status: "pending",
          notes:
            "[SEED] طلب معاينة فني: أحتاج معاينة الموقع قبل التنفيذ وتحديد نوع الدهان المناسب.",
        },
      });
      console.log("   أُضيف طلب معاينة فني تجريبي.");
    }
  }
}

async function main() {
  await ensureUserIsActiveColumn();
  const adminPass = await bcrypt.hash("Admin@123", 10);
  const userPass = await bcrypt.hash(DEMO_PASSWORD, 10);

  await upsertUser("admin@paintapp.com", {
    name: "Admin",
    phone: "01000000000",
    role: "admin",
    password: adminPass,
  });

  for (const u of EXTRA_USERS) {
    await upsertUser(u.email, {
      name: u.name,
      phone: u.phone,
      role: u.role,
      password: userPass,
    });
  }

  for (const u of WHOLESALE_SEED_USERS) {
    await upsertUser(u.email, {
      name: u.name,
      phone: u.phone,
      role: "user",
      password: userPass,
    });
  }

  for (const u of WHOLESALE_SEED_USERS) {
    const row = await prisma.user.findUnique({ where: { email: u.email } });
    if (!row) continue;
    const taxRegistration = `${WHOLESALE_REQ_PREFIX}|SEED-${u.email}`;
    await prisma.vendor.upsert({
      where: { userId: row.id },
      update: {
        shopName: u.shopName,
        city: "الرياض",
        address: "عنوان تجريبي — طلب جملة",
        region: "type:wholesale_seed",
        taxRegistration,
        isApproved: true,
      },
      create: {
        userId: row.id,
        shopName: u.shopName,
        city: "الرياض",
        address: "عنوان تجريبي — طلب جملة",
        region: "type:wholesale_seed",
        taxRegistration,
        isApproved: true,
      },
    });
  }

  const v1 = await prisma.user.findUnique({ where: { email: "vendor1@paintapp.test" } });
  const v2 = await prisma.user.findUnique({ where: { email: "vendor2@paintapp.test" } });
  if (v1) {
    await prisma.vendor.upsert({
      where: { userId: v1.id },
      update: {},
      create: {
        userId: v1.id,
        shopName: "دهانات المحمود",
        city: "القاهرة",
        address: "شارع الهرم ١٢",
        isApproved: true,
      },
    });
  }
  if (v2) {
    await prisma.vendor.upsert({
      where: { userId: v2.id },
      update: {},
      create: {
        userId: v2.id,
        shopName: "ألوان الغد",
        city: "الجيزة",
        address: "الدقي، ميدان المساحة",
        isApproved: true,
      },
    });
  }

  const p1 = await prisma.user.findUnique({ where: { email: "painter1@paintapp.test" } });
  const p2 = await prisma.user.findUnique({ where: { email: "painter2@paintapp.test" } });
  if (p1) {
    await prisma.painter.upsert({
      where: { userId: p1.id },
      update: {},
      create: {
        userId: p1.id,
        city: "القاهرة",
        address: "مدينة نصر",
        experience: 6,
        serviceType: "interior",
        rating: 4.5,
      },
    });
  }
  if (p2) {
    await prisma.painter.upsert({
      where: { userId: p2.id },
      update: {},
      create: {
        userId: p2.id,
        city: "الجيزة",
        address: "المهندسين",
        experience: 4,
        serviceType: "exterior",
        rating: 4.2,
      },
    });
  }

  const d1 = await prisma.user.findUnique({ where: { email: "designer1@paintapp.test" } });
  const d2 = await prisma.user.findUnique({ where: { email: "designer2@paintapp.test" } });
  if (d1) {
    await prisma.designerprofile.upsert({
      where: { userId: d1.id },
      update: {},
      create: {
        userId: d1.id,
        experience: 5,
        specialties: "ديكور داخلي، ألوان",
        rating: 4.7,
        bio: "مصممة ديكور",
        location: "القاهرة",
      },
    });
  }
  if (d2) {
    await prisma.designerprofile.upsert({
      where: { userId: d2.id },
      update: {},
      create: {
        userId: d2.id,
        experience: 3,
        specialties: "واجهات، تصميم",
        rating: 4.4,
        bio: "مصمم واجهات",
        location: "الإسكندرية",
      },
    });
  }

  const d3 = await prisma.user.findUnique({ where: { email: "designer3@paintapp.test" } });
  if (d3) {
    await prisma.designerprofile.upsert({
      where: { userId: d3.id },
      update: {},
      create: {
        userId: d3.id,
        experience: 7,
        specialties: "مطابخ، حمامات، مساحات مفتوحة",
        rating: 4.8,
        bio: "مصممة داخلية تركز على الوظيفة والإضاءة.",
        location: "الجيزة",
      },
    });
  }

  await seedDesignerGallery();

  await seedWholesaleDemoOrders();

  const vendorCatalogPlaceholder =
    v1 != null
      ? await prisma.vendor.findUnique({ where: { userId: v1.id }, select: { id: true } })
      : null;
  await seedOffers();
  await seedCoupons();
  try {
    await seedCatalogProducts(vendorCatalogPlaceholder?.id ?? null);
  } catch (e) {
    console.warn("⚠ تخطّي كتالوج المنتجات في هذه الجلسة بسبب تعارض schema/client:", e?.message || e);
  }
  await seedDemoPurchaseOrders();
  await seedDesignerAndPainterRequests();
  await clearSelectionSimulations();

  const totalDemoUsers = EXTRA_USERS.length + WHOLESALE_SEED_USERS.length;
  console.log("✅ البذور: أدمن +", totalDemoUsers, "مستخدمين (منهم", WHOLESALE_SEED_USERS.length, "عملاء جملة معتمدون).");
  console.log("");
  console.log("   الأدمن: admin@paintapp.com أو 01000000000 / Admin@123");
  console.log("   البقية: البريد أعلاه أو رقم الجوال /", DEMO_PASSWORD);
  console.log("");
  console.log("   عملاء الجملة:", WHOLESALE_SEED_USERS.map((u) => u.email).join(", "));
  console.log("");
  console.log("   الشراء للمستخدم: أضف للسلة ثم POST /checkout مع JWT — يظهر الطلب في GET /orders ورقم الفاتورة INV-{orderId}.");
  console.log("   المصممون: designer1/2/3@paintapp.test — تصاميم البذرة تظهر في GET /designs (عناوين تبدأ بـ [SEED]).");
  console.log("   لمسح القاعدة بالكامل ثم بذور نظيفة: CONFIRM_PURGE=yes npm run db:fresh");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
