"""
Управление товарами каталога: сохранение и получение данных.
POST /products/save — сохранить список товаров (из админки)
GET  /products/get?article=XXX — получить один товар по артикулу
"""

import json
import os
import base64
import boto3
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")

    # GET /products/get?article=XXX
    if method == "GET":
        params = event.get("queryStringParameters") or {}
        article = params.get("article", "").strip()
        if not article:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "article required"})}

        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            f'SELECT article, category, params, price, gallery, photo_url FROM "{schema}".products WHERE article = %s',
            (article,)
        )
        row = cur.fetchone()
        conn.close()

        if not row:
            return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "not found"})}

        product = {
            "article": row[0],
            "category": row[1],
            "params": row[2],
            "price": row[3],
            "gallery": row[4],
            "photo_url": row[5],
        }
        return {"statusCode": 200, "headers": CORS, "body": json.dumps(product)}

    # POST /products/save — массовое сохранение
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        products = body.get("products", [])
        photos = body.get("photos", {})  # {article: "data:image/...;base64,..."}

        if not products:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "no products"})}

        s3 = get_s3()
        key_id = os.environ["AWS_ACCESS_KEY_ID"]
        conn = get_db()
        cur = conn.cursor()

        # Очищаем таблицу и заливаем заново
        cur.execute(f'DELETE FROM "{schema}".products')

        for p in products:
            article = p.get("article", "").strip()
            if not article:
                continue

            photo_url = None

            # Загружаем фото в S3 если есть
            if article in photos:
                data_url = photos[article]
                if "base64," in data_url:
                    header, b64data = data_url.split("base64,", 1)
                    ext = "jpg" if "jpeg" in header else ("png" if "png" in header else "jpg")
                    mime = "image/jpeg" if ext == "jpg" else "image/png"
                    img_bytes = base64.b64decode(b64data)
                    # Безопасный ключ для S3
                    safe_article = article.replace("/", "-").replace(" ", "_")
                    s3_key = f"catalog/{safe_article}.{ext}"
                    s3.put_object(
                        Bucket="files",
                        Key=s3_key,
                        Body=img_bytes,
                        ContentType=mime,
                    )
                    photo_url = f"https://cdn.poehali.dev/projects/{key_id}/bucket/{s3_key}"

            cur.execute(
                f'''INSERT INTO "{schema}".products (article, category, params, price, gallery, photo_url)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (article) DO UPDATE SET
                        category = EXCLUDED.category,
                        params = EXCLUDED.params,
                        price = EXCLUDED.price,
                        gallery = EXCLUDED.gallery,
                        photo_url = COALESCE(EXCLUDED.photo_url, "{schema}".products.photo_url),
                        updated_at = NOW()''',
                (article, p.get("category", ""), p.get("params", ""),
                 p.get("price", ""), p.get("gallery", ""), photo_url)
            )

        conn.commit()
        conn.close()

        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"saved": len(products)})}

    return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "method not allowed"})}
