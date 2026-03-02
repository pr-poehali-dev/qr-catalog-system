import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Icon from "@/components/ui/icon";

const PRODUCTS_URL = "https://functions.poehali.dev/2d53c3f9-ece3-4909-b127-ad2dd38059f9";

interface Product {
  category: string;
  article: string;
  params: string;
  price: string;
  gallery: string;
  photo_url?: string;
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
    const url = `${PRODUCTS_URL}?article=${encodeURIComponent(article)}`;
    console.log("[ProductCard] fetching:", url);
    fetch(url)
      .then(async (r) => {
        console.log("[ProductCard] response status:", r.status);
        if (r.status === 404) { setNotFound(true); return null; }
        const data = await r.json();
        console.log("[ProductCard] data:", data);
        return data;
      })
      .then((data) => { if (data) setProduct(data); })
      .catch((err) => {
        console.error("[ProductCard] fetch error:", err);
        setNotFound(true);
      });
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

  const hasPhoto = !!product.photo_url && !imgError;

  return (
    <div
      className="min-h-screen bg-gray-50 flex items-center justify-center font-golos animate-fade-in"
      style={{ padding: "clamp(0px, 4vw, 24px)" }}
    >
      {/*
        Мобильный: карточка на всю высоту экрана, без скролла
        Десктоп: карточка ~50% ширины, скруглённая, с тенью
      */}
      <div
        className="bg-white w-full md:max-w-xl md:rounded-2xl overflow-hidden flex flex-col"
        style={{
          height: "100dvh",
          maxHeight: "100dvh",
          boxShadow: "0 4px 40px rgba(47,79,79,0.13)",
        }}
      >
        {/* Header */}
        <div style={{ background: "#2F4F4F" }} className="px-5 pt-6 pb-4 flex-shrink-0">
          <p className="text-xs font-ibm uppercase tracking-widest text-white/50 mb-0.5">
            {product.category}
          </p>
          <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
            {product.article}
          </h1>
        </div>

        {/* Photo — 36% высоты карточки */}
        <div
          className="w-full flex-shrink-0 bg-gray-50 flex items-center justify-center"
          style={{
            height: "36%",
            borderBottom: "2px solid #2F4F4F",
            padding: "12px 0",
          }}
        >
          {hasPhoto ? (
            <img
              src={product.photo_url}
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
              <span className="text-4xl opacity-20">📷</span>
              <span className="text-xs text-gray-300 font-ibm">Фото недоступно</span>
            </div>
          )}
        </div>

        {/* Content — занимает оставшееся место */}
        <div className="px-5 py-4 flex-1 flex flex-col gap-3 min-h-0">
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

          <div className="h-px flex-shrink-0" style={{ background: "rgba(47,79,79,0.08)" }} />

          <div>
            <p className="text-xs font-ibm uppercase tracking-widest text-gray-400 mb-1">
              Цена (опт)
            </p>
            <p className="text-2xl font-bold tracking-tight" style={{ color: "#2F4F4F" }}>
              {formatPrice(product.price)}{" "}
              <span className="text-sm font-medium">₽</span>
            </p>
          </div>

          {/* Кнопка прижата к низу */}
          <div className="flex-1 flex items-end pb-3">
            {product.gallery ? (
              <a
                href={product.gallery}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
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