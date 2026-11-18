import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface ProductVariant {
  id: string;
  labelEn: string;
  labelUr: string;
  unit: string;
  pricePkr: number;
  discountPricePkr?: number | null;
  stock: number;
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('customer'), // 'admin' | 'customer'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  groupKey: text('group_key').notNull(), // 'grocery_food' | 'fruits_vegetables' | 'household_cleaning' | 'personal_care_baby'
  nameEn: text('name_en').notNull(),
  nameUr: text('name_ur').notNull(),
  descriptionEn: text('description_en').notNull(),
  descriptionUr: text('description_ur').notNull(),
  imageUrl: text('image_url').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id')
    .references(() => categories.id, { onDelete: 'cascade' })
    .notNull(),
  sku: text('sku').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameUr: text('name_ur').notNull(),
  descriptionEn: text('description_en').notNull(),
  descriptionUr: text('description_ur').notNull(),
  imageUrl: text('image_url').notNull(),
  unit: text('unit').notNull().default('kg'), // kg, gram, litre, ml, packet, piece, dozen
  pricePkr: integer('price_pkr').notNull(),
  discountPricePkr: integer('discount_price_pkr'),
  stock: integer('stock').notNull().default(0),
  isAvailable: boolean('is_available').notNull().default(true),
  isPopular: boolean('is_popular').notNull().default(false),
  isBestSeller: boolean('is_best_seller').notNull().default(false),
  isSpecialOffer: boolean('is_special_offer').notNull().default(false),
  variantsJson: jsonb('variants_json').$type<ProductVariant[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const deliveryAreas = pgTable('delivery_areas', {
  id: serial('id').primaryKey(),
  nameEn: text('name_en').notNull().unique(),
  nameUr: text('name_ur').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const storeSettings = pgTable('store_settings', {
  id: serial('id').primaryKey(),
  storeName: text('store_name').notNull().default('Fresh Mart'),
  storeNameUr: text('store_name_ur').notNull().default('فریش مارٹ'),
  storeAddress: text('store_address')
    .notNull()
    .default('House No. L-94, Sector L-1, Surjani Town, Karachi, Pakistan'),
  storeAddressUr: text('store_address_ur')
    .notNull()
    .default('مکان نمبر L-94، سیکٹر L-1، سرجانی ٹاؤن، کراچی، پاکستان'),
  storeLat: doublePrecision('store_lat').notNull().default(25.0085),
  storeLng: doublePrecision('store_lng').notNull().default(67.0645),
  whatsappNumber: text('whatsapp_number').notNull().default('03233469424'),
  deliveryRatePerKm: integer('delivery_rate_per_km').notNull().default(50),
  deliveryEnabled: boolean('delivery_enabled').notNull().default(true),
  defaultLanguage: text('default_language').notNull().default('en'),
  openingHoursEn: text('opening_hours_en').notNull().default('Daily: 8:00 AM – 11:30 PM'),
  openingHoursUr: text('opening_hours_ur').notNull().default('روزانہ: صبح 8:00 تا رات 11:30'),
  googleMapsApiKey: text('google_maps_api_key'),
  whatsappPhoneNumberId: text('whatsapp_phone_number_id'),
  whatsappBusinessAccountId: text('whatsapp_business_account_id'),
  whatsappAccessToken: text('whatsapp_access_token'),
  whatsappCustomerTemplateName: text('whatsapp_customer_template_name')
    .notNull()
    .default('fresh_mart_order_confirmation'),
  whatsappOwnerTemplateName: text('whatsapp_owner_template_name')
    .notNull()
    .default('fresh_mart_owner_new_order'),
  whatsappTemplateLang: text('whatsapp_template_lang').notNull().default('en'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  idempotencyKey: text('idempotency_key').unique(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  deliveryArea: text('delivery_area').notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  deliveryInstructions: text('delivery_instructions'),
  customerLat: doublePrecision('customer_lat'),
  customerLng: doublePrecision('customer_lng'),
  distanceKm: doublePrecision('distance_km'),
  durationText: text('duration_text'),
  distanceVerificationStatus: text('distance_verification_status')
    .notNull()
    .default('pending_manual'), // 'verified' | 'pending_manual' | 'manual_override'
  deliveryRatePerKm: integer('delivery_rate_per_km').notNull().default(50),
  subtotalPkr: integer('subtotal_pkr').notNull(),
  deliveryFeePkr: integer('delivery_fee_pkr').notNull().default(0),
  grandTotalPkr: integer('grand_total_pkr').notNull(),
  paymentMethod: text('payment_method').notNull().default('COD'),
  status: text('status').notNull().default('pending'), // 'pending' | 'confirmed' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled'
  language: text('language').notNull().default('en'),
  adminNotes: text('admin_notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  productNameEn: text('product_name_en').notNull(),
  productNameUr: text('product_name_ur').notNull(),
  variantLabelEn: text('variant_label_en'),
  variantLabelUr: text('variant_label_ur'),
  unit: text('unit').notNull(),
  unitPricePkr: integer('unit_price_pkr').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotalPkr: integer('line_total_pkr').notNull(),
});

export const orderStatusHistory = pgTable('order_status_history', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  previousStatus: text('previous_status'),
  newStatus: text('new_status').notNull(),
  note: text('note'),
  changedByEmail: text('changed_by_email'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const whatsappLogs = pgTable('whatsapp_logs', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  recipientType: text('recipient_type').notNull(), // 'customer' | 'owner'
  recipientPhone: text('recipient_phone').notNull(),
  templateName: text('template_name'),
  messageBody: text('message_body').notNull(),
  deliveryStatus: text('delivery_status').notNull().default('not_configured'), // 'sent' | 'failed' | 'not_configured' | 'retrying'
  providerMessageId: text('provider_message_id'),
  errorMessage: text('error_message'),
  attemptCount: integer('attempt_count').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
  whatsappLogs: many(whatsappLogs),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, {
    fields: [orderStatusHistory.orderId],
    references: [orders.id],
  }),
}));

export const whatsappLogsRelations = relations(whatsappLogs, ({ one }) => ({
  order: one(orders, {
    fields: [whatsappLogs.orderId],
    references: [orders.id],
  }),
}));
