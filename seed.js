// seed.js - بيانات في كل الجداول: user, vendor, category, subcategory, offer, attribute,
// paint, paintattribute, painter, order, orderitem, cart, favoritecolor, favoriteproduct,
// selection, chatmessage, designerprofile, otp, paintergallery, painterreview, usercategory
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const adminPass = await bcrypt.hash("Admin@123", 10);
  const vendorPass = await bcrypt.hash("Vendor@123", 10);
  const userPass = await bcrypt.hash("User@123", 10);

  // ========== 1. المستخدمون (user) ==========
  const admin = await prisma.user.upsert({
    where: { email: "admin@paintapp.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@paintapp.com",
      phone: "01000000000",
      password: adminPass,
      role: "admin",
    },
  });

  const vendorUser = await prisma.user.upsert({
    where: { email: "vendor@example.com" },
    update: {},
    create: {
      name: "أحمد تاجر الدهانات",
      email: "vendor@example.com",
      phone: "01000000001",
      password: vendorPass,
      role: "vendor",
    },
  });

  const vendorUser2 = await prisma.user.upsert({
    where: { email: "vendor2@example.com" },
    update: {},
    create: {
      name: "فاطمة متجر الألوان",
      email: "vendor2@example.com",
      phone: "01000000011",
      password: vendorPass,
      role: "vendor",
    },
  });

  const painterUser = await prisma.user.upsert({
    where: { email: "painter@example.com" },
    update: {},
    create: {
      name: "محمد الدهان",
      email: "painter@example.com",
      phone: "01000000002",
      password: userPass,
      role: "painter",
    },
  });

  const painterUser2 = await prisma.user.upsert({
    where: { email: "painter2@example.com" },
    update: {},
    create: {
      name: "خالد فني الدهانات",
      email: "painter2@example.com",
      phone: "01000000012",
      password: userPass,
      role: "painter",
    },
  });

  const normalUser = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      name: "عميل تجريبي",
      email: "user@example.com",
      phone: "01000000003",
      password: userPass,
      role: "user",
    },
  });

  const normalUser2 = await prisma.user.upsert({
    where: { email: "user2@example.com" },
    update: {},
    create: {
      name: "سارة عميلة",
      email: "user2@example.com",
      phone: "01000000013",
      password: userPass,
      role: "user",
    },
  });

  // ========== 1b. مصممون (designer) ==========
  let designer1;
  let designer2;
  try {
    designer1 = await prisma.user.upsert({
      where: { email: "designer@paintapp.com" },
      update: {},
      create: {
        name: "سلمى المصممة",
        email: "designer@paintapp.com",
        phone: "01000000030",
        password: userPass,
        role: "designer",
      },
    });
    designer2 = await prisma.user.upsert({
      where: { email: "designer2@paintapp.com" },
      update: {},
      create: {
        name: "كريم مصمم ديكور",
        email: "designer2@paintapp.com",
        phone: "01000000031",
        password: userPass,
        role: "designer",
      },
    });
  } catch (err) {
    if (err.message && err.message.includes("user_role")) {
      await prisma.$executeRawUnsafe(
        "INSERT INTO `user` (name, email, phone, password, role, createdAt) VALUES (?, ?, ?, ?, 'designer', NOW()) ON DUPLICATE KEY UPDATE role = 'designer'",
        "سلمى المصممة",
        "designer@paintapp.com",
        "01000000030",
        userPass,
      );
      await prisma.$executeRawUnsafe(
        "INSERT INTO `user` (name, email, phone, password, role, createdAt) VALUES (?, ?, ?, ?, 'designer', NOW()) ON DUPLICATE KEY UPDATE role = 'designer'",
        "كريم مصمم ديكور",
        "designer2@paintapp.com",
        "01000000031",
        userPass,
      );
      const rows = await prisma.$queryRawUnsafe(
        "SELECT id, email FROM `user` WHERE email IN (?, ?)",
        "designer@paintapp.com",
        "designer2@paintapp.com",
      );
      designer1 = rows[0];
      designer2 = rows[1];
    } else {
      throw err;
    }
  }

  // ========== 2. البائع (vendor) ==========
  const vendor = await prisma.vendor.upsert({
    where: { userId: vendorUser.id },
    update: {},
    create: {
      userId: vendorUser.id,
      shopName: "متجر الدهانات الحديثة",
      city: "القاهرة",
      address: "شارع التحرير 123",
    },
  });

  const vendor2 = await prisma.vendor.upsert({
    where: { userId: vendorUser2.id },
    update: {},
    create: {
      userId: vendorUser2.id,
      shopName: "متجر الألوان",
      city: "الإسكندرية",
      address: "طريق الكورنيش 45",
    },
  });

  // ========== طلبات الموردين (موردون قيد الانتظار — للوحة طلبات الموردين) ==========
  const pendingVendorUser1 = await prisma.user.upsert({
    where: { email: "pending.vendor1@example.com" },
    update: {},
    create: {
      name: "شركة ألوان المستقبل",
      email: "pending.vendor1@example.com",
      phone: "01000000020",
      password: await bcrypt.hash("Vendor@123", 10),
      role: "vendor",
    },
  });
  const pendingVendorUser2 = await prisma.user.upsert({
    where: { email: "pending.vendor2@example.com" },
    update: {},
    create: {
      name: "محمد للدهانات والطلاء",
      email: "pending.vendor2@example.com",
      phone: "01000000021",
      password: await bcrypt.hash("Vendor@123", 10),
      role: "vendor",
    },
  });
  const pendingVendorUser3 = await prisma.user.upsert({
    where: { email: "pending.vendor3@example.com" },
    update: {},
    create: {
      name: "دهانات النخبة",
      email: "pending.vendor3@example.com",
      phone: "01000000022",
      password: await bcrypt.hash("Vendor@123", 10),
      role: "vendor",
    },
  });

  // استخدام raw SQL لطلبات الموردين (يعمل حتى لو لم يُنفَّذ prisma generate بعد تحديث السكاما)
  const pendingVendorsData = [
    [pendingVendorUser1.id, "ألوان المستقبل للتجارة", "القاهرة", "المعادي - برج ١", "المعادي", "12345678901234", 0, 0],
    [pendingVendorUser2.id, "محمد للدهانات", "الإسكندرية", "سموحة - شارع ٤٥", "سموحة", "98765432109876", 0, 1],
    [pendingVendorUser3.id, "دهانات النخبة", "الجيزة", "الشيخ زايد - مول بلازا", "الشيخ زايد", "55556666777788", 0, 0],
  ];
  for (const row of pendingVendorsData) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO vendor (userId, shopName, city, address, region, taxRegistration, isApproved, paymentStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE shopName=VALUES(shopName), city=VALUES(city), address=VALUES(address),
       region=VALUES(region), taxRegistration=VALUES(taxRegistration), isApproved=VALUES(isApproved), paymentStatus=VALUES(paymentStatus)`,
      ...row,
    );
  }

  // ========== 3. التصنيفات (category) ==========
  const catInterior = await prisma.category.upsert({
    where: { name: "Interior" },
    update: {},
    create: { name: "Interior", description: "دهانات داخلية" },
  });
  const catExterior = await prisma.category.upsert({
    where: { name: "Exterior" },
    update: {},
    create: { name: "Exterior", description: "دهانات خارجية" },
  });
  const catPremium = await prisma.category.upsert({
    where: { name: "Premium" },
    update: {},
    create: { name: "Premium", description: "دهانات فاخرة" },
  });

  // ========== 4. التصنيفات الفرعية (subcategory) ==========
  const sub1 = await prisma.subcategory.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "ديكور داخلي", categoryId: catInterior.id },
  });
  const sub2 = await prisma.subcategory.upsert({
    where: { id: 2 },
    update: {},
    create: { name: "واجهات", categoryId: catExterior.id },
  });
  const sub3 = await prisma.subcategory.upsert({
    where: { id: 3 },
    update: {},
    create: { name: "بريميوم داخلي", categoryId: catPremium.id },
  });

  // ========== 5. العروض (offer) ==========
  const now = new Date();
  const offerEnd = new Date(now);
  offerEnd.setMonth(offerEnd.getMonth() + 1);
  const offer = await prisma.offer.upsert({
    where: { id: 1 },
    update: {},
    create: {
      title: "خصم 20% على البريميوم",
      discount: 20,
      isActive: true,
      startDate: now,
      endDate: offerEnd,
      discountType: "percentage",
    },
  });
  const offer2 = await prisma.offer.upsert({
    where: { id: 2 },
    update: {},
    create: {
      title: "عرض الخارجي",
      discount: 15,
      isActive: true,
      startDate: now,
      endDate: offerEnd,
      discountType: "percentage",
    },
  });

  // ========== 6. الصفات (attribute) ==========
  const attr1 = await prisma.attribute.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "قابل للغسل" },
  });
  const attr2 = await prisma.attribute.upsert({
    where: { id: 2 },
    update: {},
    create: { name: "صديق للبيئة" },
  });
  const attr3 = await prisma.attribute.upsert({
    where: { id: 3 },
    update: {},
    create: { name: "مقاوم للماء" },
  });

  // ========== 7. الدهانات (paint) ==========
  const paint1 = await prisma.paint.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "دهان بريميوم داخلي",
      type: "acrylic",
      description: "دهان داخلي عالي الجودة",
      price: 150,
      unit: "liter",
      coverage: 10,
      coatHours: 4,
      dryDays: 2,
      finish: "matte",
      usage: "indoor",
      base: "water",
      stock: 50,
      categoryId: catPremium.id,
      subCategoryId: sub3.id,
      vendorId: vendor.id,
      offerId: offer.id,
      updatedAt: now,
    },
  });

  const paint2 = await prisma.paint.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: "دهان خارجي واجهات",
      type: "weatherproof",
      description: "مقاوم للطقس",
      price: 200,
      unit: "liter",
      coverage: 8,
      coatHours: 6,
      dryDays: 3,
      finish: "semi_gloss",
      usage: "outdoor",
      base: "water",
      stock: 30,
      categoryId: catExterior.id,
      subCategoryId: sub2.id,
      vendorId: vendor.id,
      updatedAt: now,
    },
  });

  const paint3 = await prisma.paint.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: "دهان ديكور داخلي",
      type: "latex",
      description: "للغرف والمعيشة",
      price: 80,
      unit: "liter",
      coverage: 12,
      coatHours: 2,
      dryDays: 1,
      finish: "matte",
      usage: "indoor",
      base: "water",
      stock: 100,
      categoryId: catInterior.id,
      subCategoryId: sub1.id,
      vendorId: vendor.id,
      updatedAt: now,
    },
  });

  const paint4 = await prisma.paint.upsert({
    where: { id: 4 },
    update: {},
    create: {
      name: "دهان زيتي لامع",
      type: "oil",
      description: "لمعان عالي",
      price: 180,
      unit: "liter",
      coverage: 9,
      coatHours: 8,
      dryDays: 3,
      finish: "gloss",
      usage: "indoor",
      base: "oil",
      stock: 25,
      categoryId: catPremium.id,
      subCategoryId: sub3.id,
      vendorId: vendor2.id,
      offerId: offer.id,
      updatedAt: now,
    },
  });

  const paint5 = await prisma.paint.upsert({
    where: { id: 5 },
    update: {},
    create: {
      name: "دهان خارجي اقتصادي",
      type: "emulsion",
      description: "مناسب للأسطح الكبيرة",
      price: 65,
      unit: "liter",
      coverage: 14,
      coatHours: 3,
      dryDays: 2,
      finish: "matte",
      usage: "outdoor",
      base: "water",
      stock: 80,
      categoryId: catExterior.id,
      subCategoryId: sub2.id,
      vendorId: vendor2.id,
      updatedAt: now,
    },
  });

  const paint6 = await prisma.paint.upsert({
    where: { id: 6 },
    update: {},
    create: {
      name: "دهان أبيض نقي - نقص مخزون",
      type: "latex",
      description: "للمساحات الصغيرة",
      price: 55,
      unit: "liter",
      coverage: 11,
      coatHours: 2,
      dryDays: 1,
      finish: "matte",
      usage: "indoor",
      base: "water",
      stock: 3,
      categoryId: catInterior.id,
      subCategoryId: sub1.id,
      vendorId: vendor.id,
      updatedAt: now,
    },
  });

  // ========== 8. ربط الدهان بالصفات (paintattribute) ==========
  await prisma.paintattribute.upsert({
    where: { paintId_attributeId: { paintId: paint1.id, attributeId: attr1.id } },
    update: {},
    create: { paintId: paint1.id, attributeId: attr1.id },
  });
  await prisma.paintattribute.upsert({
    where: { paintId_attributeId: { paintId: paint1.id, attributeId: attr2.id } },
    update: {},
    create: { paintId: paint1.id, attributeId: attr2.id },
  });
  await prisma.paintattribute.upsert({
    where: { paintId_attributeId: { paintId: paint2.id, attributeId: attr3.id } },
    update: {},
    create: { paintId: paint2.id, attributeId: attr3.id },
  });
  await prisma.paintattribute.upsert({
    where: { paintId_attributeId: { paintId: paint4.id, attributeId: attr1.id } },
    update: {},
    create: { paintId: paint4.id, attributeId: attr1.id },
  });

  // ========== 9. الدهّان (painter) ==========
  const painter = await prisma.painter.upsert({
    where: { userId: painterUser.id },
    update: {},
    create: {
      userId: painterUser.id,
      city: "الجيزة",
      address: "حي الهرم",
      experience: 5,
      serviceType: "interior",
      rating: 4.5,
    },
  });

  const painter2 = await prisma.painter.upsert({
    where: { userId: painterUser2.id },
    update: {},
    create: {
      userId: painterUser2.id,
      city: "الإسكندرية",
      address: "سموحة",
      experience: 3,
      serviceType: "exterior",
      rating: 4,
    },
  });

  // ========== 10. الطلبات (order) ==========
  const order1 = await prisma.order.create({
    data: {
      userId: normalUser.id,
      painterId: painter.id,
      totalPrice: 350,
      status: "pending",
      area: 50,
      serviceDate: new Date(),
      serviceTime: "10:00",
      zone: "القاهرة",
    },
  });
  const order2 = await prisma.order.create({
    data: {
      userId: normalUser.id,
      totalPrice: 230,
      status: "delivered",
    },
  });
  const order3 = await prisma.order.create({
    data: {
      userId: normalUser2.id,
      painterId: painter2.id,
      totalPrice: 420,
      status: "pending",
      area: 60,
      zone: "الإسكندرية",
    },
  });

  const order4 = await prisma.order.create({
    data: {
      userId: normalUser.id,
      totalPrice: 175,
      status: "delivered",
    },
  });
  const order5 = await prisma.order.create({
    data: {
      userId: normalUser2.id,
      painterId: painter.id,
      totalPrice: 290,
      status: "pending",
      area: 30,
      zone: "الجيزة",
    },
  });

  // ========== 11. عناصر الطلب (orderitem) ==========
  await prisma.orderitem.create({
    data: { orderId: order1.id, paintId: paint1.id, quantity: 2 },
  });
  await prisma.orderitem.create({
    data: { orderId: order1.id, paintId: paint3.id, quantity: 1 },
  });
  await prisma.orderitem.create({
    data: { orderId: order2.id, paintId: paint2.id, quantity: 1 },
  });
  await prisma.orderitem.create({
    data: { orderId: order3.id, paintId: paint4.id, quantity: 2 },
  });
  await prisma.orderitem.create({
    data: { orderId: order3.id, paintId: paint5.id, quantity: 1 },
  });
  await prisma.orderitem.create({
    data: { orderId: order4.id, paintId: paint1.id, quantity: 1 },
  });
  await prisma.orderitem.create({
    data: { orderId: order5.id, paintId: paint2.id, quantity: 1 },
  });
  await prisma.orderitem.create({
    data: { orderId: order5.id, paintId: paint3.id, quantity: 1 },
  });

  // ========== 12. السلة (cart) ==========
  await prisma.cart.create({
    data: { userId: normalUser.id, paintId: paint1.id, quantity: 1 },
  });
  await prisma.cart.create({
    data: { userId: normalUser.id, paintId: paint3.id, quantity: 2 },
  });
  await prisma.cart.create({
    data: { userId: normalUser2.id, paintId: paint4.id, quantity: 1 },
  });

  // ========== 13. اللون المفضل (favoritecolor) ==========
  await prisma.favoritecolor.create({
    data: { userId: normalUser.id, colorCode: "#FFFFFF", name: "أبيض" },
  });
  await prisma.favoritecolor.create({
    data: { userId: normalUser.id, colorCode: "#F5F5DC", name: "بيج" },
  });
  await prisma.favoritecolor.create({
    data: { userId: normalUser2.id, colorCode: "#87CEEB", name: "أزرق سماوي" },
  });
  await prisma.favoritecolor.create({
    data: { userId: normalUser2.id, colorCode: "#FFE4B5", name: "موف" },
  });

  // ========== 14. المنتج المفضل (favoriteproduct) ==========
  await prisma.favoriteproduct.upsert({
    where: { userId_paintId: { userId: normalUser.id, paintId: paint1.id } },
    update: {},
    create: { userId: normalUser.id, paintId: paint1.id },
  });
  await prisma.favoriteproduct.upsert({
    where: { userId_paintId: { userId: normalUser.id, paintId: paint3.id } },
    update: {},
    create: { userId: normalUser.id, paintId: paint3.id },
  });
  await prisma.favoriteproduct.upsert({
    where: { userId_paintId: { userId: normalUser2.id, paintId: paint4.id } },
    update: {},
    create: { userId: normalUser2.id, paintId: paint4.id },
  });

  // ========== 15. الاختيار / المحاكاة (selection) ==========
  await prisma.selection.create({
    data: {
      userId: normalUser.id,
      paintId: paint1.id,
      area: 25,
      recommendedQuantity: 3,
      colorCode: "#FFF8DC",
    },
  });
  await prisma.selection.create({
    data: {
      userId: normalUser2.id,
      paintId: paint2.id,
      area: 40,
      recommendedQuantity: 5,
      colorCode: "#F0E68C",
    },
  });

  // ========== 16. رسائل الشات (chatmessage) ==========
  await prisma.chatmessage.create({
    data: {
      userId: normalUser.id,
      message: "ما هي أفضل دهانات الغرف؟",
      response: "ننصح بدهان البريميوم الداخلي للغرف.",
    },
  });
  await prisma.chatmessage.create({
    data: {
      userId: normalUser2.id,
      message: "هل يوجد توصيل؟",
      response: "نعم، التوصيل متاح لجميع المحافظات.",
    },
  });

  // ========== 17. بروفيل المصمم (designerprofile) ==========
  await prisma.designerprofile.upsert({
    where: { userId: normalUser.id },
    update: {},
    create: {
      userId: normalUser.id,
      experience: 2,
      specialties: "ديكور داخلي",
      rating: 4,
      portfolio: "https://example.com/portfolio",
    },
  });
  await prisma.designerprofile.upsert({
    where: { userId: normalUser2.id },
    update: {},
    create: {
      userId: normalUser2.id,
      experience: 1,
      specialties: "ألوان",
      rating: 4.5,
    },
  });
  await prisma.designerprofile.upsert({
    where: { userId: designer1.id },
    update: {},
    create: {
      userId: designer1.id,
      experience: 5,
      specialties: "ديكور داخلي، ألوان الجدران",
      rating: 4.8,
      portfolio: "https://example.com/salma-portfolio",
    },
  });
  await prisma.designerprofile.upsert({
    where: { userId: designer2.id },
    update: {},
    create: {
      userId: designer2.id,
      experience: 3,
      specialties: "تصميم واجهات، طلاء خارجي",
      rating: 4.5,
      portfolio: "https://example.com/karim-portfolio",
    },
  });

  // ========== 17b. التصاميم (design) — مصممين وتصميمات ==========
  const designData = [
    {
      designerId: designer1.id,
      title: "صالون بألوان محايدة",
      description: "تصميم صالون عصري بألوان بيج ورمادي مع لمسات ذهبية. مناسب للمساحات المتوسطة والكبيرة.",
      imageUrl: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800",
      videoUrl: null,
    },
    {
      designerId: designer1.id,
      title: "غرفة نوم هادئة",
      description: "غرفة نوم بألوان أزرق وبني فاتح مع إضاءة دافئة. جو مريح للنوم.",
      imageUrl: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800",
      videoUrl: null,
    },
    {
      designerId: designer1.id,
      title: "مطبخ أبيض لامع",
      description: "مطبخ حديث باللون الأبيض مع خزائن لامعة وبلاط رمادي. سهل التنظيف وعصري.",
      imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
      videoUrl: null,
    },
    {
      designerId: designer2.id,
      title: "واجهة منزل كلاسيكية",
      description: "طلاء واجهة خارجية بألوان كريمي وأبيض. يناسب الطراز الكلاسيكي والفلل.",
      imageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
      videoUrl: null,
    },
    {
      designerId: designer2.id,
      title: "غرفة أطفال ملونة",
      description: "غرفة أطفال بألوان زاهية وآمنة. جدران قابلة للغسل ومناسبة للألعاب.",
      imageUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800",
      videoUrl: null,
    },
    {
      designerId: designer2.id,
      title: "صالة استقبال فاخرة",
      description: "صالة استقبال بلون ذهبي وبني. إحساس بالفخامة والترحيب.",
      imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
      videoUrl: null,
    },
  ];
  for (const d of designData) {
    try {
      await prisma.design.create({ data: d });
    } catch (err) {
      if (err.code !== "P2002") console.warn("Design seed skip:", err.message);
    }
  }

  // ========== 18. OTP (otp) ==========
  const otpExpiry = new Date();
  otpExpiry.setMinutes(otpExpiry.getMinutes() + 10);
  await prisma.otp.create({
    data: {
      phone: "01000000003",
      code: "1234",
      expiresAt: otpExpiry,
      used: false,
    },
  });
  await prisma.otp.create({
    data: {
      phone: "01000000013",
      code: "5678",
      expiresAt: otpExpiry,
      used: true,
    },
  });

  // ========== 19. معرض الدهّان (paintergallery) ==========
  await prisma.paintergallery.create({
    data: { painterId: painter.id, imageUrl: "/uploads/painter-work-1.jpg" },
  });
  await prisma.paintergallery.create({
    data: { painterId: painter.id, imageUrl: "/uploads/painter-work-2.jpg" },
  });
  await prisma.paintergallery.create({
    data: { painterId: painter2.id, imageUrl: "/uploads/painter2-work-1.jpg" },
  });

  // ========== 20. تقييم الدهّان (painterreview) ==========
  await prisma.painterreview.create({
    data: {
      painterId: painter.id,
      userId: normalUser.id,
      review: "عمل ممتاز وجودة عالية",
      rating: 5,
    },
  });
  await prisma.painterreview.create({
    data: {
      painterId: painter2.id,
      userId: normalUser2.id,
      review: "منظم وسريع",
      rating: 4,
    },
  });

  // ========== 21. تصنيفات المستخدم (usercategory) ==========
  await prisma.usercategory.upsert({
    where: {
      userId_categoryId: { userId: normalUser.id, categoryId: catInterior.id },
    },
    update: {},
    create: { userId: normalUser.id, categoryId: catInterior.id },
  });
  await prisma.usercategory.upsert({
    where: {
      userId_categoryId: { userId: normalUser.id, categoryId: catPremium.id },
    },
    update: {},
    create: { userId: normalUser.id, categoryId: catPremium.id },
  });
  await prisma.usercategory.upsert({
    where: {
      userId_categoryId: { userId: normalUser2.id, categoryId: catExterior.id },
    },
    update: {},
    create: { userId: normalUser2.id, categoryId: catExterior.id },
  });

  // ========== 21b. أنظمة الألوان للمحول: لم تعد تُخزَّن في الداتابيز — المصدر هو src/data/colorPalettes.js + chroma-js ==========

  // ========== 22. سجلات التدقيق (auditlog) — raw SQL ليعمل دون إعادة توليد Prisma Client ==========
  const auditUsers = [admin.id, vendorUser.id, normalUser.id, normalUser2.id];
  const auditActions = [
    { action: "LOGIN", details: "تسجيل دخول من لوحة الإدارة - IP: 192.168.1.10" },
    { action: "CREATE_USER", details: "إنشاء مستخدم جديد: عميل تجريبي (user@example.com)" },
    { action: "CREATE_USER", details: "إنشاء مستخدم جديد: سارة عميلة (user2@example.com)" },
    { action: "UPDATE_PRICE", details: "تحديث سعر منتج: دهان داخلي فاخر - من 120 إلى 125 EGP" },
    { action: "UPDATE_PRICE", details: "تحديث سعر منتج: دهان خارجي اقتصادي - من 65 إلى 68 EGP" },
    { action: "DELETE_PRODUCT", details: "حذف منتج من المخزون: صنف قديم (ID: 99)" },
    { action: "LOGIN", details: "تسجيل دخول من تطبيق الموبايل - جهاز Android" },
    { action: "CREATE_USER", details: "طلب انضمام مورد جديد: ألوان المستقبل للتجارة" },
    { action: "UPDATE_PRICE", details: "تعديل أسعار عرض الخصم على دهان داخلي فاخر" },
    { action: "LOGIN", details: "تسجيل دخول من لوحة الإدارة - جلسة منتهية الصلاحية تم تجديدها" },
  ];
  for (let i = 0; i < auditActions.length; i++) {
    const createdAt = new Date(Date.now() - (auditActions.length - i) * 3600000);
    await prisma.$executeRawUnsafe(
      `INSERT INTO auditlog (userId, action, details, createdAt) VALUES (?, ?, ?, ?)`,
      auditUsers[i % auditUsers.length],
      auditActions[i].action,
      auditActions[i].details,
      createdAt,
    );
  }

  console.log("✅ تم إضافة البيانات في كل الجداول:");
  console.log("   user, vendor, category, subcategory, offer, attribute, paint, paintattribute,");
  console.log("   painter, order, orderitem, cart, favoritecolor, favoriteproduct, selection,");
  console.log("   chatmessage, designerprofile, otp, paintergallery, painterreview, usercategory, auditlog");
  console.log("  الدخول للداشبورد: 01000000000 / Admin@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
