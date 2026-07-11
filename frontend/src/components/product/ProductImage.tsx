import { useState } from "react";
import { PRODUCT_IMAGE_FALLBACK } from "@/lib/productImage";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: "lazy" | "eager";
  crossOrigin?: "anonymous";
};

/** <img> for a product photo — swaps to the PulseShop placeholder when no
 *  image was ever set, or when the given URL fails to load (404, deleted
 *  storage object, etc). */
export function ProductImage({ src, alt, className, style, loading, crossOrigin }: ProductImageProps) {
  const [errored, setErrored] = useState(false);
  const usingFallback = !src || errored;

  return (
    <img
      src={usingFallback ? PRODUCT_IMAGE_FALLBACK : src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      crossOrigin={usingFallback ? undefined : crossOrigin}
      onError={() => setErrored(true)}
    />
  );
}
