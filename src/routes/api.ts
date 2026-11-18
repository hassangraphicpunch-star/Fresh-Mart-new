import { Router } from 'express';
import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { db } from '../db/index.ts';
import {
  categories,
  deliveryAreas,
  orderItems,
  orderStatusHistory,
  orders,
  products,
  ProductVariant,
  storeSettings,
  whatsappLogs,
} from '../db/schema.ts';
import { ensureSeedData } from '../db/seed.ts';
import { AuthRequest, requireAdmin, requireAuth } from '../middleware/auth.ts';
import { calculateKarachiRoadDistance } from '../services/maps.ts';
import {
  dispatchOrderWhatsappNotifications,
  retryWhatsappDelivery,
  sendOrderUpdateWhatsapp,
} from '../services/whatsapp.ts';

const uploadsDir = path.resolve(process.cwd(), 'uploads', 'products');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    cb(null, `${safeBase}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|gif)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WebP, or GIF images are allowed'));
    }
  },
});

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'fresh-mart-api' });
});

// Lazily ensure seed data before any storefront/admin API call
apiRouter.use(async (_req, res, next) => {
  try {
    await ensureSeedData();
    next();
  } catch (error) {
    console.error('Seed initialization failed:', error);
    res.status(500).json({ error: 'Database initialization failed. Please try again.' });
  }
});

// Helper to expose safe public settings (never exposing WhatsApp access token)
function toPublicSettings(settings: typeof storeSettings.$inferSelect | undefined) {
  return {
    storeName: settings?.storeName ?? 'Fresh Mart',
    storeNameUr: settings?.storeNameUr ?? 'فریش مارٹ',
    storeAddress:
      settings?.storeAddress ??
      'House No. L-94, Sector L-1, Surjani Town, Karachi, Pakistan',
    storeAddressUr:
      settings?.storeAddressUr ??
      'مکان نمبر L-94، سیکٹر L-1، سرجانی ٹاؤن، کراچی، پاکستان',
    storeLat: settings?.storeLat ?? 25.0085,
    storeLng: settings?.storeLng ?? 67.0645,
    whatsappNumber: settings?.whatsappNumber ?? '03233469424',
    deliveryRatePerKm: settings?.deliveryRatePerKm ?? 50,
    deliveryEnabled: settings?.deliveryEnabled ?? true,
    defaultLanguage: settings?.defaultLanguage ?? 'en',
    openingHoursEn: settings?.openingHoursEn ?? 'Daily: 8:00 AM – 11:30 PM',
    openingHoursUr: settings?.openingHoursUr ?? 'روزانہ: صبح 8:00 تا رات 11:30',
    googleMapsBrowserKey:
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      settings?.googleMapsApiKey ||
      '',
    whatsappConfigured: Boolean(
      (settings?.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN) &&
        (settings?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID)
    ),
  };
}

// ---------- PUBLIC STOREFRONT ENDPOINTS ----------

apiRouter.get('/storefront', async (_req, res) => {
  try {
    const [settingsRows, categoryRows, productRows, areaRows] = await Promise.all([
      db.select().from(storeSettings).limit(1),
      db
        .select()
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.sortOrder), asc(categories.id)),
      db
        .select()
        .from(products)
        .where(eq(products.isAvailable, true))
        .orderBy(asc(products.id)),
      db
        .select()
        .from(deliveryAreas)
        .where(eq(deliveryAreas.isActive, true))
        .orderBy(asc(deliveryAreas.id)),
    ]);

    res.json({
      settings: toPublicSettings(settingsRows[0]),
      categories: categoryRows,
      products: productRows,
      deliveryAreas: areaRows,
    });
  } catch (error) {
    console.error('Failed to load storefront data:', error);
    res.status(500).json({ error: 'Unable to load store catalog right now.' });
  }
});

apiRouter.post('/delivery/calculate-distance', async (req, res) => {
  try {
    const { address, area, placeId, lat, lng } = req.body ?? {};

    if (!address || typeof address !== 'string' || address.trim().length < 4) {
      return res.status(400).json({
        error: 'Please enter a valid street/house delivery address.',
      });
    }
    if (!area || typeof area !== 'string' || area.trim().length < 2) {
      return res.status(400).json({
        error: 'Please select your Karachi delivery area.',
      });
    }

    const [settings] = await db.select().from(storeSettings).limit(1);
    if (settings && !settings.deliveryEnabled) {
      return res.status(400).json({
        error: 'Home delivery is currently paused by the store.',
      });
    }

    const result = await calculateKarachiRoadDistance({
      storeLat: settings?.storeLat ?? 25.0085,
      storeLng: settings?.storeLng ?? 67.0645,
      storeAddress:
        settings?.storeAddress ??
        'House No. L-94, Sector L-1, Surjani Town, Karachi, Pakistan',
      ratePerKm: settings?.deliveryRatePerKm ?? 50,
      customerAddress: address.trim(),
      customerArea: area.trim(),
      customerPlaceId: typeof placeId === 'string' ? placeId : undefined,
      customerLat: typeof lat === 'number' ? lat : undefined,
      customerLng: typeof lng === 'number' ? lng : undefined,
      apiKey: settings?.googleMapsApiKey,
    });

    res.json(result);
  } catch (error) {
    console.error('Distance calculation error:', error);
    res.status(500).json({
      error: 'Unable to verify delivery distance right now.',
    });
  }
});

apiRouter.post('/orders', async (req, res) => {
  try {
    const {
      idempotencyKey,
      customerName,
      customerPhone,
      deliveryArea,
      deliveryAddress,
      deliveryInstructions,
      customerPlaceId,
      customerLat,
      customerLng,
      language,
      items,
    } = req.body ?? {};

    // Input validation
    if (!customerName || typeof customerName !== 'string' || customerName.trim().length < 2) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }
    const cleanPhone = typeof customerPhone === 'string' ? customerPhone.replace(/\s|-/g, '') : '';
    if (!/^(\+92|0092|0)?3[0-9]{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        error: 'Please enter a valid Pakistani mobile number (e.g. 0323-3469424).',
      });
    }
    if (!deliveryArea || typeof deliveryArea !== 'string' || !deliveryArea.trim()) {
      return res.status(400).json({ error: 'Please select a Karachi delivery area.' });
    }
    if (!deliveryAddress || typeof deliveryAddress !== 'string' || deliveryAddress.trim().length < 5) {
      return res.status(400).json({ error: 'Please enter your complete delivery address.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your shopping cart is empty.' });
    }

    // Check duplicate submission via idempotencyKey
    if (typeof idempotencyKey === 'string' && idempotencyKey.trim()) {
      const existingOrder = await db
        .select()
        .from(orders)
        .where(eq(orders.idempotencyKey, idempotencyKey.trim()))
        .limit(1);

      if (existingOrder.length > 0) {
        const existingItems = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, existingOrder[0].id));
        const existingLogs = await db
          .select()
          .from(whatsappLogs)
          .where(eq(whatsappLogs.orderId, existingOrder[0].id));
        return res.status(200).json({
          order: existingOrder[0],
          items: existingItems,
          whatsappLogs: existingLogs,
          deduplicated: true,
        });
      }
    }

    const [settings] = await db.select().from(storeSettings).limit(1);
    if (settings && !settings.deliveryEnabled) {
      return res.status(400).json({ error: 'Delivery orders are currently disabled.' });
    }

    const ratePerKm = settings?.deliveryRatePerKm ?? 50;

    // Server-side Google Maps distance calculation BEFORE transaction
    const distanceInfo = await calculateKarachiRoadDistance({
      storeLat: settings?.storeLat ?? 25.0085,
      storeLng: settings?.storeLng ?? 67.0645,
      storeAddress:
        settings?.storeAddress ??
        'House No. L-94, Sector L-1, Surjani Town, Karachi, Pakistan',
      ratePerKm,
      customerAddress: deliveryAddress.trim(),
      customerArea: deliveryArea.trim(),
      customerPlaceId: typeof customerPlaceId === 'string' ? customerPlaceId : undefined,
      customerLat: typeof customerLat === 'number' ? customerLat : undefined,
      customerLng: typeof customerLng === 'number' ? customerLng : undefined,
      apiKey: settings?.googleMapsApiKey,
    });

    const createdResult = await db.transaction(async (tx) => {
      const productIds = Array.from(
        new Set(items.map((i: any) => Number(i.productId)).filter((id) => Number.isInteger(id) && id > 0))
      );

      if (productIds.length === 0) {
        throw new Error('VALIDATION:Invalid product selection.');
      }

      const dbProducts = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds));

      const productMap: Record<number, typeof products.$inferSelect> = {};
      for (const p of dbProducts) {
        productMap[p.id] = p;
      }

      let subtotalPkr = 0;
      const preparedItems: Array<{
        productId: number;
        productNameEn: string;
        productNameUr: string;
        variantLabelEn: string | null;
        variantLabelUr: string | null;
        unit: string;
        unitPricePkr: number;
        quantity: number;
        lineTotalPkr: number;
      }> = [];

      for (const rawItem of items) {
        const productId = Number(rawItem.productId);
        const quantity = Number(rawItem.quantity);
        const variantId = typeof rawItem.variantId === 'string' ? rawItem.variantId : null;

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
          throw new Error('VALIDATION:Quantity must be between 1 and 100.');
        }

        const prod = productMap[productId];
        if (!prod || !prod.isAvailable) {
          throw new Error(`VALIDATION:Product is unavailable.`);
        }

        let unitPricePkr = prod.discountPricePkr ?? prod.pricePkr;
        let unit = prod.unit;
        let variantLabelEn: string | null = null;
        let variantLabelUr: string | null = null;
        const variants = Array.isArray(prod.variantsJson) ? prod.variantsJson : [];

        if (variantId && variants.length > 0) {
          const matchedVariant = variants.find((v) => v.id === variantId);
          if (!matchedVariant) {
            throw new Error(`VALIDATION:Selected variant for ${prod.nameEn} is no longer available.`);
          }
          if (matchedVariant.stock < quantity) {
            throw new Error(
              `VALIDATION:Insufficient stock for ${prod.nameEn} (${matchedVariant.labelEn}). Available: ${matchedVariant.stock}`
            );
          }
          unitPricePkr = matchedVariant.discountPricePkr ?? matchedVariant.pricePkr;
          unit = matchedVariant.unit;
          variantLabelEn = matchedVariant.labelEn;
          variantLabelUr = matchedVariant.labelUr;

          const updatedVariants: ProductVariant[] = variants.map((v) =>
            v.id === variantId ? { ...v, stock: v.stock - quantity } : v
          );
          const nextStock = Math.max(0, prod.stock - quantity);
          await tx
            .update(products)
            .set({
              stock: nextStock,
              variantsJson: updatedVariants,
              updatedAt: new Date(),
            })
            .where(eq(products.id, prod.id));
          prod.stock = nextStock;
          prod.variantsJson = updatedVariants;
        } else {
          if (prod.stock < quantity) {
            throw new Error(
              `VALIDATION:Insufficient stock for ${prod.nameEn}. Available: ${prod.stock}`
            );
          }
          const nextStock = prod.stock - quantity;
          await tx
            .update(products)
            .set({ stock: nextStock, updatedAt: new Date() })
            .where(eq(products.id, prod.id));
          prod.stock = nextStock;
        }

        const lineTotalPkr = unitPricePkr * quantity;
        subtotalPkr += lineTotalPkr;
        preparedItems.push({
          productId: prod.id,
          productNameEn: prod.nameEn,
          productNameUr: prod.nameUr,
          variantLabelEn,
          variantLabelUr,
          unit,
          unitPricePkr,
          quantity,
          lineTotalPkr,
        });
      }

      const deliveryFeePkr =
        distanceInfo.verified && distanceInfo.deliveryFeePkr !== null
          ? distanceInfo.deliveryFeePkr
          : 0;
      const grandTotalPkr = subtotalPkr + deliveryFeePkr;

      const [{ maxId }] = await tx
        .select({ maxId: sql<number>`COALESCE(MAX(${orders.id}), 0)` })
        .from(orders);
      const orderNumber = `FM-${1001 + Number(maxId)}`;

      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          idempotencyKey:
            typeof idempotencyKey === 'string' && idempotencyKey.trim()
              ? idempotencyKey.trim()
              : null,
          customerName: customerName.trim(),
          customerPhone: cleanPhone,
          deliveryArea: deliveryArea.trim(),
          deliveryAddress: deliveryAddress.trim(),
          deliveryInstructions:
            typeof deliveryInstructions === 'string' && deliveryInstructions.trim()
              ? deliveryInstructions.trim()
              : null,
          customerLat: distanceInfo.customerLat,
          customerLng: distanceInfo.customerLng,
          distanceKm: distanceInfo.distanceKm,
          durationText: distanceInfo.durationText,
          distanceVerificationStatus: distanceInfo.status,
          deliveryRatePerKm: ratePerKm,
          subtotalPkr,
          deliveryFeePkr,
          grandTotalPkr,
          paymentMethod: 'COD',
          status: 'pending',
          language: language === 'ur' ? 'ur' : 'en',
        })
        .returning();

      const insertedItems = await tx
        .insert(orderItems)
        .values(preparedItems.map((i) => ({ ...i, orderId: newOrder.id })))
        .returning();

      await tx.insert(orderStatusHistory).values({
        orderId: newOrder.id,
        previousStatus: null,
        newStatus: 'pending',
        note: distanceInfo.verified
          ? `Order placed. Road distance verified: ${distanceInfo.distanceKm} km (Rs. ${deliveryFeePkr}).`
          : `Order placed. ${distanceInfo.reason || 'Delivery distance requires manual verification.'}`,
        changedByEmail: 'customer-checkout',
      });

      return { order: newOrder, items: insertedItems };
    });

    // Send official WhatsApp Cloud API notifications (customer + owner 03233469424)
    const logs = await dispatchOrderWhatsappNotifications(createdResult.order.id);

    res.status(201).json({
      order: createdResult.order,
      items: createdResult.items,
      whatsappLogs: logs,
      distanceNote: distanceInfo.reason || null,
    });
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.startsWith('VALIDATION:')) {
      return res.status(400).json({ error: error.message.replace('VALIDATION:', '') });
    }
    console.error('Order placement failed:', error);
    res.status(500).json({ error: 'Failed to submit order. Please try again.' });
  }
});

apiRouter.get('/orders/track/:orderNumber', async (req, res) => {
  try {
    const orderNumber = String(req.params.orderNumber || '').trim().toUpperCase();
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order number not found.' });
    }

    const [items, history, logs] = await Promise.all([
      db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
      db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, order.id))
        .orderBy(asc(orderStatusHistory.createdAt)),
      db
        .select({
          id: whatsappLogs.id,
          recipientType: whatsappLogs.recipientType,
          deliveryStatus: whatsappLogs.deliveryStatus,
          errorMessage: whatsappLogs.errorMessage,
          createdAt: whatsappLogs.createdAt,
        })
        .from(whatsappLogs)
        .where(eq(whatsappLogs.orderId, order.id)),
    ]);

    res.json({ order, items, history, whatsappLogs: logs });
  } catch (error) {
    console.error('Order tracking lookup failed:', error);
    res.status(500).json({ error: 'Unable to track order right now.' });
  }
});

// ---------- AUTH PROFILE ----------

apiRouter.get('/auth/me', requireAuth, (req: AuthRequest, res) => {
  res.json({
    user: req.dbUser,
  });
});

// ---------- ADMIN DASHBOARD ENDPOINTS ----------

apiRouter.get('/admin/dashboard', requireAdmin, async (_req, res) => {
  try {
    const [allOrders, allProducts] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(products),
    ]);

    const todayStr = new Date().toISOString().slice(0, 10);
    let todaysOrders = 0;
    let pendingOrders = 0;
    let confirmedOrders = 0;
    let processingOrders = 0;
    let outForDeliveryOrders = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    let totalSalesPkr = 0;

    for (const o of allOrders) {
      if (o.createdAt && o.createdAt.toISOString().slice(0, 10) === todayStr) {
        todaysOrders += 1;
      }
      switch (o.status) {
        case 'pending':
          pendingOrders += 1;
          break;
        case 'confirmed':
          confirmedOrders += 1;
          break;
        case 'processing':
          processingOrders += 1;
          break;
        case 'out_for_delivery':
          outForDeliveryOrders += 1;
          break;
        case 'delivered':
          deliveredOrders += 1;
          break;
        case 'cancelled':
          cancelledOrders += 1;
          break;
      }
      if (o.status !== 'cancelled') {
        totalSalesPkr += o.grandTotalPkr;
      }
    }

    const lowStockProducts = allProducts.filter((p) => p.stock <= 15);

    res.json({
      stats: {
        totalOrders: allOrders.length,
        todaysOrders,
        pendingOrders,
        confirmedOrders,
        processingOrders,
        outForDeliveryOrders,
        deliveredOrders,
        cancelledOrders,
        totalSalesPkr,
        totalProducts: allProducts.length,
        lowStockCount: lowStockProducts.length,
      },
      lowStockProducts,
      recentOrders: allOrders.slice(0, 8),
    });
  } catch (error) {
    console.error('Admin dashboard stats failed:', error);
    res.status(500).json({ error: 'Unable to load dashboard analytics.' });
  }
});

// Admin Orders
apiRouter.get('/admin/orders', requireAdmin, async (_req, res) => {
  try {
    const [orderRows, itemRows, historyRows, logRows] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(orderItems),
      db.select().from(orderStatusHistory).orderBy(asc(orderStatusHistory.createdAt)),
      db.select().from(whatsappLogs).orderBy(desc(whatsappLogs.createdAt)),
    ]);

    const itemsByOrder: Record<number, typeof itemRows> = {};
    for (const item of itemRows) {
      if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = [];
      itemsByOrder[item.orderId].push(item);
    }

    const historyByOrder: Record<number, typeof historyRows> = {};
    for (const h of historyRows) {
      if (!historyByOrder[h.orderId]) historyByOrder[h.orderId] = [];
      historyByOrder[h.orderId].push(h);
    }

    const logsByOrder: Record<number, typeof logRows> = {};
    for (const l of logRows) {
      if (!logsByOrder[l.orderId]) logsByOrder[l.orderId] = [];
      logsByOrder[l.orderId].push(l);
    }

    const enriched = orderRows.map((o) => ({
      ...o,
      items: itemsByOrder[o.id] || [],
      history: historyByOrder[o.id] || [],
      whatsappLogs: logsByOrder[o.id] || [],
    }));

    res.json({ orders: enriched });
  } catch (error) {
    console.error('Failed to fetch admin orders:', error);
    res.status(500).json({ error: 'Failed to load orders.' });
  }
});

apiRouter.patch('/admin/orders/:id/status', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status, note, sendWhatsapp } = req.body ?? {};
    const allowed = [
      'pending',
      'confirmed',
      'processing',
      'out_for_delivery',
      'delivered',
      'cancelled',
    ];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status.' });
    }

    const [existing] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const [updated] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();

    await db.insert(orderStatusHistory).values({
      orderId,
      previousStatus: existing.status,
      newStatus: status,
      note: typeof note === 'string' && note.trim() ? note.trim() : `Status changed to ${status}`,
      changedByEmail: req.dbUser?.email || 'admin',
    });

    let whatsappLog = null;
    if (sendWhatsapp) {
      whatsappLog = await sendOrderUpdateWhatsapp(orderId);
    }

    res.json({ order: updated, whatsappLog });
  } catch (error) {
    console.error('Failed to update order status:', error);
    res.status(500).json({ error: 'Unable to update order status.' });
  }
});

apiRouter.patch('/admin/orders/:id/delivery', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { distanceKm, deliveryFeePkr, note } = req.body ?? {};

    const feeNum = Number(deliveryFeePkr);
    const distNum =
      distanceKm === null || distanceKm === undefined || distanceKm === ''
        ? null
        : Number(distanceKm);

    if (Number.isNaN(feeNum) || feeNum < 0) {
      return res.status(400).json({ error: 'Delivery fee must be a valid non-negative PKR amount.' });
    }

    const [existing] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const roundedFee = Math.round(feeNum);
    const grandTotalPkr = existing.subtotalPkr + roundedFee;

    const [updated] = await db
      .update(orders)
      .set({
        distanceKm: distNum,
        deliveryFeePkr: roundedFee,
        grandTotalPkr,
        distanceVerificationStatus: 'manual_override',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    await db.insert(orderStatusHistory).values({
      orderId,
      previousStatus: existing.status,
      newStatus: existing.status,
      note:
        typeof note === 'string' && note.trim()
          ? note.trim()
          : `Delivery fee adjusted manually to Rs. ${roundedFee} (${distNum ?? '-'} km). Grand total: Rs. ${grandTotalPkr}.`,
      changedByEmail: req.dbUser?.email || 'admin',
    });

    res.json({ order: updated });
  } catch (error) {
    console.error('Failed to adjust delivery fee:', error);
    res.status(500).json({ error: 'Unable to adjust delivery fee.' });
  }
});

apiRouter.post('/admin/orders/:id/whatsapp', requireAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { message } = req.body ?? {};
    const log = await sendOrderUpdateWhatsapp(orderId, message);
    res.json({ whatsappLog: log });
  } catch (error: any) {
    console.error('Manual WhatsApp update failed:', error);
    res.status(500).json({ error: error?.message || 'Unable to send WhatsApp update.' });
  }
});

apiRouter.post('/admin/whatsapp-logs/:logId/retry', requireAdmin, async (req, res) => {
  try {
    const logId = Number(req.params.logId);
    const log = await retryWhatsappDelivery(logId);
    res.json({ whatsappLog: log });
  } catch (error: any) {
    console.error('WhatsApp retry failed:', error);
    res.status(500).json({ error: error?.message || 'Unable to retry WhatsApp delivery.' });
  }
});

// Admin Categories
apiRouter.get('/admin/categories', requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.id));
    res.json({ categories: rows });
  } catch (error) {
    console.error('Failed to fetch admin categories:', error);
    res.status(500).json({ error: 'Unable to load categories.' });
  }
});

apiRouter.post('/admin/categories', requireAdmin, async (req, res) => {
  try {
    const {
      slug,
      groupKey,
      nameEn,
      nameUr,
      descriptionEn,
      descriptionUr,
      imageUrl,
      sortOrder,
      isActive,
    } = req.body ?? {};
    if (!nameEn || !nameUr || !groupKey) {
      return res.status(400).json({ error: 'Category English name, Urdu name, and group are required.' });
    }
    const cleanSlug =
      (slug || nameEn)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') +
      '-' +
      Date.now().toString().slice(-4);

    const [created] = await db
      .insert(categories)
      .values({
        slug: slug?.trim() || cleanSlug,
        groupKey,
        nameEn: nameEn.trim(),
        nameUr: nameUr.trim(),
        descriptionEn: (descriptionEn || '').trim(),
        descriptionUr: (descriptionUr || '').trim(),
        imageUrl: imageUrl || '/src/assets/images/cat_grocery_staples_1795030138094.jpg',
        sortOrder: Number(sortOrder) || 99,
        isActive: isActive !== false,
      })
      .returning();

    res.status(201).json({ category: created });
  } catch (error) {
    console.error('Failed to create category:', error);
    res.status(500).json({ error: 'Unable to create category.' });
  }
});

apiRouter.put('/admin/categories/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      groupKey,
      nameEn,
      nameUr,
      descriptionEn,
      descriptionUr,
      imageUrl,
      sortOrder,
      isActive,
    } = req.body ?? {};

    const [updated] = await db
      .update(categories)
      .set({
        ...(groupKey ? { groupKey } : {}),
        ...(nameEn ? { nameEn: nameEn.trim() } : {}),
        ...(nameUr ? { nameUr: nameUr.trim() } : {}),
        ...(descriptionEn !== undefined ? { descriptionEn: String(descriptionEn).trim() } : {}),
        ...(descriptionUr !== undefined ? { descriptionUr: String(descriptionUr).trim() } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      })
      .where(eq(categories.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Category not found.' });
    res.json({ category: updated });
  } catch (error) {
    console.error('Failed to update category:', error);
    res.status(500).json({ error: 'Unable to update category.' });
  }
});

apiRouter.delete('/admin/categories/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(categories).where(eq(categories.id, id));
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete category:', error);
    res.status(500).json({ error: 'Unable to delete category.' });
  }
});

// Admin Products & Upload
apiRouter.get('/admin/products', requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(products).orderBy(desc(products.id));
    res.json({ products: rows });
  } catch (error) {
    console.error('Failed to load admin products:', error);
    res.status(500).json({ error: 'Unable to load products.' });
  }
});

apiRouter.post('/admin/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }
  res.json({ url: `/uploads/products/${req.file.filename}` });
});

apiRouter.post('/admin/products', requireAdmin, async (req, res) => {
  try {
    const {
      categoryId,
      sku,
      nameEn,
      nameUr,
      descriptionEn,
      descriptionUr,
      imageUrl,
      unit,
      pricePkr,
      discountPricePkr,
      stock,
      isAvailable,
      isPopular,
      isBestSeller,
      isSpecialOffer,
      variantsJson,
    } = req.body ?? {};

    if (!categoryId || !nameEn || !nameUr || !pricePkr) {
      return res
        .status(400)
        .json({ error: 'Category, English name, Urdu name, and PKR price are required.' });
    }

    const generatedSku =
      (sku && String(sku).trim()) ||
      `FM-${Date.now().toString(36).toUpperCase()}`;

    const [created] = await db
      .insert(products)
      .values({
        categoryId: Number(categoryId),
        sku: generatedSku,
        nameEn: String(nameEn).trim(),
        nameUr: String(nameUr).trim(),
        descriptionEn: String(descriptionEn || '').trim(),
        descriptionUr: String(descriptionUr || '').trim(),
        imageUrl:
          imageUrl || '/src/assets/images/cat_grocery_staples_1795030138094.jpg',
        unit: unit || 'kg',
        pricePkr: Math.max(1, Math.round(Number(pricePkr))),
        discountPricePkr:
          discountPricePkr !== null && discountPricePkr !== undefined && discountPricePkr !== ''
            ? Math.max(1, Math.round(Number(discountPricePkr)))
            : null,
        stock: Math.max(0, Math.round(Number(stock) || 0)),
        isAvailable: isAvailable !== false,
        isPopular: Boolean(isPopular),
        isBestSeller: Boolean(isBestSeller),
        isSpecialOffer: Boolean(isSpecialOffer),
        variantsJson: Array.isArray(variantsJson) ? variantsJson : [],
      })
      .returning();

    res.status(201).json({ product: created });
  } catch (error) {
    console.error('Failed to create product:', error);
    res.status(500).json({ error: 'Unable to create product.' });
  }
});

apiRouter.put('/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body ?? {};
    const updatePayload: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.categoryId !== undefined) updatePayload.categoryId = Number(body.categoryId);
    if (body.sku !== undefined) updatePayload.sku = String(body.sku).trim();
    if (body.nameEn !== undefined) updatePayload.nameEn = String(body.nameEn).trim();
    if (body.nameUr !== undefined) updatePayload.nameUr = String(body.nameUr).trim();
    if (body.descriptionEn !== undefined)
      updatePayload.descriptionEn = String(body.descriptionEn).trim();
    if (body.descriptionUr !== undefined)
      updatePayload.descriptionUr = String(body.descriptionUr).trim();
    if (body.imageUrl !== undefined) updatePayload.imageUrl = String(body.imageUrl);
    if (body.unit !== undefined) updatePayload.unit = String(body.unit);
    if (body.pricePkr !== undefined)
      updatePayload.pricePkr = Math.max(1, Math.round(Number(body.pricePkr)));
    if (body.discountPricePkr !== undefined) {
      updatePayload.discountPricePkr =
        body.discountPricePkr === null || body.discountPricePkr === ''
          ? null
          : Math.max(1, Math.round(Number(body.discountPricePkr)));
    }
    if (body.stock !== undefined)
      updatePayload.stock = Math.max(0, Math.round(Number(body.stock)));
    if (body.isAvailable !== undefined) updatePayload.isAvailable = Boolean(body.isAvailable);
    if (body.isPopular !== undefined) updatePayload.isPopular = Boolean(body.isPopular);
    if (body.isBestSeller !== undefined) updatePayload.isBestSeller = Boolean(body.isBestSeller);
    if (body.isSpecialOffer !== undefined)
      updatePayload.isSpecialOffer = Boolean(body.isSpecialOffer);
    if (Array.isArray(body.variantsJson)) updatePayload.variantsJson = body.variantsJson;

    const [updated] = await db
      .update(products)
      .set(updatePayload)
      .where(eq(products.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: updated });
  } catch (error) {
    console.error('Failed to update product:', error);
    res.status(500).json({ error: 'Unable to update product.' });
  }
});

apiRouter.delete('/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(products).where(eq(products.id, id));
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete product:', error);
    res.status(500).json({ error: 'Unable to delete product.' });
  }
});

// Admin Delivery Areas
apiRouter.get('/admin/areas', requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(deliveryAreas).orderBy(asc(deliveryAreas.id));
    res.json({ areas: rows });
  } catch (error) {
    console.error('Failed to fetch delivery areas:', error);
    res.status(500).json({ error: 'Unable to load delivery areas.' });
  }
});

apiRouter.post('/admin/areas', requireAdmin, async (req, res) => {
  try {
    const { nameEn, nameUr, isActive, notes } = req.body ?? {};
    if (!nameEn || !nameUr) {
      return res.status(400).json({ error: 'Area English and Urdu names are required.' });
    }
    const [created] = await db
      .insert(deliveryAreas)
      .values({
        nameEn: String(nameEn).trim(),
        nameUr: String(nameUr).trim(),
        isActive: isActive !== false,
        notes: typeof notes === 'string' ? notes.trim() : null,
      })
      .returning();
    res.status(201).json({ area: created });
  } catch (error) {
    console.error('Failed to create area:', error);
    res.status(500).json({ error: 'Unable to add delivery area (it may already exist).' });
  }
});

apiRouter.put('/admin/areas/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nameEn, nameUr, isActive, notes } = req.body ?? {};
    const [updated] = await db
      .update(deliveryAreas)
      .set({
        ...(nameEn !== undefined ? { nameEn: String(nameEn).trim() } : {}),
        ...(nameUr !== undefined ? { nameUr: String(nameUr).trim() } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(notes !== undefined ? { notes: notes ? String(notes).trim() : null } : {}),
      })
      .where(eq(deliveryAreas.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Delivery area not found.' });
    res.json({ area: updated });
  } catch (error) {
    console.error('Failed to update area:', error);
    res.status(500).json({ error: 'Unable to update delivery area.' });
  }
});

apiRouter.delete('/admin/areas/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(deliveryAreas).where(eq(deliveryAreas.id, id));
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete area:', error);
    res.status(500).json({ error: 'Unable to delete delivery area.' });
  }
});

// Admin Store Settings
apiRouter.get('/admin/settings', requireAdmin, async (_req, res) => {
  try {
    const [settings] = await db.select().from(storeSettings).limit(1);
    if (!settings) {
      return res.status(404).json({ error: 'Store settings not found.' });
    }
    res.json({
      settings: {
        ...settings,
        whatsappAccessToken: settings.whatsappAccessToken ? '••••••••••••' : '',
        hasWhatsappAccessToken: Boolean(
          settings.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN
        ),
        envMapsKeyActive: Boolean(
          process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
        ),
      },
    });
  } catch (error) {
    console.error('Failed to load settings:', error);
    res.status(500).json({ error: 'Unable to load store settings.' });
  }
});

apiRouter.put('/admin/settings', requireAdmin, async (req, res) => {
  try {
    const [existing] = await db.select().from(storeSettings).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Settings record missing.' });
    }
    const b = req.body ?? {};
    const updatePayload: Partial<typeof storeSettings.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (b.storeName !== undefined) updatePayload.storeName = String(b.storeName).trim();
    if (b.storeNameUr !== undefined) updatePayload.storeNameUr = String(b.storeNameUr).trim();
    if (b.storeAddress !== undefined) updatePayload.storeAddress = String(b.storeAddress).trim();
    if (b.storeAddressUr !== undefined)
      updatePayload.storeAddressUr = String(b.storeAddressUr).trim();
    if (b.storeLat !== undefined) updatePayload.storeLat = Number(b.storeLat);
    if (b.storeLng !== undefined) updatePayload.storeLng = Number(b.storeLng);
    if (b.whatsappNumber !== undefined)
      updatePayload.whatsappNumber = String(b.whatsappNumber).trim();
    if (b.deliveryRatePerKm !== undefined)
      updatePayload.deliveryRatePerKm = Math.max(0, Math.round(Number(b.deliveryRatePerKm)));
    if (b.deliveryEnabled !== undefined)
      updatePayload.deliveryEnabled = Boolean(b.deliveryEnabled);
    if (b.defaultLanguage !== undefined)
      updatePayload.defaultLanguage = b.defaultLanguage === 'ur' ? 'ur' : 'en';
    if (b.openingHoursEn !== undefined)
      updatePayload.openingHoursEn = String(b.openingHoursEn).trim();
    if (b.openingHoursUr !== undefined)
      updatePayload.openingHoursUr = String(b.openingHoursUr).trim();
    if (b.googleMapsApiKey !== undefined)
      updatePayload.googleMapsApiKey = b.googleMapsApiKey ? String(b.googleMapsApiKey).trim() : null;
    if (b.whatsappPhoneNumberId !== undefined)
      updatePayload.whatsappPhoneNumberId = b.whatsappPhoneNumberId
        ? String(b.whatsappPhoneNumberId).trim()
        : null;
    if (b.whatsappBusinessAccountId !== undefined)
      updatePayload.whatsappBusinessAccountId = b.whatsappBusinessAccountId
        ? String(b.whatsappBusinessAccountId).trim()
        : null;
    if (
      b.whatsappAccessToken !== undefined &&
      b.whatsappAccessToken !== '' &&
      !String(b.whatsappAccessToken).includes('••')
    ) {
      updatePayload.whatsappAccessToken = String(b.whatsappAccessToken).trim();
    }
    if (b.whatsappCustomerTemplateName !== undefined)
      updatePayload.whatsappCustomerTemplateName = String(b.whatsappCustomerTemplateName).trim();
    if (b.whatsappOwnerTemplateName !== undefined)
      updatePayload.whatsappOwnerTemplateName = String(b.whatsappOwnerTemplateName).trim();
    if (b.whatsappTemplateLang !== undefined)
      updatePayload.whatsappTemplateLang = String(b.whatsappTemplateLang).trim() || 'en';

    const [updated] = await db
      .update(storeSettings)
      .set(updatePayload)
      .where(eq(storeSettings.id, existing.id))
      .returning();

    res.json({
      settings: {
        ...updated,
        whatsappAccessToken: updated.whatsappAccessToken ? '••••••••••••' : '',
        hasWhatsappAccessToken: Boolean(
          updated.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN
        ),
      },
    });
  } catch (error) {
    console.error('Failed to update store settings:', error);
    res.status(500).json({ error: 'Unable to save store settings.' });
  }
});
