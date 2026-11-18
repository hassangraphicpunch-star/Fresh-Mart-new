import React, { useEffect, useState } from 'react';
import { Clock, Loader2, MapPin, PackageCheck, Search } from 'lucide-react';
import { COPY, STATUS_LABELS } from '../i18n/translations.ts';
import { Language, OrderRecord } from '../types/store.ts';

interface OrderTrackingViewProps {
  initialOrderNumber?: string;
  lang: Language;
}

export function OrderTrackingView({
  initialOrderNumber = '',
  lang,
}: OrderTrackingViewProps) {
  const t = COPY[lang];
  const [query, setQuery] = useState(initialOrderNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderRecord | null>(null);

  const fetchOrder = async (orderNum: string) => {
    const clean = orderNum.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/track/${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Order not found.');
        setResult(null);
        return;
      }
      setResult({
        ...data.order,
        items: data.items,
        history: data.history,
        whatsappLogs: data.whatsappLogs,
      });
    } catch {
      setError('Unable to check order status right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderNumber) {
      setQuery(initialOrderNumber);
      void fetchOrder(initialOrderNumber);
    }
  }, [initialOrderNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchOrder(query);
  };

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
          {t.trackOrderTitle}
        </h1>
        <p className="text-sm text-slate-600">{t.trackOrderSub}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="FM-1001"
            className="w-full h-11 ps-10 pe-4 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="h-11 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.trackBtn}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="text-xs text-slate-500">{t.orderNumberLabel}</div>
              <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                {result.orderNumber}
              </div>
            </div>
            <div className="text-end">
              <div className="text-xs text-slate-500">Status</div>
              <div className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4" />
                <span>{STATUS_LABELS[result.status]?.[lang] ?? result.status}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>{t.deliveryAddress}</span>
              </div>
              <p className="font-medium text-slate-900">{result.customerName}</p>
              <p className="text-slate-600">
                {result.deliveryAddress}, {result.deliveryArea}, Karachi
              </p>
            </div>
            <div className="space-y-1 sm:text-end tabular-nums">
              <div className="text-xs text-slate-500">{t.grandTotal} (COD)</div>
              <p className="text-lg font-bold font-mono text-slate-900">
                Rs. {result.grandTotalPkr.toLocaleString('en-PK')}
              </p>
              <p className="text-xs text-slate-500">
                {result.distanceVerificationStatus === 'verified'
                  ? `${result.distanceKm} km · Delivery Rs. ${result.deliveryFeePkr}`
                  : result.distanceVerificationStatus === 'manual_override'
                    ? `Confirmed Delivery Rs. ${result.deliveryFeePkr}`
                    : t.pendingConfirmationFee}
              </p>
            </div>
          </div>

          {result.items && result.items.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-xs font-semibold text-slate-500 mb-2">Items</h3>
              <ul className="divide-y divide-slate-100 text-sm">
                {result.items.map((item) => (
                  <li key={item.id} className="py-2 flex justify-between gap-4">
                    <span className="text-slate-800">
                      {lang === 'ur' ? item.productNameUr : item.productNameEn}
                      {item.variantLabelEn ? ` (${lang === 'ur' ? item.variantLabelUr : item.variantLabelEn})` : ''}
                      {' × '}
                      <span className="font-mono">{item.quantity}</span>
                    </span>
                    <span className="font-mono font-medium text-slate-900 tabular-nums shrink-0">
                      Rs. {item.lineTotalPkr.toLocaleString('en-PK')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.history && result.history.length > 0 && (
            <div className="border-t border-slate-100 pt-4 space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-500">Order Timeline</h3>
              <ul className="space-y-2">
                {result.history.map((h) => (
                  <li key={h.id} className="flex items-start gap-2.5 text-xs">
                    <Clock className="w-3.5 h-3.5 text-emerald-700 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-900">
                        {STATUS_LABELS[h.newStatus]?.[lang] ?? h.newStatus}
                      </span>
                      {h.note && <span className="text-slate-600"> — {h.note}</span>}
                      <div className="text-[11px] text-slate-400 font-mono">
                        {new Date(h.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
