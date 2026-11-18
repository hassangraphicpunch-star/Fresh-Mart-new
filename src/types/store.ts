export type Language = 'en' | 'ur';

export type CategoryGroupKey =
  | 'grocery_food'
  | 'fruits_vegetables'
  | 'household_cleaning'
  | 'personal_care_baby';

export interface StorePublicSettings {
  storeName: string;
  storeNameUr: string;
  storeAddress: string;
  storeAddressUr: string;
  storeLat: number;
  storeLng: number;
  whatsappNumber: string;
  deliveryRatePerKm: number;
  deliveryEnabled: boolean;
  defaultLanguage: string;
  openingHoursEn: string;
  openingHoursUr: string;
  googleMapsBrowserKey: string;
  whatsappConfigured: boolean;
}

export interface Category {
  id: number;
  slug: string;
  groupKey: CategoryGroupKey | string;
  nameEn: string;
  nameUr: string;
  descriptionEn: string;
  descriptionUr: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductVariant {
  id: string;
  labelEn: string;
  labelUr: string;
  unit: string;
  pricePkr: number;
  discountPricePkr?: number | null;
  stock: number;
}

export interface Product {
  id: number;
  categoryId: number;
  sku: string;
  nameEn: string;
  nameUr: string;
  descriptionEn: string;
  descriptionUr: string;
  imageUrl: string;
  unit: string;
  pricePkr: number;
  discountPricePkr: number | null;
  stock: number;
  isAvailable: boolean;
  isPopular: boolean;
  isBestSeller: boolean;
  isSpecialOffer: boolean;
  variantsJson: ProductVariant[];
}

export interface DeliveryArea {
  id: number;
  nameEn: string;
  nameUr: string;
  isActive: boolean;
  notes?: string | null;
}

export interface CartItem {
  key: string; // productId + variantId
  productId: number;
  variantId?: string;
  nameEn: string;
  nameUr: string;
  variantLabelEn?: string;
  variantLabelUr?: string;
  unit: string;
  unitPricePkr: number;
  imageUrl: string;
  quantity: number;
  maxStock: number;
}

export interface DistanceQuote {
  verified: boolean;
  status: 'verified' | 'pending_manual';
  distanceKm: number | null;
  distanceMeters: number | null;
  durationText: string | null;
  deliveryFeePkr: number | null;
  ratePerKm: number;
  formattedDestination: string | null;
  customerLat: number | null;
  customerLng: number | null;
  encodedPolyline: string | null;
  quotaExceeded?: boolean;
  reason?: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number | null;
  productNameEn: string;
  productNameUr: string;
  variantLabelEn: string | null;
  variantLabelUr: string | null;
  unit: string;
  unitPricePkr: number;
  quantity: number;
  lineTotalPkr: number;
}

export interface OrderStatusHistoryEntry {
  id: number;
  orderId: number;
  previousStatus: string | null;
  newStatus: string;
  note: string | null;
  changedByEmail: string | null;
  createdAt: string;
}

export interface WhatsappLog {
  id: number;
  orderId: number;
  recipientType: 'customer' | 'owner';
  recipientPhone: string;
  templateName: string | null;
  messageBody: string;
  deliveryStatus: 'sent' | 'failed' | 'not_configured' | 'retrying';
  providerMessageId: string | null;
  errorMessage: string | null;
  attemptCount: number;
  createdAt: string;
}

export interface OrderRecord {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryArea: string;
  deliveryAddress: string;
  deliveryInstructions: string | null;
  customerLat: number | null;
  customerLng: number | null;
  distanceKm: number | null;
  durationText: string | null;
  distanceVerificationStatus: 'verified' | 'pending_manual' | 'manual_override';
  deliveryRatePerKm: number;
  subtotalPkr: number;
  deliveryFeePkr: number;
  grandTotalPkr: number;
  paymentMethod: string;
  status: 'pending' | 'confirmed' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  language: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  history?: OrderStatusHistoryEntry[];
  whatsappLogs?: WhatsappLog[];
}
