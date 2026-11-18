import React, { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus, ShoppingCart, X } from 'lucide-react';
import { COPY, UNIT_LABELS } from '../i18n/translations.ts';
import { Category, Language, Product, ProductVariant } from '../types/store.ts';
import { ProductImage } from './ProductImage.tsx';

interface ProductModalProps {
  product: Product | null;
  category?: Category;
  lang: Language;
  onClose: () => void;
  onAddToCart: (product: Product, variant: ProductVariant | null, quantity: number) => void;
}

export function ProductModal({
  product,
  category,
  lang,
  onClose,
  onAddToCart,
}: ProductModalProps) {
  const t = COPY[lang];
  const variants = useMemo(
    () => (product && Array.isArray(product.variantsJson) ? product.variantsJson : []),
    [product]
  );

  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variants[0]?.id ?? ''
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [added, setAdded] = useState<boolean>(false);

  useEffect(() => {
    setSelectedVariantId(variants[0]?.id ?? '');
    setQuantity(1);
    setAdded(false);
  }, [product?.id, variants]);

  if (!product) return null;

  const activeVariant =
    variants.find((v) => v.id === selectedVariantId) ?? variants[0] ?? null;

  const effectivePrice = activeVariant
    ? activeVariant.discountPricePkr ?? activeVariant.pricePkr
    : product.discountPricePkr ?? product.pricePkr;
  const originalPrice = activeVariant ? activeVariant.pricePkr : product.pricePkr;
  const hasDiscount = effectivePrice < originalPrice;
  const availableStock = activeVariant ? activeVariant.stock : product.stock;
  const unitKey = activeVariant ? activeVariant.unit : product.unit;
  const unitLabel = UNIT_LABELS[unitKey]?.[lang] ?? unitKey;

  const title = lang === 'ur' ? product.nameUr : product.nameEn;
  const description = lang === 'ur' ? product.descriptionUr : product.descriptionEn;
  const categoryName = category ? (lang === 'ur' ? category.nameUr : category.nameEn) : '';

  const handleAdd = () => {
    if (!product.isAvailable || availableStock <= 0) return;
    onAddToCart(product, activeVariant, quantity);
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-emerald-950/10 grid grid-cols-1 md:grid-cols-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-stone-50 aspect-[4/3] md:aspect-auto md:h-full relative">
          <ProductImage
            src={product.imageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="md:hidden absolute top-3 end-3 w-9 h-9 rounded-full bg-white/90 text-slate-800 flex items-center justify-center shadow"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {categoryName && <span>{categoryName}</span>}
              <span aria-hidden="true">·</span>
              <span className="font-mono">{product.sku}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="hidden md:flex w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-xl font-bold text-slate-900 font-display leading-snug">
            {title}
          </h2>

          <p className="text-sm text-slate-600 leading-relaxed">{description}</p>

          {variants.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-700 mb-2">
                {t.selectSize}
              </div>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const active = activeVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedVariantId(v.id);
                        setQuantity(1);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-50 border-emerald-700 text-emerald-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {lang === 'ur' ? v.labelUr : v.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="text-2xl font-bold text-slate-900 font-mono">
                  Rs. {effectivePrice.toLocaleString('en-PK')}
                </span>
                {hasDiscount && (
                  <span className="text-sm text-slate-400 line-through font-mono">
                    Rs. {originalPrice.toLocaleString('en-PK')}
                  </span>
                )}
                <span className="text-xs text-slate-500">/ {unitLabel}</span>
              </div>
              <span
                className={`text-xs font-medium tabular-nums ${
                  availableStock > 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {availableStock > 0
                  ? `${availableStock} ${t.inStock}`
                  : t.outOfStock}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center border border-slate-200 rounded-lg h-11 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-10 h-full flex items-center justify-center text-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-9 text-center text-sm font-semibold tabular-nums font-mono">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(availableStock || 1, q + 1))}
                  disabled={quantity >= availableStock}
                  className="w-10 h-full flex items-center justify-center text-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                disabled={!product.isAvailable || availableStock <= 0}
                className="flex-1 h-11 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {added ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                <span>
                  {added
                    ? t.addedToCart
                    : availableStock > 0
                      ? t.addToCart
                      : t.outOfStock}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
