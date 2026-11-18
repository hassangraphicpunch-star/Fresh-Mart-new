import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Languages,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { CartCheckoutDrawer } from './components/CartCheckoutDrawer.tsx';
import { OrderTrackingView } from './components/OrderTrackingView.tsx';
import { ProductCard } from './components/ProductCard.tsx';
import { ProductImage } from './components/ProductImage.tsx';
import { ProductModal } from './components/ProductModal.tsx';
import { COPY, GROUP_LABELS } from './i18n/translations.ts';
import {
  CartItem,
  Category,
  DeliveryArea,
  Language,
  Product,
  ProductVariant,
  StorePublicSettings,
} from './types/store.ts';

const HERO_IMAGE = '/src/assets/images/hero_fresh_mart_1795030136009.jpg';

const DEFAULT_SETTINGS: StorePublicSettings = {
  storeName: 'Fresh Mart',
  storeNameUr: 'فریش مارٹ',
  storeAddress: 'House No. L-94, Sector L-1, Surjani Town, Karachi, Pakistan',
  storeAddressUr: 'مکان نمبر L-94، سیکٹر L-1، سرجانی ٹاؤن، کراچی، پاکستان',
  storeLat: 25.0085,
  storeLng: 67.0645,
  whatsappNumber: '03233469424',
  deliveryRatePerKm: 50,
  deliveryEnabled: true,
  defaultLanguage: 'en',
  openingHoursEn: 'Daily: 8:00 AM – 11:30 PM',
  openingHoursUr: 'روزانہ: صبح 8:00 تا رات 11:30',
  googleMapsBrowserKey: '',
  whatsappConfigured: false,
};

type ViewMode = 'store' | 'track' | 'admin';
type FeaturedTab = 'all' | 'popular' | 'bestsellers' | 'offers';

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('fresh_mart_lang');
    return saved === 'ur' ? 'ur' : 'en';
  });

  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [view, setView] = useState<ViewMode>('store');
  const [trackedOrderNum, setTrackedOrderNum] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<StorePublicSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>([]);

  // Catalog Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [featuredTab, setFeaturedTab] = useState<FeaturedTab>('all');
  const [showAllCats, setShowAllCats] = useState(false);

  // Cart & Modals
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem('fresh_mart_cart');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  const t = COPY[lang];

  // Sync RTL / LTR
  useEffect(() => {
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    localStorage.setItem('fresh_mart_lang', lang);
  }, [lang]);

  // Persist Cart
  useEffect(() => {
    localStorage.setItem('fresh_mart_cart', JSON.stringify(cart));
  }, [cart]);

  // Google Maps Quota listener
  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  const loadStorefront = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/storefront');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load catalog.');
      }
      setSettings(data.settings || DEFAULT_SETTINGS);
      setCategories(data.categories || []);
      setProducts(data.products || []);
      setDeliveryAreas(data.deliveryAreas || []);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to connect to Fresh Mart.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStorefront();
  }, [loadStorefront]);

  const categoryById = useMemo(() => {
    const map: Record<number, Category> = {};
    for (const c of categories) map[c.id] = c;
    return map;
  }, [categories]);

  const handleAddToCart = useCallback(
    (product: Product, variant: ProductVariant | null, quantity: number) => {
      const key = `${product.id}_${variant?.id ?? 'base'}`;
      const unitPricePkr = variant
        ? variant.discountPricePkr ?? variant.pricePkr
        : product.discountPricePkr ?? product.pricePkr;
      const maxStock = variant ? variant.stock : product.stock;
      const unit = variant ? variant.unit : product.unit;

      setCart((prev) => {
        const idx = prev.findIndex((i) => i.key === key);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            quantity: Math.min(maxStock, updated[idx].quantity + quantity),
            unitPricePkr,
            maxStock,
          };
          return updated;
        }
        return [
          ...prev,
          {
            key,
            productId: product.id,
            variantId: variant?.id,
            nameEn: product.nameEn,
            nameUr: product.nameUr,
            variantLabelEn: variant?.labelEn,
            variantLabelUr: variant?.labelUr,
            unit,
            unitPricePkr,
            imageUrl: product.imageUrl,
            quantity: Math.min(maxStock, quantity),
            maxStock,
          },
        ];
      });
    },
    []
  );

  const handleUpdateCartQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.key === key
            ? {
                ...item,
                quantity: Math.min(item.maxStock, item.quantity + delta),
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveCartItem = (key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const visibleCategories = useMemo(() => {
    const filtered =
      selectedGroup === 'all'
        ? categories
        : categories.filter((c) => c.groupKey === selectedGroup);
    return showAllCats ? filtered : filtered.slice(0, 12);
  }, [categories, selectedGroup, showAllCats]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const cat = categoryById[p.categoryId];
      if (selectedGroup !== 'all' && cat?.groupKey !== selectedGroup) {
        return false;
      }
      if (selectedCategoryId !== 'all' && p.categoryId !== selectedCategoryId) {
        return false;
      }
      if (featuredTab === 'popular' && !p.isPopular) return false;
      if (featuredTab === 'bestsellers' && !p.isBestSeller) return false;
      if (featuredTab === 'offers' && !p.isSpecialOffer && !p.discountPricePkr)
        return false;

      if (q) {
        const hay = [
          p.nameEn,
          p.nameUr,
          p.descriptionEn,
          p.descriptionUr,
          cat?.nameEn,
          cat?.nameUr,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    products,
    categoryById,
    selectedGroup,
    selectedCategoryId,
    featuredTab,
    searchQuery,
  ]);

  const freshProduceProducts = useMemo(() => {
    return products.filter(
      (p) => categoryById[p.categoryId]?.groupKey === 'fruits_vegetables'
    );
  }, [products, categoryById]);

  const waClean = settings.whatsappNumber.replace(/\D/g, '').replace(/^0/, '92');

  const scrollToCatalog = () => {
    setView('store');
    setTimeout(() => {
      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      {/* Google Maps Demo Key Quota Warning Banner (Case A Requirement) */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm no-print">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-emerald-950/10 no-print">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setView('store')}
            className="text-xl font-extrabold tracking-tight text-emerald-900 font-display whitespace-nowrap shrink-0 cursor-pointer"
          >
            {lang === 'ur' ? settings.storeNameUr : settings.storeName}
          </button>

          {/* Zone 2: Concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={scrollToCatalog}
              className={`hover:text-emerald-800 hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'store' ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              {t.navShop}
            </button>
            <button
              type="button"
              onClick={() => {
                setView('store');
                setTimeout(() => {
                  document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' });
                }, 60);
              }}
              className="hover:text-emerald-800 hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.navCategories}
            </button>
            <button
              type="button"
              onClick={() => setView('track')}
              className={`hover:text-emerald-800 hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'track' ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              {t.navTrack}
            </button>
            <button
              type="button"
              onClick={() => setView('admin')}
              className={`hover:text-emerald-800 hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'admin' ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              {t.navAdmin}
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="h-10 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4 shrink-0" />
              <span>{t.cartButton}</span>
              <span className="font-mono tabular-nums">({cartCount})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {view === 'admin' ? (
        <AdminDashboard
          onStorefrontRefresh={() => void loadStorefront()}
          onExitAdmin={() => setView('store')}
        />
      ) : view === 'track' ? (
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setLang((l) => (l === 'en' ? 'ur' : 'en'))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-700" />
              <span>{lang === 'en' ? 'اردو' : 'English'}</span>
            </button>
          </div>
          <OrderTrackingView initialOrderNumber={trackedOrderNum} lang={lang} />
        </main>
      ) : (
        <main className="flex-1">
          {/* Storefront Utility Toolbar (Search + Bilingual Switcher + Mobile Quick Nav) */}
          <div className="border-b border-emerald-950/10 bg-[#F8FAF8]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-xl">
                <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.trim()) {
                      document
                        .getElementById('catalog')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                  }}
                  placeholder={t.searchPlaceholder}
                  className="w-full h-10 ps-10 pe-4 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex md:hidden items-center gap-2 text-xs font-medium text-slate-600">
                  <button
                    type="button"
                    onClick={() => setView('track')}
                    className="px-2 py-1.5 hover:text-emerald-800 whitespace-nowrap"
                  >
                    {t.navTrack}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('admin')}
                    className="px-2 py-1.5 hover:text-emerald-800 whitespace-nowrap"
                  >
                    {t.navAdmin}
                  </button>
                </div>

                {/* Language Segmented Switch */}
                <div
                  className="flex items-center p-1 bg-white border border-slate-200 rounded-lg shrink-0"
                  role="group"
                  aria-label="Language switcher"
                >
                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      lang === 'en'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('ur')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      lang === 'ur'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    اردو
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 1. Storefront Hero Split */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center space-y-5 py-2">
                <p className="text-xs font-medium text-emerald-800">
                  {t.storeLocationBadge}
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-slate-950 font-display leading-[1.15] [text-wrap:balance]">
                  {t.heroTitle}
                </h1>
                <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                  {t.heroSubtitle}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={scrollToCatalog}
                    className="h-11 px-6 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {t.heroPrimaryCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('track')}
                    className="h-11 px-5 rounded-lg border border-slate-300 hover:border-emerald-700 text-slate-800 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {t.heroSecondaryCta}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="aspect-[16/9] lg:aspect-auto lg:h-full min-h-[260px] rounded-2xl overflow-hidden border border-emerald-950/10 bg-stone-50">
                  <ProductImage
                    src={HERO_IMAGE}
                    alt="Fresh Mart Karachi groceries and seasonal produce"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 2. Shop by Category (4 Department Cards + 31 Category Buttons) */}
          <section id="categories" className="border-t border-slate-100 bg-[#F8FAF8] py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-slate-950 font-display">
                  {t.shopByCategory}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'all',
                    'grocery_food',
                    'fruits_vegetables',
                    'household_cleaning',
                    'personal_care_baby',
                  ].map((gk) => {
                    const active = selectedGroup === gk;
                    return (
                      <button
                        key={gk}
                        type="button"
                        onClick={() => {
                          setSelectedGroup(gk);
                          setSelectedCategoryId('all');
                        }}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-700/40'
                        }`}
                      >
                        {GROUP_LABELS[gk]?.[lang] ?? gk}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4 Department Visual Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    groupKey: 'grocery_food',
                    img: '/src/assets/images/cat_grocery_staples_1795030138094.jpg',
                    subEn: 'Atta · Daal · Rice · Oil · Ghee · Spices',
                    subUr: 'آٹا · دالیں · چاول · آئل · گھی · مصالحہ',
                  },
                  {
                    groupKey: 'fruits_vegetables',
                    img: '/src/assets/images/cat_fresh_produce_1795030138429.jpg',
                    subEn: 'Potatoes · Onions · Tomatoes · Mangoes · Apples',
                    subUr: 'آلو · پیاز · ٹماٹر · آم · سیب',
                  },
                  {
                    groupKey: 'household_cleaning',
                    img: '/src/assets/images/cat_household_cleaning_1795030138594.jpg',
                    subEn: 'Detergents · Washing Powder · Dish & Floor Care',
                    subUr: 'ڈیٹرجنٹ · واشنگ پاؤڈر · برتن و فرش کلینر',
                  },
                  {
                    groupKey: 'personal_care_baby',
                    img: '/src/assets/images/cat_personal_baby_1795030139416.jpg',
                    subEn: 'Soap · Shampoo · Perfumes · Baby Diapers',
                    subUr: 'صابن · شیمپو · پرفیوم · بے بی پیمپرز',
                  },
                ].map((dept) => (
                  <button
                    key={dept.groupKey}
                    type="button"
                    onClick={() => {
                      setSelectedGroup(dept.groupKey);
                      setSelectedCategoryId('all');
                      document
                        .getElementById('catalog')
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`group text-start bg-white rounded-xl overflow-hidden border transition-all cursor-pointer ${
                      selectedGroup === dept.groupKey
                        ? 'border-emerald-700 ring-1 ring-emerald-700'
                        : 'border-emerald-950/10 hover:border-emerald-700/40'
                    }`}
                  >
                    <div className="aspect-[4/3] bg-stone-50 overflow-hidden">
                      <ProductImage
                        src={dept.img}
                        alt={GROUP_LABELS[dept.groupKey][lang]}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="p-3.5 space-y-1">
                      <h3 className="text-sm font-bold text-slate-900">
                        {GROUP_LABELS[dept.groupKey][lang]}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">
                        {lang === 'ur' ? dept.subUr : dept.subEn}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* All 31 Subcategory Filter Buttons */}
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      selectedCategoryId === 'all'
                        ? 'bg-emerald-900 text-white border-emerald-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {t.allCategories}
                  </button>
                  {visibleCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        document
                          .getElementById('catalog')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        selectedCategoryId === cat.id
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-700/40'
                      }`}
                    >
                      {lang === 'ur' ? cat.nameUr : cat.nameEn}
                    </button>
                  ))}
                </div>
                {categories.length > 12 && (
                  <button
                    type="button"
                    onClick={() => setShowAllCats((v) => !v)}
                    className="text-xs font-semibold text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>
                      {showAllCats ? t.hideExtraCategories : t.showAllCategories}
                    </span>
                    {showAllCats ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 3. Main Product Catalog */}
          <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-950 font-display">
                  {selectedCategoryId !== 'all' && categoryById[selectedCategoryId]
                    ? lang === 'ur'
                      ? categoryById[selectedCategoryId].nameUr
                      : categoryById[selectedCategoryId].nameEn
                    : t.catalogHeading}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                  {filteredProducts.length} {t.productsCount}
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                {[
                  { id: 'all', label: t.featuredTabAll },
                  { id: 'popular', label: t.featuredTabPopular },
                  { id: 'bestsellers', label: t.featuredTabBestSellers },
                  { id: 'offers', label: t.featuredTabOffers },
                ].map((tabItem) => (
                  <button
                    key={tabItem.id}
                    type="button"
                    onClick={() => setFeaturedTab(tabItem.id as FeaturedTab)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      featuredTab === tabItem.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tabItem.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-700" />
                <span className="text-sm">Loading Fresh Mart catalog...</span>
              </div>
            ) : loadError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
                <p className="text-sm text-red-800">{loadError}</p>
                <button
                  type="button"
                  onClick={() => void loadStorefront()}
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16 text-center space-y-3 border border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-sm text-slate-600">{t.emptyProducts}</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedGroup('all');
                    setSelectedCategoryId('all');
                    setFeaturedTab('all');
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                >
                  {t.resetFilters}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    category={categoryById[product.categoryId]}
                    lang={lang}
                    onAddToCart={handleAddToCart}
                    onOpenDetail={setDetailProduct}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 4. Fresh Fruits & Vegetables Showcase (when viewing general store) */}
          {selectedGroup === 'all' &&
            selectedCategoryId === 'all' &&
            !searchQuery.trim() &&
            freshProduceProducts.length > 0 && (
              <section className="border-t border-slate-100 bg-[#F8FAF8] py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-950 font-display">
                        {t.freshProduceHeading}
                      </h2>
                      <p className="text-sm text-slate-600 mt-1">{t.freshProduceSub}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGroup('fruits_vegetables');
                        scrollToCatalog();
                      }}
                      className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
                    >
                      {t.heroPrimaryCta} →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {freshProduceProducts.slice(0, 4).map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        category={categoryById[product.categoryId]}
                        lang={lang}
                        onAddToCart={handleAddToCart}
                        onOpenDetail={setDetailProduct}
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}

          {/* 5. Why Choose Fresh Mart & Karachi Coverage */}
          <section className="border-t border-slate-200 py-12 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-slate-950 font-display">
                  {t.whyChooseTitle}
                </h2>
                <a
                  href={`https://wa.me/${waClean}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>
                    {t.whatsappHelp} ({settings.whatsappNumber})
                  </span>
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: t.why1Title, desc: t.why1Desc },
                  { title: t.why2Title, desc: t.why2Desc },
                  { title: t.why3Title, desc: t.why3Desc },
                  { title: t.why4Title, desc: t.why4Desc },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-xl border border-slate-200 bg-[#F8FAF8]/60 space-y-2"
                  >
                    <div className="text-xs font-mono font-semibold text-emerald-800">
                      0{idx + 1}.
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-950 text-slate-300 py-10 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
          <div className="space-y-2">
            <div className="text-base font-bold text-white font-display">
              {lang === 'ur' ? settings.storeNameUr : settings.storeName}
            </div>
            <p className="text-slate-400 leading-relaxed">
              {lang === 'ur' ? settings.storeAddressUr : settings.storeAddress}
            </p>
            <p className="text-slate-400">
              {lang === 'ur' ? settings.openingHoursUr : settings.openingHoursEn}
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-white">Karachi Delivery & Contact</div>
            <p className="flex items-center gap-2 text-slate-300 font-mono">
              <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>WhatsApp: {settings.whatsappNumber}</span>
            </p>
            <p className="flex items-center gap-2 text-slate-300 font-mono">
              <Truck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Rate: Rs. {settings.deliveryRatePerKm} / KM</span>
            </p>
            <p className="flex items-center gap-2 text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>All Karachi Areas · Cash on Delivery</span>
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-white">Quick Links</div>
            <div className="flex flex-col gap-1.5 items-start">
              <button
                type="button"
                onClick={scrollToCatalog}
                className="hover:text-white cursor-pointer"
              >
                {t.navShop}
              </button>
              <button
                type="button"
                onClick={() => setView('track')}
                className="hover:text-white cursor-pointer"
              >
                {t.navTrack}
              </button>
              <button
                type="button"
                onClick={() => setView('admin')}
                className="hover:text-white cursor-pointer"
              >
                {t.navAdmin}
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pt-6 border-t border-slate-800 text-[11px] text-slate-500 flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} {t.footerRights}</span>
          <span>PKR · Cash on Delivery</span>
        </div>
      </footer>

      {/* Product Detail Modal */}
      <ProductModal
        product={detailProduct}
        category={detailProduct ? categoryById[detailProduct.categoryId] : undefined}
        lang={lang}
        onClose={() => setDetailProduct(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Cart & Checkout Slide-Over Drawer */}
      <CartCheckoutDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={() => setCart([])}
        deliveryAreas={deliveryAreas}
        settings={settings}
        lang={lang}
        onOrderSuccess={(orderNum) => {
          setTrackedOrderNum(orderNum);
          setView('track');
        }}
      />
    </div>
  );
}
