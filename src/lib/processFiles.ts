import * as XLSX from "xlsx";
import JSZip from "jszip";

export const PRODUCTS_URL = "https://functions.poehali.dev/2d53c3f9-ece3-4909-b127-ad2dd38059f9";
const BASE_URL = window.location.origin;

export interface ProductRow {
  article: string;
  category: string;
  params: string;
  price: string;
  gallery: string;
  hasPhoto: boolean;
  photo?: string;
  url: string;
}

function slugify(article: string) {
  return encodeURIComponent(article);
}

function findPhotoForArticle(
  article: string,
  photoMap: Record<string, string>
): string | undefined {
  const artVariants = [
    article.toLowerCase(),
    article.toLowerCase().replace(/\//g, "-"),
    article.toLowerCase().replace(/\//g, "_"),
    article.toLowerCase().replace(/[^a-z0-9а-яё]/gi, ""),
    article.toLowerCase().replace(/[^a-z0-9а-яё]/gi, "-"),
  ].filter(Boolean);

  for (const [key, dataUrl] of Object.entries(photoMap)) {
    const keyNorm = key.toLowerCase();
    const matched = artVariants.some((v) => keyNorm.includes(v) || v.includes(keyNorm));
    if (matched) return dataUrl;
  }
  return undefined;
}

export async function parseSpreadsheet(file: File): Promise<unknown[][]> {
  const buffer = await file.arrayBuffer();
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    let text = "";
    try {
      text = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
    } catch {
      text = new TextDecoder("windows-1251").decode(new Uint8Array(buffer));
    }
    const separator = text.indexOf(";") !== -1 ? ";" : ",";
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "")
      .map((line) =>
        line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""))
      );
  }

  const wb = XLSX.read(buffer, { type: "array", cellText: false, raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as unknown[][];
}

export async function parseZip(file: File): Promise<Record<string, string>> {
  const photoMap: Record<string, string> = {};
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const promises: Promise<void>[] = [];

  zip.forEach((relativePath, zipFile) => {
    if (zipFile.dir) return;
    const ext = relativePath.split(".").pop()?.toLowerCase();
    if (!["jpg", "jpeg", "png"].includes(ext || "")) return;
    const baseName = relativePath.split("/").pop()?.replace(/\.[^.]+$/, "") || "";
    promises.push(
      zipFile.async("base64").then((b64) => {
        const mime = ext === "png" ? "image/png" : "image/jpeg";
        photoMap[baseName.toLowerCase()] = `data:${mime};base64,${b64}`;
      })
    );
  });

  await Promise.all(promises);
  return photoMap;
}

export function buildProducts(
  rows: unknown[][],
  photoMap: Record<string, string>
): ProductRow[] {
  const dataRows = rows.slice(1).filter((r) => String(r[2] ?? "").trim() !== "");
  return dataRows.map((row) => {
    const article = String(row[2] ?? "").trim();
    const photo = findPhotoForArticle(article, photoMap);
    return {
      article,
      category: String(row[0] ?? "").trim(),
      params: String(row[3] ?? "").trim(),
      price: String(row[4] ?? "").trim(),
      gallery: String(row[5] ?? "").trim(),
      hasPhoto: !!photo,
      photo,
      url: `${BASE_URL}/?article=${slugify(article)}`,
    };
  });
}

// Сжимаем изображение через Canvas до нужного размера (макс 800px, качество 0.7)
async function compressImage(dataUrl: string, maxPx = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Отправляем товары без фото, потом фото по одному отдельными запросами
export async function saveToServer(
  products: ProductRow[],
  onProgress?: (msg: string) => void
): Promise<void> {
  onProgress?.("Сохраняю товары...");

  const slim = products.map((p) => ({
    article: p.article,
    category: p.category,
    params: p.params,
    price: p.price,
    gallery: p.gallery,
  }));

  // Шаг 1: сохраняем все товары чанками по 100 (без фото)
  const CHUNK = 100;
  for (let ci = 0; ci < slim.length; ci += CHUNK) {
    const chunk = slim.slice(ci, ci + CHUNK);
    const isFirst = ci === 0;
    const saveResp = await fetch(PRODUCTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products: chunk, photos: {}, is_first_chunk: isFirst }),
    });
    if (!saveResp.ok) {
      const err = await saveResp.json().catch(() => ({}));
      throw new Error(err.error || `Ошибка сервера ${saveResp.status}`);
    }
    if (slim.length > CHUNK) {
      onProgress?.(`Сохраняю товары ${Math.min(ci + CHUNK, slim.length)} из ${slim.length}...`);
    }
  }

  // Шаг 2: загружаем фото по одному со сжатием
  const withPhoto = products.filter((p) => p.photo);
  for (let i = 0; i < withPhoto.length; i++) {
    const p = withPhoto[i];
    onProgress?.(`Загружаю фото ${i + 1} из ${withPhoto.length}...`);

    // Сжимаем перед отправкой
    const compressed = await compressImage(p.photo!);

    const photoResp = await fetch(PRODUCTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        products: [{ article: p.article, category: p.category, params: p.params, price: p.price, gallery: p.gallery }],
        photos: { [p.article]: compressed },
      }),
    });
    if (!photoResp.ok) {
      console.warn(`Не удалось загрузить фото для ${p.article}: ${photoResp.status}`);
    }
  }
}