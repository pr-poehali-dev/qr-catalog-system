import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { getProduct, getPhoto } from "@/lib/catalogDB";

interface Product {
  category: string;
  article: string;
  params: string;
  price: string;
  gallery: string;
  photo?: string;
}

function formatPrice(raw: string): string {
  const cleaned = String(raw).replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return raw;
  return num.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProductCard() {
  const [searchParams] = useSearchParams();
  const article = searchParams.get("article") || "";
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!article) { setNotFound(true); return; }
    (async () => {
      const found = await getProduct(article);
      if (!found) { setNotFound(true); return; }
      const photo = await getPhoto(article);
      setProduct({ ...found, photo: photo ?? undefined });
    })();
  }, [article]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-golos p-6 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#2F4F4F" }}>
          <Icon name="PackageX" size={28} className="text-white" />
        </div>
        <h2 className="text-lg font-semibold" style={{ color: "#2F4F4F" }}>Товар не найден</h2>
        <p className="text-sm text-gray-400 mt-1 font-ibm">Артикул: {article || "не указан"}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#2F4F4F", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const hasPhoto = !!product.photo && !imgError;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center font-golos p-0 md:p-6 animate-fade-in">
      {/* Card — full screen on mobile, centered ~30% width on desktop */}
      <div
        className="bg-white w-full md:max-w-sm md:rounded-2xl overflow-hidden flex flex-col"
        style={{
          minHeight: "100dvh",
          boxShadow: "0 4px 40px rgba(47,79,79,0.13)",
        }}
      >
        {/* Header */}
        <div style={{ background: "#2F4F4F" }} className="px-5 pt-8 pb-4 flex-shrink-0">
          <p className="text-xs font-ibm uppercase tracking-widest text-white/50 mb-1">
            {product.category}
          </p>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {product.article}
          </h1>
        </div>

        {/* Photo — 30% карточки desktop / 50% mobile через aspect-ratio */}
        <div
          className="w-full flex-shrink-0 bg-gray-50 flex items-center justify-center overflow-hidden"
          style={{
            /* mobile: 50vh-ish, desktop: 30% of card */
            height: "clamp(180px, 30vh, 260px)",
            borderBottom: "2px solid #2F4F4F",
          }}
        >
          {hasPhoto ? (
            <img
              src={product.photo}
              alt={product.article}
              onError={() => setImgError(true)}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 w-full h-full">
              <span className="text-5xl opacity-20">📷</span>
              <span className="text-xs text-gray-300 font-ibm">Фото недоступно</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-4 flex-1 flex flex-col">
          {/* Params */}
          {product.params && (
            <div>
              <p className="text-xs font-ibm uppercase tracking-widest text-gray-400 mb-1">
                Параметры
              </p>
              <p className="text-sm leading-relaxed font-ibm text-gray-700">
                {product.params}
              </p>
            </div>
          )}

          <div className="h-px" style={{ background: "rgba(47,79,79,0.08)" }} />

          {/* Price */}
          <div>
            <p className="text-xs font-ibm uppercase tracking-widest text-gray-400 mb-1">
              Цена (опт)
            </p>
            <p className="text-3xl font-bold tracking-tight" style={{ color: "#2F4F4F" }}>
              {formatPrice(product.price)}{" "}
              <span className="text-base font-medium">₽</span>
            </p>
          </div>

          {/* Button — прижата к низу */}
          <div className="flex-1 flex items-end pb-2">
            {product.gallery ? (
              <a
                href={product.gallery}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                style={{ background: "#2F4F4F" }}
              >
                <Icon name="Images" size={16} />
                Открыть галерею на сайте
              </a>
            ) : (
              <div className="w-full" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
