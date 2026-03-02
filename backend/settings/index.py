"""
Управление настройками каталога.
POST ?action=check  — проверить пароль: {password: "..."}
POST ?action=update — сменить пароль: {password: "..."}
GET  /              — получить текущий пароль (для отображения в админке)
"""

import json
import os
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    # POST ?action=check — проверить пароль
    if method == "POST" and action == "check":
        body = json.loads(event.get("body") or "{}")
        password = body.get("password", "")

        conn = get_db()
        cur = conn.cursor()
        cur.execute(f"SELECT value FROM \"{schema}\".settings WHERE key = 'catalog_password'")
        row = cur.fetchone()
        conn.close()

        stored = row[0] if row else "2024"
        if password == stored:
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"ok": False})}

    # POST ?action=update — сменить пароль
    if method == "POST" and action == "update":
        body = json.loads(event.get("body") or "{}")
        new_password = body.get("password", "").strip()

        if not new_password:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "password required"})}

        new_password_esc = new_password.replace("'", "''")
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO \"{schema}\".settings (key, value) VALUES ('catalog_password', '{new_password_esc}') "
            f"ON CONFLICT (key) DO UPDATE SET value = '{new_password_esc}', updated_at = NOW()"
        )
        conn.commit()
        conn.close()

        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

    # GET — получить текущий пароль (для отображения в админке)
    if method == "GET":
        conn = get_db()
        cur = conn.cursor()
        cur.execute(f"SELECT value FROM \"{schema}\".settings WHERE key = 'catalog_password'")
        row = cur.fetchone()
        conn.close()

        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"password": row[0] if row else "2024"})}

    return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "method not allowed"})}
