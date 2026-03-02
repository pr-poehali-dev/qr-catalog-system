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

export default function ProductCard() {
  const [searchParams] = useSearchParams();
  const article = searchParams.get("article") || "";
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!article) {
      setNotFound(true);
      return;
    }
    (async () => {
      const found = await getProduct(article);
      if (!found) {
        setNotFound(true);
        return;
      }
      const photo = await getPhoto(article);
      setProduct({ ...found, photo: photo ?? undefined });
    })();
  }, [article]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center font-golos p-6 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "#2F4F4F" }}
        >
          <Icon name="PackageX" size={28} className="text-white" />
        </div>
        <h2 className="text-lg font-semibold" style={{ color: "#2F4F4F" }}>
          Товар не найден
        </h2>
        <p className="text-sm text-gray-400 mt-1 font-ibm">
          Артикул: {article || "не указан"}
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#2F4F4F", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  const hasPhoto = !!product.photo && !imgError;

  return (
    <div className="min-h-screen bg-white font-golos animate-fade-in">
      {/* Header */}
      <div style={{ background: "#2F4F4F" }} className="px-5 pt-10 pb-5">
        <p className="text-xs font-ibm uppercase tracking-widest text-white/50 mb-1">
          {product.category}
        </p>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {product.article}
        </h1>
      </div>

      {/* Photo */}
      <div
        className="relative overflow-hidden"
        style={{
          height: "320px",
          borderBottom: "3px solid #2F4F4F",
        }}
      >
        {hasPhoto ? (
          <img
            src={product.photo}
            alt={product.article}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center gap-3">
            <span className="text-5xl opacity-30">📷</span>
            <span className="text-xs text-gray-300 font-ibm">Фото недоступно</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-5 py-6 space-y-5 animate-slide-up">
        {/* Params */}
        {product.params && (
          <div>
            <p className="text-xs font-ibm uppercase tracking-widest text-gray-400 mb-2">
              Параметры
            </p>
            <p className="text-sm leading-relaxed font-ibm text-gray-700">
              {product.params}
            </p>
          </div>
        )}

        <div
          className="h-px"
          style={{ background: "#2F4F4F", opacity: 0.08 }}
        />

        {/* Price */}
        <div>
          <p className="text-xs font-ibm uppercase tracking-widest text-gray-400 mb-1">
            Цена (опт)
          </p>
          <p className="text-3xl font-bold tracking-tight" style={{ color: "#2F4F4F" }}>
            {(() => {
              const cleaned = String(product.price).replace(/\s/g, "").replace(",", ".");
              const num = parseFloat(cleaned);
              return isNaN(num)
                ? product.price
                : num.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            })()}{" "}
            <span className="text-base font-medium">₽</span>
          </p>
        </div>

        {/* Button */}
        {product.gallery && (
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
        )}
      </div>
    </div>
  );
}