import React, { useMemo, useState } from 'react';
import { Check, Minus, Plus, ShoppingCart } from 'lucide-react';
import { COPY, UNIT_LABELS } from '../i18n/translations.ts';
import { Category, Language, Product, ProductVariant } from '../types/store.ts';
import { ProductImage } from './ProductImage.tsx';

interface ProductCardProps {
  product: Product;
  category?: Category;
  lang: Language;
  onAddToCart: (product: Product, variant: ProductVariant | null, quantity: number) => void;
  onOpenDetail: (product: Product) => void;
}

export function ProductCard({
  product,
  category,
  lang,
  onAddToCart,
  onOpenDetail,
}: ProductCardProps) {
  const t = COPY[lang];
  const variants = useMemo(
    () => (Array.isArray(product.variantsJson) ? product.variantsJson : []),
    [product.variantsJson]
  );

  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    variants[0]?.id ?? ''
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [justAdded, setJustAdded] = useState<boolean>(false);

  const activeVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) ?? variants[0] ?? null,
    [variants, selectedVariantId]
  );

  const effectivePrice = activeVariant
    ? activeVariant.discountPricePkr ?? activeVariant.pricePkr
    : product.discountPricePkr ?? product.pricePkr;

  const originalPrice = activeVariant ? activeVariant.pricePkr : product.pricePkr;
  const hasDiscount = effectivePrice < originalPrice;
  const availableStock = activeVariant ? activeVariant.stock : product.stock;
  const unitKey = activeVariant ? activeVariant.unit : product.unit;
  const unitLabel = UNIT_LABELS[unitKey]?.[lang] ?? unitKey;

  const title = lang === 'ur' ? product.nameUr : product.nameEn;
  const categoryName = category ? (lang === 'ur' ? category.nameUr : category.nameEn) : '';

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.isAvailable || availableStock <= 0) return;
    onAddToCart(product, activeVariant, quantity);
    setJustAdded(true);
    setQuantity(1);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <article className="group bg-white border border-emerald-950/10 rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-800/25">
      <button
        type="button"
        onClick={() => onOpenDetail(product)}
        className="relative aspect-[4/3] w-full bg-stone-50 overflow-hidden text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
      >
        <ProductImage
          src={product.imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {hasDiscount && (
          <span className="absolute top-2.5 start-2.5 bg-emerald-800 text-white text-[11px] font-semibold px-2 py-0.5 rounded tabular-nums">
            {Math.round(((originalPrice - effectivePrice) / originalPrice) * 100)}% OFF
          </span>
        )}
      </button>

      <div className="p-4 flex flex-col flex-1 gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1 truncate">
            {categoryName && <span className="truncate">{categoryName}</span>}
            {categoryName && <span aria-hidden="true">·</span>}
            <span
              className={`tabular-nums shrink-0 ${
                availableStock > 0 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {availableStock > 0
                ? availableStock <= 10
                  ? `${availableStock} ${t.onlyLeft}`
                  : t.inStock
                : t.outOfStock}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpenDetail(product)}
            className="text-start w-full focus-visible:outline-none focus-visible:underline"
          >
            <h3 className="text-[15px] font-semibold text-slate-900 leading-snug line-clamp-2">
              {title}
            </h3>
          </button>
        </div>

        {/* Variant selector */}
        {variants.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {variants.map((v) => {
              const isSelected = activeVariant?.id === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVariantId(v.id);
                    setQuantity(1);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-700 text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {lang === 'ur' ? v.labelUr : v.labelEn}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-auto pt-2 border-t border-slate-100 flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2 tabular-nums">
              <span className="text-base font-bold text-slate-900 font-mono">
                Rs. {effectivePrice.toLocaleString('en-PK')}
              </span>
              {hasDiscount && (
                <span className="text-xs text-slate-400 line-through font-mono">
                  Rs. {originalPrice.toLocaleString('en-PK')}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 shrink-0">/ {unitLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center border border-slate-200 rounded-lg h-10 bg-slate-50/60 shrink-0">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={availableStock <= 0 || quantity <= 1}
                className="w-8 h-full flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-7 text-center text-xs font-semibold tabular-nums font-mono text-slate-900">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQuantity((q) => Math.min(availableStock || 1, q + 1))}
                disabled={availableStock <= 0 || quantity >= availableStock}
                className="w-8 h-full flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={!product.isAvailable || availableStock <= 0}
              className={`flex-1 h-10 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                justAdded
                  ? 'bg-emerald-900 text-white'
                  : 'bg-emerald-700 text-white hover:bg-emerald-800'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{t.addedToCart}</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                  <span>{availableStock > 0 ? t.addToCart : t.outOfStock}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
