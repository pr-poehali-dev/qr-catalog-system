"""
Управление настройками каталога.
POST ?action=check  — проверить пароль: {password: "..."} → {ok, session_version}
POST ?action=update — сменить пароль: {password: "..."} → инкрементирует session_version
GET  /              — получить пароль и session_version (для админки)
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


def get_setting(cur, schema, key, default=""):
    cur.execute(f"SELECT value FROM \"{schema}\".settings WHERE key = '{key}'")
    row = cur.fetchone()
    return row[0] if row else default


def set_setting(cur, schema, key, value):
    value_esc = value.replace("'", "''")
    cur.execute(
        f"INSERT INTO \"{schema}\".settings (key, value) VALUES ('{key}', '{value_esc}') "
        f"ON CONFLICT (key) DO UPDATE SET value = '{value_esc}', updated_at = NOW()"
    )


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    # POST ?action=check — проверить пароль, вернуть версию сессии
    if method == "POST" and action == "check":
        body = json.loads(event.get("body") or "{}")
        password = body.get("password", "")

        conn = get_db()
        cur = conn.cursor()
        stored = get_setting(cur, schema, "catalog_password", "2024")
        version = get_setting(cur, schema, "session_version", "1")
        conn.close()

        if password == stored:
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "session_version": version})}
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"ok": False})}

    # POST ?action=update — сменить пароль + инкремент версии сессии
    if method == "POST" and action == "update":
        body = json.loads(event.get("body") or "{}")
        new_password = body.get("password", "").strip()

        if not new_password:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "password required"})}

        conn = get_db()
        cur = conn.cursor()
        set_setting(cur, schema, "catalog_password", new_password)

        # Инкрементируем версию сессии — все старые куки станут невалидными
        old_version = get_setting(cur, schema, "session_version", "1")
        new_version = str(int(old_version) + 1)
        set_setting(cur, schema, "session_version", new_version)

        conn.commit()
        conn.close()

        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "session_version": new_version})}

    # GET — получить пароль и версию сессии
    if method == "GET":
        conn = get_db()
        cur = conn.cursor()
        password = get_setting(cur, schema, "catalog_password", "2024")
        version = get_setting(cur, schema, "session_version", "1")
        conn.close()

        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"password": password, "session_version": version})}

    return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "method not allowed"})}
