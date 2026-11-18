import React, { useState } from 'react';
import { ShoppingBag } from 'lucide-react';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function ProductImage({ src, alt, className = '' }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-stone-50 to-emerald-100/70 text-emerald-800/70 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <ShoppingBag className="w-8 h-8 mb-2 stroke-[1.5]" />
        <span className="text-xs font-medium line-clamp-2 max-w-[160px] text-emerald-950/70">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
}
