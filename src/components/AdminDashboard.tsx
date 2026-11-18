import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Edit3,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Settings,
  ShoppingBag,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { GROUP_LABELS, STATUS_LABELS } from '../i18n/translations.ts';
import {
  Category,
  DeliveryArea,
  OrderRecord,
  Product,
  ProductVariant,
} from '../types/store.ts';
import { ProductImage } from './ProductImage.tsx';

interface AdminDashboardProps {
  onStorefrontRefresh: () => void;
  onExitAdmin: () => void;
}

type AdminTab = 'overview' | 'orders' | 'catalog' | 'delivery' | 'settings';

interface DashboardStats {
  totalOrders: number;
  todaysOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  processingOrders: number;
  outForDeliveryOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalSalesPkr: number;
  totalProducts: number;
  lowStockCount: number;
}

export function AdminDashboard({
  onStorefrontRefresh,
  onExitAdmin,
}: AdminDashboardProps) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dbRole, setDbRole] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [tab, setTab] = useState<AdminTab>('overview');
  const [loadingData, setLoadingData] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<OrderRecord | null>(null);

  const [manualDistInput, setManualDistInput] = useState('');
  const [manualFeeInput, setManualFeeInput] = useState('');
  const [manualNoteInput, setManualNoteInput] = useState('');
  const [customWaMsg, setCustomWaMsg] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogView, setCatalogView] = useState<'products' | 'categories'>('products');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);

  const [areas, setAreas] = useState<DeliveryArea[]>([]);
  const [newAreaEn, setNewAreaEn] = useState('');
  const [newAreaUr, setNewAreaUr] = useState('');

  const [settingsForm, setSettingsForm] = useState<Record<string, any>>({});

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const authedFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');
      const token = await user.getIdToken();
      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      return data;
    },
    []
  );

  const loadAllAdminData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [dashData, ordersData, catsData, prodsData, areasData, settingsData] =
        await Promise.all([
          authedFetch('/api/admin/dashboard'),
          authedFetch('/api/admin/orders'),
          authedFetch('/api/admin/categories'),
          authedFetch('/api/admin/products'),
          authedFetch('/api/admin/areas'),
          authedFetch('/api/admin/settings'),
        ]);

      setStats(dashData.stats);
      setLowStockProducts(dashData.lowStockProducts || []);
      setOrders(ordersData.orders || []);
      setCategories(catsData.categories || []);
      setProducts(prodsData.products || []);
      setAreas(areasData.areas || []);
      setSettingsForm(settingsData.settings || {});

      if (selectedOrder) {
        const refreshed = (ordersData.orders || []).find(
          (o: OrderRecord) => o.id === selectedOrder.id
        );
        if (refreshed) setSelectedOrder(refreshed);
      }
    } catch (err: any) {
      showToast('err', err.message || 'Failed to load admin data');
    } finally {
      setLoadingData(false);
    }
  }, [authedFetch, selectedOrder]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthError(null);
      if (!user) {
        setDbRole(null);
        setAuthChecked(true);
        return;
      }
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          setAuthError(data.error || 'Authentication failed.');
          setDbRole(null);
        } else {
          setDbRole(data.user?.role || 'customer');
        }
      } catch {
        setAuthError('Unable to verify admin permissions.');
        setDbRole(null);
      } finally {
        setAuthChecked(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (authChecked && firebaseUser && dbRole === 'admin') {
      void loadAllAdminData();
    }
  }, [authChecked, firebaseUser, dbRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      setAuthError(err?.message || 'Google Sign-In failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setDbRole(null);
  };

  const handleOrderStatusChange = async (
    orderId: number,
    status: string,
    sendWhatsapp: boolean
  ) => {
    try {
      await authedFetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, sendWhatsapp }),
      });
      showToast('ok', `Order updated to ${status.replace(/_/g, ' ')}`);
      await loadAllAdminData();
    } catch (err: any) {
      showToast('err', err.message);
    }
  };

  const handleSaveManualDelivery = async (orderId: number) => {
    try {
      await authedFetch(`/api/admin/orders/${orderId}/delivery`, {
        method: 'PATCH',
        body: JSON.stringify({
          distanceKm: manualDistInput === '' ? null : Number(manualDistInput),
          deliveryFeePkr: Number(manualFeeInput),
          note: manualNoteInput,
        }),
      });
      showToast('ok', 'Delivery fee & order total updated.');
      await loadAllAdminData();
    } catch (err: any) {
      showToast('err', err.message);
    }
  };

  const handleSendOrderWhatsapp = async (orderId: number) => {
    try {
      const res = await authedFetch(`/api/admin/orders/${orderId}/whatsapp`, {
        method: 'POST',
        body: JSON.stringify({ message: customWaMsg }),
      });
      const st = res.whatsappLog?.deliveryStatus;
      if (st === 'sent') {
        showToast('ok', 'WhatsApp update sent successfully.');
        setCustomWaMsg('');
      } else {
        showToast(
          'err',
          `WhatsApp status: ${st}. ${res.whatsappLog?.errorMessage || ''}`
        );
      }
      await loadAllAdminData();
    } catch (err: any) {
      showToast('err', err.message);
    }
  };

  const handleRetryWhatsapp = async (logId: number) => {
    try {
      const res = await authedFetch(`/api/admin/whatsapp-logs/${logId}/retry`, {
        method: 'POST',
      });
      const st = res.whatsappLog?.deliveryStatus;
      if (st === 'sent') {
        showToast('ok', 'WhatsApp message delivered on retry.');
      } else {
        showToast(
          'err',
          `Retry result: ${st}. ${res.whatsappLog?.errorMessage || ''}`
        );
      }
      await loadAllAdminData();
    } catch (err: any) {
      showToast('err', err.message);
    }
  };

  const handleUploadImage = async (file: File) => {
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await authedFetch('/api/admin/upload', {
        method: 'POST',
        body: fd,
      });
      setEditingProduct((prev) => (prev ? { ...prev, imageUrl: res.url } : prev));
      showToast('ok', 'Product image uploaded.');
    } catch (err: any) {
      showToast('err', err.message);
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      if (editingProduct.id) {
        await authedFetch(`/api/admin/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingProduct),
        });
        showToast('ok', 'Product updated.');
      } else {
        await authedFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(editingProduct),
        });
        showToast('ok', 'Product added.');
      }
      setEditingProduct(null);
      await loadAllAdminData();
      onStorefrontRefresh();
    } catch (err: any) {
      showToast('err', err.message);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    try {
      await authedFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      showToast('ok', 'Product removed.');
      await loadAllAdminData();
      onStorefrontRefresh();
    } catch (err: any) {
      showToast('err', err.message);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      if (editingCategory.id) {
        await authedFetch(`/api/admin/categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingCategory),
        });
        showToast('ok', 'Category updated.');
      } else {
        await authedFetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(editingCategory),
        });
        showToast('ok', 'Category created.');
      }
      setEditingCategory(null);
      await loadAllAdminData();
      onStorefrontRefresh();
    } catch (err: any) {
      showToast('err', err.message);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await authedFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      showToast('ok', 'Category deleted.');
      await loadAllAdminData();
      onStorefrontRefresh();
    } catch (err: any) {
      showToast('err', err.message);
    }
  };

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authedFetch('/api/admin/areas', {
        method: 'POST',
        body: JSON.stringify({ nameEn: newAreaEn, nameUr: newAreaUr, isActive: true }),
      });
      setNewAreaEn('');
      setNewAreaUr('');
      showToast('ok', 'Karachi delivery area added.');
      await loadAllAdminData();
      onStorefrontRefresh();
    } catch (err: any) {
      showToast('err', err.message);
    }
  };

  const handleToggleArea = async (area: DeliveryArea) => {
    try {
      await authedFetch(`/api/admin/areas/${area.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !area.isActive }),
      });
      await loadAllAdminData();
      onStorefrontRefresh();
    } catch (err: any) {
      showToast('err', err.message);
    }
  };

  const handleDeleteArea = async (id: number) => {
    try {
      await authedFetch(`/api/admin/areas/${id}`, { method: 'DELETE' });
      showToast('ok', 'Area removed.');
      await loadAllAdminData();
      onStorefrontRefresh();
    } catch (err: any) {
      showToast('err', err.message);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authedFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsForm),
      });
      showToast('ok', 'Store settings saved.');
      await loadAllAdminData();
      onStorefrontRefresh();
    } catch (err: any) {
      showToast('err', err.message);
    }
  };

  // Auth loading / sign-in screens
  if (!authChecked) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 text-center space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-700 mx-auto" />
        <p className="text-sm text-slate-600">Checking administrator session...</p>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="max-w-md mx-auto my-16 px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-slate-900 font-display">
              Fresh Mart Admin Console
            </h1>
            <p className="text-sm text-slate-600">
              Sign in with your store owner Google account to manage orders, products, delivery areas, and WhatsApp integration.
            </p>
          </div>
          {authError && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-3 py-2 text-xs text-start">
              {authError}
            </div>
          )}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full h-11 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {signingIn && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Sign in with Google</span>
          </button>
          <button
            type="button"
            onClick={onExitAdmin}
            className="text-xs text-slate-500 hover:text-slate-900 underline cursor-pointer"
          >
            Return to Fresh Mart Storefront
          </button>
        </div>
      </div>
    );
  }

  if (dbRole !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-16 px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-4 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Administrator Access Required</h2>
          <p className="text-sm text-slate-600">
            Signed in as <span className="font-mono text-slate-900">{firebaseUser.email}</span>, which does not have store admin privileges.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex-1 h-10 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Sign Out
            </button>
            <button
              type="button"
              onClick={onExitAdmin}
              className="flex-1 h-10 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
            >
              Back to Store
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredOrders =
    orderStatusFilter === 'all'
      ? orders
      : orders.filter((o) => o.status === orderStatusFilter);

  const openOrderDetail = (o: OrderRecord) => {
    setSelectedOrder(o);
    setManualDistInput(o.distanceKm !== null ? String(o.distanceKm) : '');
    setManualFeeInput(String(o.deliveryFeePkr));
    setManualNoteInput('');
    setCustomWaMsg('');
  };

  return (
    <div dir="ltr" className="min-h-[calc(100vh-64px)] bg-slate-50/70">
      {/* Printable Invoice Overlay */}
      {invoiceOrder && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto p-8 print:p-0">
          <div className="max-w-2xl mx-auto border border-slate-300 rounded-xl p-8 space-y-6 print:border-0">
            <div className="flex justify-between items-start no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setInvoiceOrder(null)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex justify-between border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Fresh Mart</h1>
                <p className="text-xs text-slate-600">
                  House No. L-94, Sector L-1, Surjani Town, Karachi, Pakistan
                </p>
                <p className="text-xs text-slate-600 font-mono">WhatsApp: 0323-3469424</p>
              </div>
              <div className="text-end">
                <div className="text-xs text-slate-500 uppercase">COD Invoice</div>
                <div className="text-lg font-bold font-mono">{invoiceOrder.orderNumber}</div>
                <div className="text-xs text-slate-500 font-mono">
                  {new Date(invoiceOrder.createdAt).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-semibold text-slate-500 uppercase mb-1">Bill / Deliver To</div>
                <p className="font-bold text-slate-900">{invoiceOrder.customerName}</p>
                <p className="font-mono text-slate-700">{invoiceOrder.customerPhone}</p>
                <p className="text-slate-700">
                  {invoiceOrder.deliveryAddress}, {invoiceOrder.deliveryArea}, Karachi
                </p>
              </div>
              <div className="text-end">
                <div className="font-semibold text-slate-500 uppercase mb-1">Delivery Details</div>
                <p className="text-slate-700">Payment: Cash on Delivery</p>
                <p className="text-slate-700">
                  Distance: {invoiceOrder.distanceKm ?? 'Manual'} km
                </p>
                <p className="text-slate-700">Status: {invoiceOrder.status.toUpperCase()}</p>
              </div>
            </div>

            <table className="w-full text-xs border-t border-b border-slate-200">
              <thead>
                <tr className="text-left border-b border-slate-200 text-slate-500">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(invoiceOrder.items || []).map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 text-slate-900">
                      {item.productNameEn}
                      {item.variantLabelEn ? ` (${item.variantLabelEn})` : ''}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{item.quantity}</td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      Rs. {item.unitPricePkr.toLocaleString('en-PK')}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums font-semibold">
                      Rs. {item.lineTotalPkr.toLocaleString('en-PK')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="w-64 ms-auto space-y-1.5 text-xs tabular-nums">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono">Rs. {invoiceOrder.subtotalPkr.toLocaleString('en-PK')}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Charges</span>
                <span className="font-mono">
                  Rs. {invoiceOrder.deliveryFeePkr.toLocaleString('en-PK')}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-300 pt-1.5">
                <span>Grand Total (COD)</span>
                <span className="font-mono">
                  Rs. {invoiceOrder.grandTotalPkr.toLocaleString('en-PK')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 end-5 z-50 px-4 py-3 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 border no-print ${
            toast.type === 'ok'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-red-900 text-white border-red-700'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 no-print flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside className="w-full lg:w-60 shrink-0 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div>
              <div className="text-xs text-slate-500">Signed in as</div>
              <div className="text-xs font-semibold text-slate-900 truncate">
                {firebaseUser.email}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void loadAllAdminData()}
                className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit</span>
              </button>
            </div>
          </div>

          <nav className="bg-white border border-slate-200 rounded-xl p-2 flex lg:flex-col gap-1 overflow-x-auto">
            {[
              { id: 'overview', label: 'Dashboard', icon: BarChart3 },
              { id: 'orders', label: 'Orders', icon: ShoppingBag },
              { id: 'catalog', label: 'Products & Categories', icon: Package },
              { id: 'delivery', label: 'Delivery Areas', icon: Truck },
              { id: 'settings', label: 'Settings & APIs', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id as AdminTab)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* OVERVIEW */}
          {tab === 'overview' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {[
                  { label: 'Total Sales (PKR)', value: `Rs. ${stats.totalSalesPkr.toLocaleString('en-PK')}`, mono: true },
                  { label: 'Total Orders', value: stats.totalOrders, mono: true },
                  { label: "Today's Orders", value: stats.todaysOrders, mono: true },
                  { label: 'Pending Orders', value: stats.pendingOrders, mono: true },
                  { label: 'Confirmed Orders', value: stats.confirmedOrders, mono: true },
                  { label: 'Packing / Processing', value: stats.processingOrders, mono: true },
                  { label: 'Out for Delivery', value: stats.outForDeliveryOrders, mono: true },
                  { label: 'Delivered Orders', value: stats.deliveredOrders, mono: true },
                  { label: 'Cancelled Orders', value: stats.cancelledOrders, mono: true },
                  { label: 'Total Products', value: `${stats.totalProducts} (${stats.lowStockCount} low)`, mono: true },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-white border border-slate-200 rounded-xl p-4 space-y-1"
                  >
                    <div className="text-xs text-slate-500">{kpi.label}</div>
                    <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                      {kpi.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">Recent Orders</h2>
                    <button
                      type="button"
                      onClick={() => setTab('orders')}
                      className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Manage all
                    </button>
                  </div>
                  {orders.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      No orders placed yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {orders.slice(0, 6).map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            setTab('orders');
                            openOrderDetail(o);
                          }}
                          className="w-full py-2.5 flex items-center justify-between text-start hover:bg-slate-50 px-2 rounded cursor-pointer"
                        >
                          <div>
                            <div className="text-xs font-bold font-mono text-slate-900">
                              {o.orderNumber} · {o.customerName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {o.deliveryArea} · {STATUS_LABELS[o.status]?.en ?? o.status}
                            </div>
                          </div>
                          <span className="text-xs font-bold font-mono tabular-nums text-slate-900">
                            Rs. {o.grandTotalPkr.toLocaleString('en-PK')}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">Low Stock Alerts (≤ 15)</h2>
                    <button
                      type="button"
                      onClick={() => setTab('catalog')}
                      className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Restock
                    </button>
                  </div>
                  {lowStockProducts.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      All products are well stocked.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {lowStockProducts.slice(0, 6).map((p) => (
                        <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-900 truncate">{p.nameEn}</span>
                          <span className="font-mono font-bold text-amber-700 tabular-nums shrink-0">
                            {p.stock} left
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ORDERS */}
          {tab === 'orders' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900">Order Management</h2>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'all',
                    'pending',
                    'confirmed',
                    'processing',
                    'out_for_delivery',
                    'delivered',
                    'cancelled',
                  ].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOrderStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                        orderStatusFilter === st
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {st === 'all' ? 'All' : STATUS_LABELS[st]?.en ?? st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {filteredOrders.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                      No orders in this status.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Order</th>
                            <th className="px-4 py-3">Customer</th>
                            <th className="px-4 py-3">Area</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredOrders.map((o) => (
                            <tr
                              key={o.id}
                              onClick={() => openOrderDetail(o)}
                              className={`cursor-pointer hover:bg-emerald-50/40 ${
                                selectedOrder?.id === o.id ? 'bg-emerald-50/70' : ''
                              }`}
                            >
                              <td className="px-4 py-3 font-mono font-bold text-slate-900">
                                {o.orderNumber}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{o.customerName}</div>
                                <div className="font-mono text-[11px] text-slate-500">
                                  {o.customerPhone}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{o.deliveryArea}</td>
                              <td className="px-4 py-3 font-medium text-slate-800">
                                {STATUS_LABELS[o.status]?.en ?? o.status}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                                Rs. {o.grandTotalPkr.toLocaleString('en-PK')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Order Inspector */}
                <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                  {!selectedOrder ? (
                    <p className="text-xs text-slate-500 py-10 text-center">
                      Select an order row to inspect details, adjust delivery charges, print invoice, or send WhatsApp updates.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="text-xs text-slate-500">Order Inspector</div>
                          <h3 className="text-lg font-bold font-mono text-slate-900">
                            {selectedOrder.orderNumber}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInvoiceOrder(selectedOrder)}
                          className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Invoice</span>
                        </button>
                      </div>

                      <div className="text-xs space-y-1 text-slate-700">
                        <p>
                          <strong className="text-slate-900">Customer:</strong>{' '}
                          {selectedOrder.customerName} ({selectedOrder.customerPhone})
                        </p>
                        <p>
                          <strong className="text-slate-900">Area:</strong>{' '}
                          {selectedOrder.deliveryArea}
                        </p>
                        <p>
                          <strong className="text-slate-900">Address:</strong>{' '}
                          {selectedOrder.deliveryAddress}
                        </p>
                        {selectedOrder.deliveryInstructions && (
                          <p>
                            <strong className="text-slate-900">Instructions:</strong>{' '}
                            {selectedOrder.deliveryInstructions}
                          </p>
                        )}
                      </div>

                      <div className="border-t border-slate-100 pt-3">
                        <div className="text-xs font-semibold text-slate-500 mb-2">Items</div>
                        <ul className="space-y-1.5 text-xs">
                          {(selectedOrder.items || []).map((it) => (
                            <li key={it.id} className="flex justify-between">
                              <span>
                                {it.productNameEn}
                                {it.variantLabelEn ? ` (${it.variantLabelEn})` : ''} × {it.quantity}
                              </span>
                              <span className="font-mono font-semibold tabular-nums">
                                Rs. {it.lineTotalPkr.toLocaleString('en-PK')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Manual Delivery Fee / Distance Adjustment */}
                      <div className="border-t border-slate-100 pt-3 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Delivery Fee Verification</span>
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {selectedOrder.distanceVerificationStatus}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Distance (KM)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={manualDistInput}
                              onChange={(e) => {
                                setManualDistInput(e.target.value);
                                const km = Number(e.target.value);
                                if (!Number.isNaN(km) && km >= 0) {
                                  setManualFeeInput(
                                    String(Math.round(km * selectedOrder.deliveryRatePerKm))
                                  );
                                }
                              }}
                              className="w-full h-9 px-2.5 text-xs font-mono border border-slate-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Delivery Fee (PKR)
                            </label>
                            <input
                              type="number"
                              value={manualFeeInput}
                              onChange={(e) => setManualFeeInput(e.target.value)}
                              className="w-full h-9 px-2.5 text-xs font-mono border border-slate-300 rounded-lg"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          value={manualNoteInput}
                          onChange={(e) => setManualNoteInput(e.target.value)}
                          placeholder="Reason for adjustment (optional)"
                          className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveManualDelivery(selectedOrder.id)}
                          className="w-full h-9 rounded-lg border border-emerald-700 text-emerald-800 hover:bg-emerald-50 text-xs font-semibold cursor-pointer"
                        >
                          Save Delivery Charge & Recalculate Total
                        </button>
                      </div>

                      {/* Order Status Actions */}
                      <div className="border-t border-slate-100 pt-3 space-y-2">
                        <div className="text-xs font-semibold text-slate-800">
                          Update Order Status
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { st: 'confirmed', label: 'Confirm Order' },
                            { st: 'processing', label: 'Mark Processing' },
                            { st: 'out_for_delivery', label: 'Out for Delivery' },
                            { st: 'delivered', label: 'Mark Delivered' },
                            { st: 'cancelled', label: 'Cancel Order' },
                          ].map((btn) => (
                            <button
                              key={btn.st}
                              type="button"
                              onClick={() =>
                                void handleOrderStatusChange(selectedOrder.id, btn.st, true)
                              }
                              className={`h-9 px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                                btn.st === 'cancelled'
                                  ? 'border border-red-300 text-red-700 hover:bg-red-50'
                                  : selectedOrder.status === btn.st
                                    ? 'bg-emerald-800 text-white'
                                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                              }`}
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* WhatsApp Logs & Manual Update */}
                      <div className="border-t border-slate-100 pt-3 space-y-2.5">
                        <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                          <span>WhatsApp Delivery Logs</span>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {(selectedOrder.whatsappLogs || []).map((log) => (
                            <div
                              key={log.id}
                              className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] space-y-1"
                            >
                              <div className="flex items-center justify-between font-semibold">
                                <span>
                                  {log.recipientType.toUpperCase()} ({log.recipientPhone})
                                </span>
                                <span
                                  className={`font-mono uppercase ${
                                    log.deliveryStatus === 'sent'
                                      ? 'text-emerald-700'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {log.deliveryStatus}
                                </span>
                              </div>
                              {log.errorMessage && (
                                <p className="text-red-700">{log.errorMessage}</p>
                              )}
                              {log.deliveryStatus !== 'sent' && (
                                <button
                                  type="button"
                                  onClick={() => void handleRetryWhatsapp(log.id)}
                                  className="text-emerald-800 font-semibold underline cursor-pointer"
                                >
                                  Retry Delivery (Attempt #{log.attemptCount + 1})
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customWaMsg}
                            onChange={(e) => setCustomWaMsg(e.target.value)}
                            placeholder="Custom WhatsApp update (or leave blank for status message)"
                            className="flex-1 h-9 px-2.5 text-xs border border-slate-300 rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSendOrderWhatsapp(selectedOrder.id)}
                            className="h-9 px-3 rounded-lg bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                          >
                            Send WA
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CATALOG: PRODUCTS & CATEGORIES */}
          {tab === 'catalog' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCatalogView('products')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                      catalogView === 'products'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Products ({products.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogView('categories')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                      catalogView === 'categories'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Categories ({categories.length})
                  </button>
                </div>

                {catalogView === 'products' ? (
                  <button
                    type="button"
                    onClick={() =>
                      setEditingProduct({
                        categoryId: categories[0]?.id || 1,
                        nameEn: '',
                        nameUr: '',
                        descriptionEn: '',
                        descriptionUr: '',
                        imageUrl: '/src/assets/images/cat_grocery_staples_1795030138094.jpg',
                        unit: 'kg',
                        pricePkr: 200,
                        discountPricePkr: null,
                        stock: 50,
                        isAvailable: true,
                        isPopular: false,
                        isBestSeller: false,
                        isSpecialOffer: false,
                        variantsJson: [],
                      })
                    }
                    className="h-9 px-3.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Product</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setEditingCategory({
                        groupKey: 'grocery_food',
                        nameEn: '',
                        nameUr: '',
                        descriptionEn: '',
                        descriptionUr: '',
                        imageUrl: '/src/assets/images/cat_grocery_staples_1795030138094.jpg',
                        sortOrder: categories.length + 1,
                        isActive: true,
                      })
                    }
                    className="h-9 px-3.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Category</span>
                  </button>
                )}
              </div>

              {catalogView === 'products' ? (
                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Price (PKR)</th>
                        <th className="px-4 py-3">Stock</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-3 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-50 border border-slate-200 shrink-0">
                              <ProductImage
                                src={p.imageUrl}
                                alt={p.nameEn}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{p.nameEn}</div>
                              <div className="text-[11px] text-slate-500">
                                {p.nameUr} · {p.unit}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums">
                            Rs. {(p.discountPricePkr ?? p.pricePkr).toLocaleString('en-PK')}
                            {p.discountPricePkr && (
                              <span className="ms-1 text-slate-400 line-through">
                                {p.pricePkr}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums">{p.stock}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={async () => {
                                await authedFetch(`/api/admin/products/${p.id}`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ isAvailable: !p.isAvailable }),
                                });
                                await loadAllAdminData();
                                onStorefrontRefresh();
                              }}
                              className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                                p.isAvailable
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {p.isAvailable ? 'Enabled' : 'Disabled'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => setEditingProduct(p)}
                              className="p-1.5 text-slate-600 hover:text-emerald-800 cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4 inline" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteProduct(p.id)}
                              className="p-1.5 text-slate-500 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Category (EN / UR)</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Order</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categories.map((c) => (
                        <tr key={c.id}>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{c.nameEn}</div>
                            <div className="text-[11px] text-slate-500">{c.nameUr}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {GROUP_LABELS[c.groupKey]?.en ?? c.groupKey}
                          </td>
                          <td className="px-4 py-3 font-mono">{c.sortOrder}</td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => setEditingCategory(c)}
                              className="p-1.5 text-slate-600 hover:text-emerald-800 cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4 inline" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteCategory(c.id)}
                              className="p-1.5 text-slate-500 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* DELIVERY AREAS */}
          {tab === 'delivery' && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h2 className="text-base font-bold text-slate-900">
                  Karachi Delivery Areas & Rate
                </h2>
                <form onSubmit={handleAddArea} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={newAreaEn}
                    onChange={(e) => setNewAreaEn(e.target.value)}
                    placeholder="Area Name (English, e.g. Bahria Town Karachi)"
                    className="h-10 px-3 text-xs border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    value={newAreaUr}
                    onChange={(e) => setNewAreaUr(e.target.value)}
                    placeholder="Area Name (Urdu, e.g. بحریہ ٹاؤن کراچی)"
                    className="h-10 px-3 text-xs border border-slate-300 rounded-lg"
                  />
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-lg bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Karachi Area</span>
                  </button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
                  {areas.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{a.nameEn}</div>
                        <div className="text-[11px] text-slate-500 truncate">{a.nameUr}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleToggleArea(a)}
                          className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                            a.isActive
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {a.isActive ? 'Active' : 'Paused'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteArea(a.id)}
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS & CREDENTIALS */}
          {tab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900">Store & Delivery Settings</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Store Name (EN)</label>
                    <input
                      type="text"
                      value={settingsForm.storeName || ''}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, storeName: e.target.value })
                      }
                      className="w-full h-10 px-3 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Store Name (UR)</label>
                    <input
                      type="text"
                      value={settingsForm.storeNameUr || ''}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, storeNameUr: e.target.value })
                      }
                      className="w-full h-10 px-3 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-slate-700 mb-1">Store Address (EN)</label>
                    <input
                      type="text"
                      value={settingsForm.storeAddress || ''}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, storeAddress: e.target.value })
                      }
                      className="w-full h-10 px-3 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-slate-700 mb-1">Store Address (UR)</label>
                    <input
                      type="text"
                      value={settingsForm.storeAddressUr || ''}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, storeAddressUr: e.target.value })
                      }
                      className="w-full h-10 px-3 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Store WhatsApp Number
                    </label>
                    <input
                      type="text"
                      value={settingsForm.whatsappNumber || ''}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, whatsappNumber: e.target.value })
                      }
                      className="w-full h-10 px-3 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Delivery Rate per KM (PKR)
                    </label>
                    <input
                      type="number"
                      value={settingsForm.deliveryRatePerKm ?? 50}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          deliveryRatePerKm: Number(e.target.value),
                        })
                      }
                      className="w-full h-10 px-3 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Opening Hours (EN)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.openingHoursEn || ''}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, openingHoursEn: e.target.value })
                      }
                      className="w-full h-10 px-3 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Default Language
                    </label>
                    <select
                      value={settingsForm.defaultLanguage || 'en'}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, defaultLanguage: e.target.value })
                      }
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="en">English (LTR)</option>
                      <option value="ur">Urdu (RTL)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    Google Maps & WhatsApp Business Cloud API
                  </h2>
                  <span
                    className={`text-xs font-semibold ${
                      settingsForm.hasWhatsappAccessToken ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {settingsForm.hasWhatsappAccessToken
                      ? 'WhatsApp Cloud API Configured'
                      : 'WhatsApp Credentials Needed'}
                  </span>
                </div>

                {!settingsForm.hasWhatsappAccessToken && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-950 space-y-1">
                    <p className="font-semibold">
                      Required Meta WhatsApp Business Cloud API Credentials:
                    </p>
                    <p>
                      Enter your Meta Graph API Phone Number ID, WhatsApp Business Account ID, Permanent Access Token, and approved template names below so automatic order confirmations send to customers and 03233469424.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-slate-700 mb-1">
                      Google Maps API Key (Optional override if not set in server env)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.googleMapsApiKey || ''}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, googleMapsApiKey: e.target.value })
                      }
                      placeholder={
                        settingsForm.envMapsKeyActive
                          ? 'Managed by environment configuration (optional override)'
                          : 'AIza...'
                      }
                      className="w-full h-10 px-3 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      WhatsApp Phone Number ID
                    </label>
                    <input
                      type="text"
                      value={settingsForm.whatsappPhoneNumberId || ''}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          whatsappPhoneNumberId: e.target.value,
                        })
                      }
                      placeholder="e.g. 104938291049281"
                      className="w-full h-10 px-3 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      WhatsApp Business Account ID
                    </label>
                    <input
                      type="text"
                      value={settingsForm.whatsappBusinessAccountId || ''}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          whatsappBusinessAccountId: e.target.value,
                        })
                      }
                      placeholder="e.g. 109482716253410"
                      className="w-full h-10 px-3 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-slate-700 mb-1">
                      WhatsApp Cloud API Access Token (Stored server-side only)
                    </label>
                    <input
                      type="password"
                      value={settingsForm.whatsappAccessToken || ''}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          whatsappAccessToken: e.target.value,
                        })
                      }
                      placeholder="EAAG..."
                      className="w-full h-10 px-3 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Approved Customer Template Name
                    </label>
                    <input
                      type="text"
                      value={settingsForm.whatsappCustomerTemplateName || ''}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          whatsappCustomerTemplateName: e.target.value,
                        })
                      }
                      className="w-full h-10 px-3 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Approved Owner Template Name
                    </label>
                    <input
                      type="text"
                      value={settingsForm.whatsappOwnerTemplateName || ''}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          whatsappOwnerTemplateName: e.target.value,
                        })
                      }
                      className="w-full h-10 px-3 font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="h-10 px-6 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Store & API Settings
                  </button>
                </div>
              </div>
            </form>
          )}
        </main>
      </div>

      {/* Product Edit/Create Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingProduct.id ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={editingProduct.categoryId || ''}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      categoryId: Number(e.target.value),
                    })
                  }
                  className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Unit</label>
                <select
                  value={editingProduct.unit || 'kg'}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, unit: e.target.value })
                  }
                  className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg"
                >
                  {['kg', 'gram', 'litre', 'ml', 'packet', 'piece', 'dozen'].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Name (English)</label>
                <input
                  type="text"
                  required
                  value={editingProduct.nameEn || ''}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, nameEn: e.target.value })
                  }
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Name (Urdu)</label>
                <input
                  type="text"
                  required
                  value={editingProduct.nameUr || ''}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, nameUr: e.target.value })
                  }
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Price (PKR)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={editingProduct.pricePkr ?? ''}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      pricePkr: Number(e.target.value),
                    })
                  }
                  className="w-full h-9 px-2.5 font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Discount Price (PKR, optional)
                </label>
                <input
                  type="number"
                  value={editingProduct.discountPricePkr ?? ''}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      discountPricePkr: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full h-9 px-2.5 font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Stock</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={editingProduct.stock ?? 0}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      stock: Number(e.target.value),
                    })
                  }
                  className="w-full h-9 px-2.5 font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Image Upload or Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingProduct.imageUrl || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, imageUrl: e.target.value })
                    }
                    className="flex-1 h-9 px-2.5 border border-slate-300 rounded-lg"
                  />
                  <label className="h-9 px-3 rounded-lg border border-slate-300 flex items-center gap-1 cursor-pointer hover:bg-slate-50">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImg ? '...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUploadImage(f);
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">
                  Description (English)
                </label>
                <textarea
                  rows={2}
                  value={editingProduct.descriptionEn || ''}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, descriptionEn: e.target.value })
                  }
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">
                  Description (Urdu)
                </label>
                <textarea
                  rows={2}
                  value={editingProduct.descriptionUr || ''}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, descriptionUr: e.target.value })
                  }
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs pt-1">
              {[
                { key: 'isPopular', label: 'Popular' },
                { key: 'isBestSeller', label: 'Best Seller' },
                { key: 'isSpecialOffer', label: 'Special Offer' },
              ].map((flag) => (
                <label key={flag.key} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean((editingProduct as any)[flag.key])}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        [flag.key]: e.target.checked,
                      })
                    }
                  />
                  <span>{flag.label}</span>
                </label>
              ))}
            </div>

            {/* Variants editor */}
            <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">
                  Pack Size Variants (e.g. 1 kg, 2 kg, 5 kg)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const current = Array.isArray(editingProduct.variantsJson)
                      ? editingProduct.variantsJson
                      : [];
                    const newVar: ProductVariant = {
                      id: `var_${Date.now()}`,
                      labelEn: '1 kg Pack',
                      labelUr: '1 کلو پیک',
                      unit: editingProduct.unit || 'kg',
                      pricePkr: editingProduct.pricePkr || 200,
                      stock: 30,
                    };
                    setEditingProduct({
                      ...editingProduct,
                      variantsJson: [...current, newVar],
                    });
                  }}
                  className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                >
                  + Add Variant
                </button>
              </div>
              {(editingProduct.variantsJson || []).map((v, idx) => (
                <div key={v.id} className="grid grid-cols-5 gap-2 items-center">
                  <input
                    type="text"
                    value={v.labelEn}
                    onChange={(e) => {
                      const next = [...(editingProduct.variantsJson || [])];
                      next[idx] = { ...v, labelEn: e.target.value };
                      setEditingProduct({ ...editingProduct, variantsJson: next });
                    }}
                    placeholder="Label EN"
                    className="h-8 px-2 border border-slate-300 rounded"
                  />
                  <input
                    type="text"
                    value={v.labelUr}
                    onChange={(e) => {
                      const next = [...(editingProduct.variantsJson || [])];
                      next[idx] = { ...v, labelUr: e.target.value };
                      setEditingProduct({ ...editingProduct, variantsJson: next });
                    }}
                    placeholder="Label UR"
                    className="h-8 px-2 border border-slate-300 rounded"
                  />
                  <input
                    type="number"
                    value={v.pricePkr}
                    onChange={(e) => {
                      const next = [...(editingProduct.variantsJson || [])];
                      next[idx] = { ...v, pricePkr: Number(e.target.value) };
                      setEditingProduct({ ...editingProduct, variantsJson: next });
                    }}
                    placeholder="Price"
                    className="h-8 px-2 font-mono border border-slate-300 rounded"
                  />
                  <input
                    type="number"
                    value={v.stock}
                    onChange={(e) => {
                      const next = [...(editingProduct.variantsJson || [])];
                      next[idx] = { ...v, stock: Number(e.target.value) };
                      setEditingProduct({ ...editingProduct, variantsJson: next });
                    }}
                    placeholder="Stock"
                    className="h-8 px-2 font-mono border border-slate-300 rounded"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = (editingProduct.variantsJson || []).filter(
                        (_, i) => i !== idx
                      );
                      setEditingProduct({ ...editingProduct, variantsJson: next });
                    }}
                    className="text-red-600 text-xs cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="h-9 px-4 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 px-5 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Save Product
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Edit/Create Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={handleSaveCategory}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingCategory.id ? 'Edit Category' : 'Add Category'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="p-1 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Department Group</label>
              <select
                value={editingCategory.groupKey || 'grocery_food'}
                onChange={(e) =>
                  setEditingCategory({ ...editingCategory, groupKey: e.target.value })
                }
                className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg"
              >
                <option value="grocery_food">Grocery & Food</option>
                <option value="fruits_vegetables">Fresh Fruits & Vegetables</option>
                <option value="household_cleaning">Household & Cleaning</option>
                <option value="personal_care_baby">Personal Care & Baby</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Name (EN)</label>
                <input
                  type="text"
                  required
                  value={editingCategory.nameEn || ''}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, nameEn: e.target.value })
                  }
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Name (UR)</label>
                <input
                  type="text"
                  required
                  value={editingCategory.nameUr || ''}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, nameUr: e.target.value })
                  }
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Image URL</label>
              <input
                type="text"
                value={editingCategory.imageUrl || ''}
                onChange={(e) =>
                  setEditingCategory({ ...editingCategory, imageUrl: e.target.value })
                }
                className="w-full h-9 px-2.5 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="h-9 px-4 rounded-lg border border-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 px-5 rounded-lg bg-emerald-700 text-white font-semibold cursor-pointer"
              >
                Save Category
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
