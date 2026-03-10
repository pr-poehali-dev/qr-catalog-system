import json
import os
import psycopg2


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def handler(event, context):
    """Получение истории платежей пользователя с фильтрацией по типу (deposit/withdrawal/all)"""
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
                "Access-Control-Max-Age": "86400",
            },
            "body": "",
        }

    cors = {"Access-Control-Allow-Origin": "*"}

    if event.get("httpMethod") != "GET":
        return {"statusCode": 405, "headers": cors, "body": json.dumps({"error": "Method not allowed"})}

    qs = event.get("queryStringParameters") or {}
    user_id = str(qs.get("user_id", "")).strip()
    filter_type = str(qs.get("type", "all")).strip()

    if not user_id:
        return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Не указан пользователь"})}

    conn = get_db()
    try:
        cur = conn.cursor()
        if filter_type == "deposits":
            cur.execute(
                "SELECT id, amount, status, type, created_at, paid_at FROM payments WHERE user_id = %s AND type = 'deposit' ORDER BY created_at DESC LIMIT 100",
                (user_id,)
            )
        elif filter_type == "withdrawals":
            cur.execute(
                "SELECT id, amount, status, type, created_at, paid_at FROM payments WHERE user_id = %s AND type = 'withdrawal' ORDER BY created_at DESC LIMIT 100",
                (user_id,)
            )
        else:
            cur.execute(
                "SELECT id, amount, status, type, created_at, paid_at FROM payments WHERE user_id = %s ORDER BY created_at DESC LIMIT 100",
                (user_id,)
            )
        rows = cur.fetchall()
    finally:
        conn.close()

    payments = []
    for row in rows:
        pid, amount, status, ptype, created_at, paid_at = row
        payments.append({
            "id": pid,
            "amount": float(amount),
            "status": status,
            "type": ptype,
            "created_at": created_at.isoformat() if created_at else None,
            "paid_at": paid_at.isoformat() if paid_at else None,
        })

    return {
        "statusCode": 200,
        "headers": cors,
        "body": json.dumps({"payments": payments}),
    }
