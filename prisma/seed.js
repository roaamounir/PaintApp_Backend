import { PrismaClient } from "@prisma/client";
import { hexToLab } from "../src/utils/colorConverter.js";
const prisma = new PrismaClient();

async function main() {
  console.log("Start seeding...");

  // 1. ===== Onboarding Sliders =====
  console.log("Seeding Onboarding...");
  await prisma.onboarding.createMany({
    data: [
      {
        title: "اكتشف عالم الألوان",
        description: "تصفح آلاف الدهانات من أفضل الشركات",
        imageUrl: "onboarding1.png",
        order: 1,
      },
      {
        title: "فنيين محترفين",
        description: "اطلب فني طلاء خبير بضغطة زر",
        imageUrl: "onboarding2.png",
        order: 2,
      },
      {
        title: "محاكاة ذكية",
        description: "جرب اللون على حائطك قبل الشراء",
        imageUrl: "onboarding3.png",
        order: 3,
      },
    ],
  });

  // 2. ===== Users =====
  console.log("Seeding Users...");
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@app.com" },
    update: {},
    create: {
      name: "Main Administrator",
      email: "admin@app.com",
      phone: "01099999999",
      password: "hashed123456",
      role: "admin",
    },
  });

  const vendorUser = await prisma.user.upsert({
    where: { email: "vendor@example.com" },
    update: {},
    create: {
      name: "محمد أحمد",
      email: "vendor@example.com",
      phone: "01000000001",
      password: "hashed_password",
      role: "vendor",
    },
  });
  const vendorGLCUser = await prisma.user.upsert({
    where: { email: "glc@example.com" },
    update: {},
    create: {
      name: "مركز جي إل سي",
      email: "glc@example.com",
      phone: "01012345678",
      password: "hashed_password",
      role: "vendor",
    },
  });

  const vendorKapciUser = await prisma.user.upsert({
    where: { email: "kapci@example.com" },
    update: {},
    create: {
      name: "كابسي للدهانات",
      email: "kapci@example.com",
      phone: "01087654321",
      password: "hashed_password",
      role: "vendor",
    },
  });
  const painterUser = await prisma.user.upsert({
    where: { email: "painter@example.com" },
    update: {},
    create: {
      name: "أحمد حسن",
      email: "painter@example.com",
      phone: "01000000002",
      password: "hashed_password",
      role: "painter",
    },
  });

  const painterUser2 = await prisma.user.upsert({
    where: { email: "painter2@example.com" },
    update: {},
    create: {
      name: "خالد محمود",
      email: "painter2@example.com",
      phone: "01000000003",
      password: "hashed_password",
      role: "painter",
    },
  });

  const regularUser = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      name: "سارة علي",
      email: "user@example.com",
      phone: "01000000004",
      password: "hashed_password",
      role: "user",
    },
  });

  const regularUser2 = await prisma.user.upsert({
    where: { email: "user2@example.com" },
    update: {},
    create: {
      name: "فاطمة حسين",
      email: "user2@example.com",
      phone: "01000000005",
      password: "hashed_password",
      role: "user",
    },
  });

  // 3. ===== Vendor Profile =====
  console.log("Seeding Vendors...");
  const vendor = await prisma.vendor.upsert({
    where: { userId: vendorUser.id },
    update: {},
    create: {
      userId: vendorUser.id,
      shopName: "المستقبل للدهانات",
      taxRegistration: "123-456-789",
      companyType: "شركة مساهمة",
      isApproved: true,
      city: "القاهرة",
      address: "مدينة نصر - الحي السابع",
      commissionRate: 10.0,
    },
  });
  const vendorGLC = await prisma.vendor.upsert({
    where: { userId: vendorGLCUser.id },
    update: {},
    create: {
      userId: vendorGLCUser.id,
      shopName: "جي إل سي ستور",
      taxRegistration: "444-555-666",
      companyType: "توكيل معتمد",
      isApproved: true,
      city: "الإسكندرية",
      address: "سموحة - الطريق الزراعي",
      commissionRate: 8.0,
    },
  });

  const vendorKapci = await prisma.vendor.upsert({
    where: { userId: vendorKapciUser.id },
    update: {},
    create: {
      userId: vendorKapciUser.id,
      shopName: "كابسي مصر",
      taxRegistration: "777-888-999",
      companyType: "مصنع",
      isApproved: true,
      city: "بورسعيد",
      address: "المنطقة الصناعية",
      commissionRate: 7.5,
    },
  });
  // 4. ===== Painter Profiles =====
  console.log("Seeding Painters...");
  const painter = await prisma.painter.upsert({
    where: { userId: painterUser.id },
    update: {},
    create: {
      userId: painterUser.id,
      rating: 4.8,
      experience: 10,
      city: "الجيزة",
      service: "both",
      address: "فيصل الرئيسي",
    },
  });

  const painter2 = await prisma.painter.upsert({
    where: { userId: painterUser2.id },
    update: {},
    create: {
      userId: painterUser2.id,
      rating: 4.5,
      experience: 7,
      city: "القاهرة",
      service: "indoor",
      address: "مصر الجديدة",
    },
  });

  // 5. ===== Categories & SubCategories =====
  console.log("Seeding Categories...");
  const catInterior = await prisma.category.upsert({
    where: { name: "دهانات داخلية" },
    update: {},
    create: { name: "دهانات داخلية" },
  });

  const catExterior = await prisma.category.upsert({
    where: { name: "دهانات خارجية" },
    update: {},
    create: { name: "دهانات خارجية" },
  });

  const catWood = await prisma.category.upsert({
    where: { name: "دهانات الخشب" },
    update: {},
    create: { name: "دهانات الخشب" },
  });

  const subCatPlastic = await prisma.subCategory.create({
    data: { name: "بلاستيك مط", categoryId: catInterior.id },
  });

  const subCatGlossy = await prisma.subCategory.create({
    data: { name: "لامع", categoryId: catInterior.id },
  });

  const subCatWeatherproof = await prisma.subCategory.create({
    data: { name: "مقاوم للعوامل الجوية", categoryId: catExterior.id },
  });

  const subCatVarnish = await prisma.subCategory.create({
    data: { name: "ورنيش", categoryId: catWood.id },
  });
  // 6. ===== Color System =====
  console.log("Seeding Color System with Smart LAB conversion...");

  const jotunSystem = await prisma.colorSystem.upsert({
    where: { name: "Jotun Colors" },
    update: {},
    create: { name: "Jotun Colors" },
  });

  const pachinSystem = await prisma.colorSystem.upsert({
    where: { name: "Pachin Colors" },
    update: {},
    create: { name: "Pachin Colors" },
  });
  const mainColor = await prisma.color.upsert({
    where: { code: "1001" },
    update: {},
    create: {
      code: "1001",
      hex: "#F0EAD6",
      colorSystemId: jotunSystem.id,
      ...hexToLab("#F0EAD6"),
    },
  });
  const rawColors = [
    // Jotun Colors
    { code: "1001", hex: "#F0EAD6", systemId: jotunSystem.id },
    { code: "2010", hex: "#E5E4E2", systemId: jotunSystem.id },
    { code: "3015", hex: "#C8B89A", systemId: jotunSystem.id },
    { code: "4020", hex: "#8B7355", systemId: jotunSystem.id },
    { code: "5025", hex: "#2F5D62", systemId: jotunSystem.id },
    // Pachin Colors
    { code: "P100", hex: "#FFFFFF", systemId: pachinSystem.id },
    { code: "P200", hex: "#F5F5DC", systemId: pachinSystem.id },
    { code: "P300", hex: "#FFE4B5", systemId: pachinSystem.id },
    { code: "P400", hex: "#D2B48C", systemId: pachinSystem.id },
    { code: "P500", hex: "#87CEEB", systemId: pachinSystem.id },
  ];

  for (const color of rawColors) {
    const lab = hexToLab(color.hex);
    await prisma.color.upsert({
      where: { code: color.code },
      update: {
        ...lab,
        hex: color.hex,
        colorSystemId: color.systemId,
      },
      create: {
        code: color.code,
        hex: color.hex,
        ...lab,
        colorSystemId: color.systemId,
      },
    });
  }
  console.log("Seeding Paints...");

  // 7. ===== Paints (Products) =====
  console.log("Seeding Paints...");
  const paint1 = await prisma.paint.create({
    data: {
      name: "جوتن فينوماستيك",
      description: "دهان داخلي عالي الجودة قابل للغسل",
      price: 850.5,
      stock: 50,
      coverage: 12.5,
      coatHours: 4,
      dryDays: 1,
      base: "water",
      finish: "semi_gloss",
      unit: "liter",
      usage: "indoor",
      vendorId: vendor.id,
      categoryId: catInterior.id,
      subCategoryId: subCatPlastic.id,
      colorId: 1,
    },
  });

  const paint2 = await prisma.paint.create({
    data: {
      name: "باكين بلاستيك لامع",
      description: "دهان بلاستيك لامع للحوائط الداخلية",
      price: 720.0,
      stock: 35,
      coverage: 11.0,
      coatHours: 3,
      dryDays: 1,
      base: "water",
      finish: "gloss",
      unit: "liter",
      usage: "indoor",
      vendorId: vendor.id,
      categoryId: catInterior.id,
      subCategoryId: subCatGlossy.id,
    },
  });

  const paint3 = await prisma.paint.create({
    data: {
      name: "سايبس دهان خارجي",
      description: "دهان خارجي مقاوم للعوامل الجوية",
      price: 950.0,
      stock: 40,
      coverage: 10.0,
      coatHours: 6,
      dryDays: 2,
      base: "water",
      finish: "matte",
      unit: "liter",
      usage: "outdoor",
      vendorId: vendor.id,
      categoryId: catExterior.id,
      subCategoryId: subCatWeatherproof.id,
    },
  });

  const paint4 = await prisma.paint.create({
    data: {
      name: "ورنيش خشب شفاف",
      description: "ورنيش عالي الجودة للأخشاب",
      price: 450.0,
      stock: 25,
      coverage: 15.0,
      coatHours: 8,
      dryDays: 1,
      base: "oil",
      finish: "gloss",
      unit: "liter",
      usage: "indoor",
      vendorId: vendor.id,
      categoryId: catWood.id,
      subCategoryId: subCatVarnish.id,
    },
  });
  const paintGLC = await prisma.paint.create({
    data: {
      name: "GLC داي تون 3030",
      description: "بلاستيك مطفي فائق البياض",
      price: 650.0,
      stock: 100,
      coverage: 10.0,
      coatHours: 2,
      dryDays: 1,
      base: "water",
      finish: "matte",
      unit: "liter",
      usage: "indoor",
      vendorId: vendorGLC.id,
      categoryId: catInterior.id,
      subCategoryId: subCatPlastic.id,
    },
  });
  const paintKapci = await prisma.paint.create({
    data: {
      name: "كابسي ووتر سيل",
      description: "عازل مائي شفاف ممتاز",
      price: 580.0,
      stock: 45,
      coverage: 8.0,
      coatHours: 6,
      dryDays: 2,
      base: "water",
      finish: "gloss",
      unit: "liter",
      usage: "outdoor",
      vendorId: vendorKapci.id,
      categoryId: catExterior.id,
      subCategoryId: subCatWeatherproof.id,
    },
  });

  // 8. ===== Painter Gallery =====
  console.log("Seeding Painter Gallery...");
  await prisma.painterGallery.createMany({
    data: [
      {
        painterId: painter.id,
        url: "gallery/painter1_work1.jpg",
      },
      {
        painterId: painter.id,
        url: "gallery/painter1_work2.jpg",
      },
      {
        painterId: painter.id,
        url: "gallery/painter1_work3.jpg",
      },
      {
        painterId: painter2.id,
        url: "gallery/painter2_work1.jpg",
      },
      {
        painterId: painter2.id,
        url: "gallery/painter2_work2.jpg",
      },
    ],
  });

  // 9. ===== Painter Reviews =====
  console.log("Seeding Painter Reviews...");
  await prisma.painterReview.createMany({
    data: [
      {
        painterId: painter.id,
        userId: regularUser.id,
        rating: 5.0,
        review: "عمل ممتاز ودقة في المواعيد، أنصح بالتعامل معه",
      },
      {
        painterId: painter.id,
        userId: regularUser2.id,
        rating: 4.5,
        review: "فني محترف وشغل نظيف جداً",
      },
      {
        painterId: painter2.id,
        userId: regularUser.id,
        rating: 4.0,
        review: "جيد جداً ولكن تأخر قليلاً في المواعيد",
      },
    ],
  });

  // 10. ===== Painter Visits =====
  console.log("Seeding Painter Visits...");
  await prisma.painterVisit.createMany({
    data: [
      {
        userId: regularUser.id,
        painterId: painter.id,
        visitDate: new Date("2024-03-15T10:00:00"),
        area: 120.5,
        city: "القاهرة",
        region: "مدينة نصر",
        status: "completed",
      },
      {
        userId: regularUser2.id,
        painterId: painter.id,
        visitDate: new Date("2024-03-20T14:00:00"),
        area: 85.0,
        city: "الجيزة",
        region: "المهندسين",
        status: "accepted",
      },
      {
        userId: regularUser.id,
        painterId: painter2.id,
        visitDate: new Date("2024-03-25T11:00:00"),
        area: 150.0,
        city: "القاهرة",
        region: "مصر الجديدة",
        status: "pending",
      },
    ],
  });

  // 11. ===== Favorite Colors =====
  console.log("Seeding Favorite Colors...");
  await prisma.favoriteColor.createMany({
    data: [
      {
        userId: regularUser.id,
        colorCode: "1001",
      },
      {
        userId: regularUser.id,
        colorCode: "3015",
      },
      {
        userId: regularUser.id,
        colorCode: "P100",
      },
      {
        userId: regularUser2.id,
        colorCode: "2010",
      },
      {
        userId: regularUser2.id,
        colorCode: "P500",
      },
    ],
  });

  // 12. ===== Carts =====
  console.log("Seeding Carts...");
  const cart1 = await prisma.cart.upsert({
    where: { userId: regularUser.id },
    update: {},
    create: {
      userId: regularUser.id,
    },
  });

  const cart2 = await prisma.cart.upsert({
    where: { userId: regularUser2.id },
    update: {},
    create: {
      userId: regularUser2.id,
    },
  });

  // 13. ===== Cart Items =====
  console.log("Seeding Cart Items...");
  await prisma.cartItem.createMany({
    data: [
      {
        cartId: cart1.id,
        paintId: paint1.id,
        quantity: 2,
      },
      {
        cartId: cart1.id,
        paintId: paint3.id,
        quantity: 1,
      },
      {
        cartId: cart2.id,
        paintId: paint2.id,
        quantity: 3,
      },
      {
        cartId: cart2.id,
        paintId: paint4.id,
        quantity: 1,
      },
    ],
  });

  // 14. ===== Orders =====
  console.log("Seeding Orders...");
  const order1 = await prisma.order.upsert({
    where: { orderNumber: "INV-2026-0001" },
    update: {},
    create: {
      userId: regularUser.id,
      painterId: painter.id,
      totalPrice: 2551.5,
      status: "completed",
      orderNumber: "INV-2026-0001",
      source: "app",
      paymentType: "cash",
      isPaid: true,
    },
  });

  const order2 = await prisma.order.upsert({
    where: { orderNumber: "INV-2026-0002" },
    update: {},
    create: {
      userId: regularUser2.id,
      totalPrice: 2160.0,
      status: "accepted",
      orderNumber: "INV-2026-0002",
      source: "app",
      paymentType: "cash",
      isPaid: true,
    },
  });

  const order3 = await prisma.order.upsert({
    where: { orderNumber: "INV-2026-0003" },
    update: {},
    create: {
      userId: regularUser.id,
      totalPrice: 950.0,
      status: "pending",
      orderNumber: "INV-2026-0003",
      source: "app",
      paymentType: "cash",
      isPaid: true,
    },
  });

  // 15. ===== Order Items =====
  console.log("Seeding Order Items...");
  await prisma.orderItem.createMany({
    data: [
      // Order 1 items
      {
        orderId: order1.id,
        paintId: paint1.id,
        quantity: 2,
        price: 50.0,
      },
      {
        orderId: order1.id,
        paintId: paint3.id,
        quantity: 1,
        price: 120.5,
      },
      // Order 2 items
      {
        orderId: order2.id,
        paintId: paint2.id,
        quantity: 3,
        price: 75.0,
      },
      // Order 3 items
      {
        orderId: order3.id,
        paintId: paint3.id,
        quantity: 1,
        price: 120.5,
      },
    ],
  });
  // 15. ===== Invoices =====
  console.log("Seeding Invoices...");
  await prisma.invoice.upsert({
    where: { invoiceNumber: order1.orderNumber },
    update: {},
    create: {
      invoiceNumber: order1.orderNumber,
      amount: order1.totalPrice,
      status: "paid",
      customerId: order1.userId,
      orderId: order1.id,
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: order2.orderNumber },
    update: {},
    create: {
      invoiceNumber: order2.orderNumber,
      amount: order2.totalPrice,
      status: "pending",
      customerId: order2.userId,
      orderId: order2.id,
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: order3.orderNumber },
    update: {},
    create: {
      invoiceNumber: order3.orderNumber,
      amount: order3.totalPrice,
      status: "paid",
      customerId: order3.userId,
      orderId: order3.id,
    },
  });
  // 16. ===== Offers =====
  console.log("Seeding Offers...");
  await prisma.offer.createMany({
    data: [
      {
        title: "خصم 20% على جميع الدهانات الداخلية",
        discount: 20.0,
        discountType: "percentage",
        isActive: true,
      },
      {
        title: "خصم 100 جنيه على الدهانات الخارجية",
        discount: 100.0,
        discountType: "fixed",
        isActive: true,
      },
      {
        title: "عرض الصيف - خصم 15%",
        discount: 15.0,
        discountType: "percentage",
        isActive: false,
      },
      {
        title: "خصم 50 جنيه على دهانات الخشب",
        discount: 50.0,
        discountType: "fixed",
        isActive: true,
      },
    ],
  });
  // 17. ===== Wallet Transactions (Experimental Data) =====
  console.log("Seeding Wallet Transactions...");

  const sampleNetProfit = 900.0;

  await prisma.walletTransaction.createMany({
    data: [
      {
        userId: vendorUser.id,
        amount: sampleNetProfit,
        type: "SALE_PROFIT",
        orderId: order1.id,
        createdAt: new Date("2026-02-10T10:00:00Z"),
      },
      {
        userId: vendorUser.id,
        amount: 500.0,
        type: "SALE_PROFIT",
        orderId: order2.id,
        createdAt: new Date("2026-02-12T15:30:00Z"),
      },
    ],
  });
  await prisma.walletTransaction.create({
    data: {
      userId: vendorGLCUser.id,
      amount: 2000.0,
      type: "SALE_PROFIT",
      createdAt: new Date(),
    },
  });
  await prisma.user.update({
    where: { id: vendorUser.id },
    data: { balance: sampleNetProfit },
  });
  await prisma.user.update({
    where: { id: vendorGLCUser.id },
    data: { balance: 2000.0 },
  });
  await prisma.user.update({
    where: { id: vendorKapciUser.id },
    data: { balance: 0.0 },
  });
  console.log("Seeding completed successfully! 🌱");
}
// 18. ===== App Settings =====
console.log("Seeding App Settings...");
const settingsData = [
  { key: "app_name", value: "Paint Master" },
  { key: "support_email", value: "support@paintmaster.com" },
  { key: "support_phone", value: "+20 123 456 789" },
  { key: "app_logo", value: "https://your-domain.com/logo.png" },
  { key: "onboarding_1", value: "تصفح آلاف الدهانات من أفضل الشركات" },
  { key: "onboarding_2", value: "اطلب فني طلاء خبير بضغطة زر" },
];

for (const setting of settingsData) {
  await prisma.appSetting.upsert({
    where: { key: setting.key },
    update: {},
    create: setting,
  });
}

console.log("Seeding Home Banners...");
await prisma.homeBanner.createMany({
  data: [
    {
      imageUrl: "banner1.jpg",
      title_ar: "خصومات الربيع",
      title_en: "Spring Discounts",
      displayOrder: 1,
    },
    {
      imageUrl: "banner2.jpg",
      title_ar: "جدد منزلك الآن",
      title_en: "Renovate Your Home",
      displayOrder: 2,
    },
  ],
});
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
