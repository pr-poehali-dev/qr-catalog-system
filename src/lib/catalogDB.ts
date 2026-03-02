const DB_NAME = "catalog_db";
const DB_VERSION = 1;
const STORE_PRODUCTS = "products";
const STORE_PHOTOS = "photos";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS, { keyPath: "article" });
      }
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface ProductRecord {
  article: string;
  category: string;
  params: string;
  price: string;
  gallery: string;
}

export async function saveProducts(
  products: ProductRecord[],
  photos: Record<string, string>
): Promise<void> {
  const db = await openDB();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_PRODUCTS, STORE_PHOTOS], "readwrite");
    const prodStore = tx.objectStore(STORE_PRODUCTS);
    const photoStore = tx.objectStore(STORE_PHOTOS);

    prodStore.clear();
    photoStore.clear();

    for (const p of products) {
      prodStore.put(p);
    }
    for (const [key, val] of Object.entries(photos)) {
      photoStore.put(val, key);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getProduct(article: string): Promise<ProductRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTS, "readonly");
    const req = tx.objectStore(STORE_PRODUCTS).get(article);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getPhoto(article: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHOTOS, "readonly");
    const store = tx.objectStore(STORE_PHOTOS);
    const keys: string[] = [];
    const reqKeys = store.getAllKeys();
    reqKeys.onsuccess = () => {
      const allKeys = reqKeys.result as string[];
      const artVariants = [
        article.toLowerCase(),
        article.toLowerCase().replace(/\//g, "-"),
        article.toLowerCase().replace(/\//g, "_"),
        article.toLowerCase().replace(/[^a-z0-9а-яё]/gi, ""),
        article.toLowerCase().replace(/[^a-z0-9а-яё]/gi, "-"),
      ].filter(Boolean);

      const matched = allKeys.find((k) => {
        const kn = k.toLowerCase();
        return artVariants.some((v) => kn.includes(v) || v.includes(kn));
      });

      if (!matched) {
        resolve(null);
        return;
      }

      const reqVal = store.get(matched);
      reqVal.onsuccess = () => resolve(reqVal.result ?? null);
      reqVal.onerror = () => reject(reqVal.error);
    };
    reqKeys.onerror = () => reject(reqKeys.error);
  });
}