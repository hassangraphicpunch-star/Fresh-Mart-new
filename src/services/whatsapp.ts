import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { orderItems, orders, storeSettings, whatsappLogs } from '../db/schema.ts';

export function normalizePakistanWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0092')) return digits.slice(2);
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  if (digits.startsWith('3') && digits.length === 10) return `92${digits}`;
  return digits;
}

export function buildCustomerOrderConfirmationText(params: {
  storeName: string;
  orderNumber: string;
  customerName: string;
  itemsText: string;
  subtotalPkr: number;
  distanceKm: number | null;
  distanceVerificationStatus: string;
  deliveryFeePkr: number;
  grandTotalPkr: number;
  deliveryAddress: string;
  deliveryArea: string;
  status: string;
  language: string;
}): string {
  const distanceLine =
    params.distanceVerificationStatus === 'verified' ||
    params.distanceVerificationStatus === 'manual_override'
      ? `${params.distanceKm ?? 'Manual'} KM — Rs. ${params.deliveryFeePkr.toLocaleString('en-PK')}`
      : 'Pending manual confirmation by store owner (Rs. 50/KM)';

  const totalLine =
    params.distanceVerificationStatus === 'verified' ||
    params.distanceVerificationStatus === 'manual_override'
      ? `Rs. ${params.grandTotalPkr.toLocaleString('en-PK')}`
      : `Rs. ${params.subtotalPkr.toLocaleString('en-PK')} + Delivery Charges (Pending Confirmation)`;

  if (params.language === 'ur') {
    const urDistanceLine =
      params.distanceVerificationStatus === 'verified' ||
      params.distanceVerificationStatus === 'manual_override'
        ? `${params.distanceKm ?? 'دستی'} کلومیٹر — روپے ${params.deliveryFeePkr.toLocaleString('en-PK')}`
        : 'دکاندار کی جانب سے دستی تصدیق باقی ہے (50 روپے فی کلومیٹر)';

    return `فریش مارٹ سے خریداری کا شکریہ!\n\nآپ کا آرڈر کامیابی سے موصول ہو گیا ہے۔\n\nآرڈر نمبر: ${params.orderNumber}\nکسٹمر: ${params.customerName}\n\nاشیاء:\n${params.itemsText}\n\nکل اشیاء کی رقم: روپے ${params.subtotalPkr.toLocaleString('en-PK')}\nڈیلیوری فاصلہ و چارجز: ${urDistanceLine}\nکل ادائیگی (کیش آن ڈیلیوری): ${totalLine}\n\nڈیلیوری پتہ: ${params.deliveryAddress}، ${params.deliveryArea}، کراچی\nآرڈر کی صورتحال: ${params.status}\n\nہم جلد آپ سے رابطہ کریں گے۔ فریش مارٹ منتخب کرنے کا شکریہ!`;
  }

  return `Thank you for shopping with ${params.storeName}!\n\nYour order has been received successfully.\n\nOrder Number: ${params.orderNumber}\nCustomer: ${params.customerName}\n\nProducts:\n${params.itemsText}\n\nSubtotal: Rs. ${params.subtotalPkr.toLocaleString('en-PK')}\nDelivery Distance & Charges: ${distanceLine}\nGrand Total (Cash on Delivery): ${totalLine}\n\nDelivery Address: ${params.deliveryAddress}, ${params.deliveryArea}, Karachi\nOrder Status: ${params.status}\n\nYour order is now pending confirmation. We will update you shortly.\n\nThank you for choosing ${params.storeName}!`;
}

export function buildOwnerNewOrderText(params: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryArea: string;
  deliveryAddress: string;
  deliveryInstructions: string | null;
  itemsText: string;
  subtotalPkr: number;
  distanceKm: number | null;
  distanceVerificationStatus: string;
  deliveryFeePkr: number;
  grandTotalPkr: number;
}): string {
  const distanceSummary =
    params.distanceVerificationStatus === 'verified'
      ? `${params.distanceKm} KM (Google Maps Verified)`
      : params.distanceVerificationStatus === 'manual_override'
        ? `${params.distanceKm ?? '-'} KM (Manual Override)`
        : 'Unverified — Requires Manual Distance Confirmation';

  return `NEW FRESH MART ORDER: ${params.orderNumber}\n\nCustomer: ${params.customerName}\nPhone: ${params.customerPhone}\nArea: ${params.deliveryArea}\nAddress: ${params.deliveryAddress}\nInstructions: ${params.deliveryInstructions || 'None'}\n\nItems:\n${params.itemsText}\n\nSubtotal: Rs. ${params.subtotalPkr.toLocaleString('en-PK')}\nDistance: ${distanceSummary}\nDelivery Fee: Rs. ${params.deliveryFeePkr.toLocaleString('en-PK')}\nTotal COD Payment: Rs. ${params.grandTotalPkr.toLocaleString('en-PK')}`;
}

async function callWhatsAppCloudApi(params: {
  phoneNumberId: string;
  accessToken: string;
  toPhoneE164: string;
  templateName?: string | null;
  templateLang?: string | null;
  bodyText: string;
  templateVariables: string[];
}): Promise<{
  ok: boolean;
  providerMessageId?: string;
  errorMessage?: string;
}> {
  const endpoint = `https://graph.facebook.com/v21.0/${params.phoneNumberId}/messages`;

  // Use approved template for business-initiated notifications when configured;
  // fall back to text message if template delivery returns template-not-found or is explicitly skipped.
  const useTemplate = Boolean(params.templateName && params.templateName.trim().length > 0);

  const payload = useTemplate
    ? {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.toPhoneE164,
        type: 'template',
        template: {
          name: params.templateName!.trim(),
          language: {
            code: params.templateLang || 'en',
          },
          components: [
            {
              type: 'body',
              parameters: params.templateVariables.map((text) => ({
                type: 'text',
                text: String(text).slice(0, 1024),
              })),
            },
          ],
        },
      }
    : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.toPhoneE164,
        type: 'text',
        text: {
          preview_url: false,
          body: params.bodyText,
        },
      };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiMsg =
        data?.error?.message || `WhatsApp Cloud API returned HTTP ${response.status}`;
      return {
        ok: false,
        errorMessage: apiMsg,
      };
    }

    const messageId = data?.messages?.[0]?.id;
    return {
      ok: true,
      providerMessageId: messageId,
    };
  } catch (error: any) {
    return {
      ok: false,
      errorMessage: error?.message || 'Network failure connecting to WhatsApp Cloud API',
    };
  }
}

async function getWhatsAppConfig() {
  const [settings] = await db.select().from(storeSettings).limit(1);
  const accessToken =
    settings?.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || '';
  const phoneNumberId =
    settings?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  const businessAccountId =
    settings?.whatsappBusinessAccountId ||
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ||
    '';

  return {
    settings,
    accessToken: accessToken.trim(),
    phoneNumberId: phoneNumberId.trim(),
    businessAccountId: businessAccountId.trim(),
    configured: Boolean(accessToken.trim() && phoneNumberId.trim()),
  };
}

export async function dispatchOrderWhatsappNotifications(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return [];

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const cfg = await getWhatsAppConfig();
  const storeName = cfg.settings?.storeName || 'Fresh Mart';
  const ownerPhoneRaw = cfg.settings?.whatsappNumber || '03233469424';
  const ownerPhone = normalizePakistanWhatsAppPhone(ownerPhoneRaw);
  const customerPhone = normalizePakistanWhatsAppPhone(order.customerPhone);

  const itemsText = items
    .map((item) => {
      const label = item.variantLabelEn ? ` (${item.variantLabelEn})` : '';
      return `${item.productNameEn}${label} × ${item.quantity} – Rs. ${item.lineTotalPkr.toLocaleString('en-PK')}`;
    })
    .join('\n');

  const customerMsg = buildCustomerOrderConfirmationText({
    storeName,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    itemsText,
    subtotalPkr: order.subtotalPkr,
    distanceKm: order.distanceKm,
    distanceVerificationStatus: order.distanceVerificationStatus,
    deliveryFeePkr: order.deliveryFeePkr,
    grandTotalPkr: order.grandTotalPkr,
    deliveryAddress: order.deliveryAddress,
    deliveryArea: order.deliveryArea,
    status: order.status,
    language: order.language,
  });

  const ownerMsg = buildOwnerNewOrderText({
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryArea: order.deliveryArea,
    deliveryAddress: order.deliveryAddress,
    deliveryInstructions: order.deliveryInstructions,
    itemsText,
    subtotalPkr: order.subtotalPkr,
    distanceKm: order.distanceKm,
    distanceVerificationStatus: order.distanceVerificationStatus,
    deliveryFeePkr: order.deliveryFeePkr,
    grandTotalPkr: order.grandTotalPkr,
  });

  const customerTemplate =
    cfg.settings?.whatsappCustomerTemplateName ||
    process.env.WHATSAPP_CUSTOMER_TEMPLATE_NAME ||
    'fresh_mart_order_confirmation';
  const ownerTemplate =
    cfg.settings?.whatsappOwnerTemplateName ||
    process.env.WHATSAPP_OWNER_TEMPLATE_NAME ||
    'fresh_mart_owner_new_order';
  const templateLang = cfg.settings?.whatsappTemplateLang || 'en';

  const logsCreated = [];

  for (const target of [
    {
      recipientType: 'customer' as const,
      phone: customerPhone,
      templateName: customerTemplate,
      body: customerMsg,
      variables: [
        order.customerName,
        order.orderNumber,
        `Rs. ${order.grandTotalPkr}`,
        `${order.deliveryAddress}, ${order.deliveryArea}`,
      ],
    },
    {
      recipientType: 'owner' as const,
      phone: ownerPhone,
      templateName: ownerTemplate,
      body: ownerMsg,
      variables: [
        order.orderNumber,
        order.customerName,
        order.customerPhone,
        `Rs. ${order.grandTotalPkr}`,
      ],
    },
  ]) {
    if (!cfg.configured) {
      const [log] = await db
        .insert(whatsappLogs)
        .values({
          orderId,
          recipientType: target.recipientType,
          recipientPhone: target.phone || ownerPhoneRaw,
          templateName: target.templateName,
          messageBody: target.body,
          deliveryStatus: 'not_configured',
          errorMessage:
            'WhatsApp Business Cloud API credentials (Phone Number ID & Access Token) are not configured in Admin Settings.',
          attemptCount: 1,
        })
        .returning();
      logsCreated.push(log);
      continue;
    }

    const result = await callWhatsAppCloudApi({
      phoneNumberId: cfg.phoneNumberId,
      accessToken: cfg.accessToken,
      toPhoneE164: target.phone,
      templateName: target.templateName,
      templateLang,
      bodyText: target.body,
      templateVariables: target.variables,
    });

    const [log] = await db
      .insert(whatsappLogs)
      .values({
        orderId,
        recipientType: target.recipientType,
        recipientPhone: target.phone,
        templateName: target.templateName,
        messageBody: target.body,
        deliveryStatus: result.ok ? 'sent' : 'failed',
        providerMessageId: result.providerMessageId ?? null,
        errorMessage: result.errorMessage ?? null,
        attemptCount: 1,
      })
      .returning();
    logsCreated.push(log);
  }

  return logsCreated;
}

export async function sendOrderUpdateWhatsapp(
  orderId: number,
  customMessage?: string
) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    throw new Error('Order not found');
  }

  const cfg = await getWhatsAppConfig();
  const customerPhone = normalizePakistanWhatsAppPhone(order.customerPhone);
  const statusLabel = order.status.replace(/_/g, ' ');
  const messageBody =
    customMessage?.trim() ||
    `Fresh Mart Update — Order ${order.orderNumber}\n\nHello ${order.customerName}, your order status is now: ${statusLabel.toUpperCase()}.\nGrand Total (COD): Rs. ${order.grandTotalPkr.toLocaleString('en-PK')}\nDelivery Address: ${order.deliveryAddress}, ${order.deliveryArea}, Karachi.\n\nQuestions? Message us on 03233469424.`;

  if (!cfg.configured) {
    const [log] = await db
      .insert(whatsappLogs)
      .values({
        orderId,
        recipientType: 'customer',
        recipientPhone: customerPhone,
        templateName: null,
        messageBody,
        deliveryStatus: 'not_configured',
        errorMessage:
          'WhatsApp Business Cloud API credentials are not configured in Admin Settings.',
        attemptCount: 1,
      })
      .returning();
    return log;
  }

  const result = await callWhatsAppCloudApi({
    phoneNumberId: cfg.phoneNumberId,
    accessToken: cfg.accessToken,
    toPhoneE164: customerPhone,
    templateName: null,
    bodyText: messageBody,
    templateVariables: [],
  });

  const [log] = await db
    .insert(whatsappLogs)
    .values({
      orderId,
      recipientType: 'customer',
      recipientPhone: customerPhone,
      templateName: null,
      messageBody,
      deliveryStatus: result.ok ? 'sent' : 'failed',
      providerMessageId: result.providerMessageId ?? null,
      errorMessage: result.errorMessage ?? null,
      attemptCount: 1,
    })
    .returning();

  return log;
}

export async function retryWhatsappDelivery(logId: number) {
  const [existing] = await db
    .select()
    .from(whatsappLogs)
    .where(eq(whatsappLogs.id, logId))
    .limit(1);

  if (!existing) {
    throw new Error('WhatsApp log entry not found');
  }

  const cfg = await getWhatsAppConfig();
  if (!cfg.configured) {
    const [updated] = await db
      .update(whatsappLogs)
      .set({
        attemptCount: existing.attemptCount + 1,
        deliveryStatus: 'not_configured',
        errorMessage:
          'WhatsApp Business Cloud API credentials are not configured in Admin Settings.',
        updatedAt: new Date(),
      })
      .where(eq(whatsappLogs.id, logId))
      .returning();
    return updated;
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, existing.orderId))
    .limit(1);

  const result = await callWhatsAppCloudApi({
    phoneNumberId: cfg.phoneNumberId,
    accessToken: cfg.accessToken,
    toPhoneE164: existing.recipientPhone,
    templateName: existing.templateName,
    templateLang: cfg.settings?.whatsappTemplateLang || 'en',
    bodyText: existing.messageBody,
    templateVariables: order
      ? [
          order.customerName,
          order.orderNumber,
          `Rs. ${order.grandTotalPkr}`,
          `${order.deliveryAddress}, ${order.deliveryArea}`,
        ]
      : [],
  });

  const [updated] = await db
    .update(whatsappLogs)
    .set({
      attemptCount: existing.attemptCount + 1,
      deliveryStatus: result.ok ? 'sent' : 'failed',
      providerMessageId: result.providerMessageId ?? existing.providerMessageId,
      errorMessage: result.errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(whatsappLogs.id, logId))
    .returning();

  return updated;
}
