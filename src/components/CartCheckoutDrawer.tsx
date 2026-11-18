import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { COPY, UNIT_LABELS } from '../i18n/translations.ts';
import {
  CartItem,
  DeliveryArea,
  DistanceQuote,
  Language,
  OrderRecord,
  StorePublicSettings,
  WhatsappLog,
} from '../types/store.ts';
import { DeliveryMapPicker } from './DeliveryMapPicker.tsx';
import { ProductImage } from './ProductImage.tsx';

interface CartCheckoutDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQty: (key: string, delta: number) => void;
  onRemoveItem: (key: string) => void;
  onClearCart: () => void;
  deliveryAreas: DeliveryArea[];
  settings: StorePublicSettings;
  lang: Language;
  onOrderSuccess: (orderNumber: string) => void;
}

export function CartCheckoutDrawer({
  open,
  onClose,
  items,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  deliveryAreas,
  settings,
  lang,
  onOrderSuccess,
}: CartCheckoutDrawerProps) {
  const t = COPY[lang];
  const [step, setStep] = useState<'cart' | 'checkout' | 'confirmation'>('cart');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryArea, setDeliveryArea] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [placeMeta, setPlaceMeta] = useState<{
    placeId?: string;
    lat?: number;
    lng?: number;
  }>({});

  const [distanceQuote, setDistanceQuote] = useState<DistanceQuote | null>(null);
  const [calculatingDist, setCalculatingDist] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedResult, setConfirmedResult] = useState<{
    order: OrderRecord;
    whatsappLogs: WhatsappLog[];
    distanceNote?: string | null;
  } | null>(null);

  const idempotencyKeyRef = useRef<string>('');
  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current = `fm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  useEffect(() => {
    if (!deliveryArea && deliveryAreas.length > 0) {
      setDeliveryArea(deliveryAreas[0].nameEn);
    }
  }, [deliveryAreas, deliveryArea]);

  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPricePkr * item.quantity,
    0
  );

  const calculateDistance = useCallback(
    async (overrideMeta?: { placeId?: string; lat?: number; lng?: number }, addrOverride?: string) => {
      const addr = (addrOverride ?? deliveryAddress).trim();
      if (addr.length < 5 || !deliveryArea) {
        return;
      }
      setCalculatingDist(true);
      setErrorMsg(null);
      try {
        const res = await fetch('/api/delivery/calculate-distance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: addr,
            area: deliveryArea,
            placeId: overrideMeta?.placeId ?? placeMeta.placeId,
            lat: overrideMeta?.lat ?? placeMeta.lat,
            lng: overrideMeta?.lng ?? placeMeta.lng,
          }),
        });
        const data: DistanceQuote & { error?: string } = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || 'Could not calculate delivery distance.');
          return;
        }
        if (data.quotaExceeded) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setDistanceQuote(data);
      } catch {
        setDistanceQuote({
          verified: false,
          status: 'pending_manual',
          distanceKm: null,
          distanceMeters: null,
          durationText: null,
          deliveryFeePkr: null,
          ratePerKm: settings.deliveryRatePerKm,
          formattedDestination: null,
          customerLat: null,
          customerLng: null,
          encodedPolyline: null,
          reason:
            'Network issue while verifying distance. Fresh Mart will confirm delivery fee manually.',
        });
      } finally {
        setCalculatingDist(false);
      }
    },
    [deliveryAddress, deliveryArea, placeMeta, settings.deliveryRatePerKm]
  );

  // Auto-recalculate when address or area changes (debounced)
  useEffect(() => {
    if (step !== 'checkout' || deliveryAddress.trim().length < 6 || !deliveryArea) {
      return;
    }
    const timer = setTimeout(() => {
      void calculateDistance();
    }, 850);
    return () => clearTimeout(timer);
  }, [step, deliveryAddress, deliveryArea, calculateDistance]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (customerName.trim().length < 2) {
      setErrorMsg(
        lang === 'ur' ? 'براہ کرم اپنا پورا نام درج کریں۔' : 'Please enter your full name.'
      );
      return;
    }
    const cleanPhone = customerPhone.replace(/\s|-/g, '');
    if (!/^(\+92|0092|0)?3[0-9]{9}$/.test(cleanPhone)) {
      setErrorMsg(
        lang === 'ur'
          ? 'براہ کرم درست پاکستانی موبائل نمبر درج کریں (مثلاً 0323-3469424)۔'
          : 'Please enter a valid Pakistani mobile number (e.g. 0323-3469424).'
      );
      return;
    }
    if (!deliveryArea) {
      setErrorMsg(
        lang === 'ur' ? 'براہ کرم کراچی کا علاقہ منتخب کریں۔' : 'Please select a Karachi delivery area.'
      );
      return;
    }
    if (deliveryAddress.trim().length < 6) {
      setErrorMsg(
        lang === 'ur' ? 'براہ کرم مکمل پتہ درج کریں۔' : 'Please enter your complete street address.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          customerName: customerName.trim(),
          customerPhone: cleanPhone,
          deliveryArea,
          deliveryAddress: deliveryAddress.trim(),
          deliveryInstructions: deliveryInstructions.trim() || null,
          customerPlaceId: placeMeta.placeId,
          customerLat: placeMeta.lat ?? distanceQuote?.customerLat ?? undefined,
          customerLng: placeMeta.lng ?? distanceQuote?.customerLng ?? undefined,
          language: lang,
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not place your order.');
        return;
      }

      setConfirmedResult({
        order: data.order,
        whatsappLogs: data.whatsappLogs || [],
        distanceNote: data.distanceNote,
      });
      onClearCart();
      idempotencyKeyRef.current = `fm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      setStep('confirmation');
    } catch {
      setErrorMsg('Network error submitting your order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const verifiedDeliveryFee =
    distanceQuote?.verified && distanceQuote.deliveryFeePkr !== null
      ? distanceQuote.deliveryFeePkr
      : null;
  const grandTotal = subtotal + (verifiedDeliveryFee ?? 0);

  const customerWhatsappLog = confirmedResult?.whatsappLogs.find(
    (l) => l.recipientType === 'customer'
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl border-s border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            {step === 'checkout' && (
              <button
                type="button"
                onClick={() => setStep('cart')}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
                aria-label={t.backToCart}
              >
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              </button>
            )}
            <h2 className="text-lg font-bold text-slate-900 font-display">
              {step === 'cart'
                ? `${t.cartTitle} (${items.reduce((s, i) => s + i.quantity, 0)})`
                : step === 'checkout'
                  ? t.checkoutTitle
                  : t.orderReceivedTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 'cart' && (
            <>
              {items.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <p className="text-base font-semibold text-slate-900">{t.cartEmpty}</p>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto">{t.cartEmptyHint}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const name = lang === 'ur' ? item.nameUr : item.nameEn;
                    const variant = lang === 'ur' ? item.variantLabelUr : item.variantLabelEn;
                    const unit = UNIT_LABELS[item.unit]?.[lang] ?? item.unit;

                    return (
                      <div key={item.key} className="py-4 flex gap-3.5 items-start">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-stone-50 border border-slate-200 shrink-0">
                          <ProductImage
                            src={item.imageUrl}
                            alt={name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 truncate">
                            {name}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {variant ? `${variant} · ` : ''}
                            Rs. {item.unitPricePkr.toLocaleString('en-PK')} / {unit}
                          </p>
                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <div className="flex items-center border border-slate-200 rounded-lg h-8 bg-slate-50">
                              <button
                                type="button"
                                onClick={() => onUpdateQty(item.key, -1)}
                                className="w-7 h-full flex items-center justify-center text-slate-600 cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-7 text-center text-xs font-semibold tabular-nums font-mono">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQty(item.key, 1)}
                                disabled={item.quantity >= item.maxStock}
                                className="w-7 h-full flex items-center justify-center text-slate-600 disabled:opacity-40 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                              Rs. {(item.unitPricePkr * item.quantity).toLocaleString('en-PK')}
                            </span>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.key)}
                              aria-label="Remove item"
                              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {step === 'checkout' && (
            <form id="checkout-form" onSubmit={handleSubmitOrder} className="space-y-4">
              <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center justify-between">
                <span>{t.noAccountNeeded}</span>
                <span className="font-mono font-semibold tabular-nums">
                  Rs. {settings.deliveryRatePerKm}/km
                </span>
              </div>

              {errorMsg && (
                <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-3 py-2.5 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.customerName} *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={lang === 'ur' ? 'مثلاً محمد علی' : 'e.g. Muhammad Ali'}
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.customerPhone} *
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="03XX-XXXXXXX"
                  className="w-full h-10 px-3 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.deliveryArea} *
                </label>
                <select
                  required
                  value={deliveryArea}
                  onChange={(e) => {
                    setDeliveryArea(e.target.value);
                    setPlaceMeta({});
                    setDistanceQuote(null);
                  }}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  <option value="">{t.selectArea}</option>
                  {deliveryAreas.map((area) => (
                    <option key={area.id} value={area.nameEn}>
                      {lang === 'ur' ? `${area.nameUr} (${area.nameEn})` : area.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.deliveryAddress} *
                </label>
                <DeliveryMapPicker
                  apiKey={settings.googleMapsBrowserKey}
                  storeLat={settings.storeLat}
                  storeLng={settings.storeLng}
                  storeName={settings.storeName}
                  customerLat={placeMeta.lat ?? distanceQuote?.customerLat ?? null}
                  customerLng={placeMeta.lng ?? distanceQuote?.customerLng ?? null}
                  lang={lang}
                  addressValue={deliveryAddress}
                  onAddressChange={(val) => {
                    setDeliveryAddress(val);
                    setPlaceMeta({});
                  }}
                  onPlaceResolved={(info) => {
                    setPlaceMeta({
                      placeId: info.placeId,
                      lat: info.lat,
                      lng: info.lng,
                    });
                    void calculateDistance(
                      { placeId: info.placeId, lat: info.lat, lng: info.lng },
                      info.formattedAddress
                    );
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => void calculateDistance()}
                disabled={calculatingDist || deliveryAddress.trim().length < 5}
                className="w-full h-10 px-3 rounded-lg border border-emerald-700 text-emerald-800 hover:bg-emerald-50 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {calculatingDist ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                <span>
                  {calculatingDist ? t.calculatingDistance : t.calculateDistanceBtn}
                </span>
              </button>

              {distanceQuote && (
                <div
                  className={`rounded-lg border p-3 text-xs space-y-1 ${
                    distanceQuote.verified
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50 border-amber-200 text-amber-950'
                  }`}
                >
                  {distanceQuote.verified ? (
                    <>
                      <div className="flex items-center justify-between font-semibold">
                        <span>{t.verifiedDistanceTitle}</span>
                        <span className="font-mono tabular-nums">
                          {distanceQuote.distanceKm} KM
                          {distanceQuote.durationText ? ` · ${distanceQuote.durationText}` : ''}
                        </span>
                      </div>
                      <p className="text-emerald-800 font-mono tabular-nums">
                        {distanceQuote.distanceKm} KM × Rs. {distanceQuote.ratePerKm} = Rs.{' '}
                        {distanceQuote.deliveryFeePkr?.toLocaleString('en-PK')}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.manualDistanceTitle}</span>
                      </div>
                      <p className="text-amber-900 leading-relaxed">
                        {distanceQuote.reason || t.manualDistanceExplain}
                      </p>
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.deliveryInstructions}
                </label>
                <textarea
                  rows={2}
                  value={deliveryInstructions}
                  onChange={(e) => setDeliveryInstructions(e.target.value)}
                  placeholder={
                    lang === 'ur'
                      ? 'قریبی مشہور جگہ یا ڈور بیل کی ہدایات...'
                      : 'Nearest landmark, gate code, or call on arrival...'
                  }
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="rounded-lg border border-slate-200 p-3 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <Truck className="w-4 h-4 text-emerald-700" />
                  <span>{t.paymentMethodLabel}</span>
                </div>
                <span className="text-xs font-semibold text-slate-900">{t.codOnly}</span>
              </div>
            </form>
          )}

          {step === 'confirmation' && confirmedResult && (
            <div className="space-y-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <h3 className="text-base font-bold">{t.orderReceivedTitle}</h3>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs text-slate-600">{t.orderNumberLabel}</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    {confirmedResult.order.orderNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {confirmedResult.order.customerName} · {confirmedResult.order.customerPhone}
                </p>
                <p className="text-xs text-slate-600">
                  {confirmedResult.order.deliveryAddress}, {confirmedResult.order.deliveryArea}
                </p>
              </div>

              {/* Honest WhatsApp Delivery Status */}
              <div
                className={`rounded-xl border p-4 text-xs space-y-1.5 ${
                  customerWhatsappLog?.deliveryStatus === 'sent'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>{t.whatsappStatusTitle}</span>
                  <span className="font-mono uppercase">
                    {customerWhatsappLog?.deliveryStatus === 'sent'
                      ? 'SENT'
                      : customerWhatsappLog?.deliveryStatus === 'failed'
                        ? 'FAILED'
                        : 'PENDING CONFIG'}
                  </span>
                </div>
                <p>
                  {customerWhatsappLog?.deliveryStatus === 'sent'
                    ? t.whatsappSentNote
                    : customerWhatsappLog?.deliveryStatus === 'failed'
                      ? `${t.whatsappFailedNote} (${customerWhatsappLog.errorMessage || 'API Error'})`
                      : t.whatsappNotConfiguredNote}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>{t.subtotal}</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    Rs. {confirmedResult.order.subtotalPkr.toLocaleString('en-PK')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    {t.deliveryCharges}
                    {confirmedResult.order.distanceKm
                      ? ` (${confirmedResult.order.distanceKm} km)`
                      : ''}
                  </span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {confirmedResult.order.distanceVerificationStatus === 'verified'
                      ? `Rs. ${confirmedResult.order.deliveryFeePkr.toLocaleString('en-PK')}`
                      : t.pendingConfirmationFee}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                  <span>{t.grandTotal}</span>
                  <span className="font-mono tabular-nums">
                    Rs. {confirmedResult.order.grandTotalPkr.toLocaleString('en-PK')}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onOrderSuccess(confirmedResult.order.orderNumber);
                    setStep('cart');
                    onClose();
                  }}
                  className="flex-1 h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                >
                  {t.navTrack}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('cart');
                    onClose();
                  }}
                  className="flex-1 h-11 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  {t.navShop}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Totals & Action */}
        {step !== 'confirmation' && items.length > 0 && (
          <div className="p-5 border-t border-slate-200 bg-slate-50/70 space-y-3 shrink-0">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>{t.subtotal}</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  Rs. {subtotal.toLocaleString('en-PK')}
                </span>
              </div>
              {step === 'checkout' && (
                <div className="flex justify-between text-slate-600">
                  <span>
                    {t.deliveryCharges}
                    {distanceQuote?.verified && distanceQuote.distanceKm
                      ? ` (${distanceQuote.distanceKm} km)`
                      : ''}
                  </span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {verifiedDeliveryFee !== null
                      ? `Rs. ${verifiedDeliveryFee.toLocaleString('en-PK')}`
                      : t.pendingConfirmationFee}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
                <span>{t.grandTotal}</span>
                <span className="font-mono tabular-nums">
                  Rs. {grandTotal.toLocaleString('en-PK')}
                </span>
              </div>
            </div>

            {step === 'cart' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                {t.proceedCheckout}
              </button>
            ) : (
              <button
                type="submit"
                form="checkout-form"
                disabled={submitting || !settings.deliveryEnabled}
                className="w-full h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{submitting ? t.placingOrder : t.placeOrderBtn}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
