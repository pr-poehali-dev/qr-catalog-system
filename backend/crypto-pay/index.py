import json
import os
import urllib.request
import urllib.error
import psycopg2


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def parse_body(event):
    raw_body = event.get("body", "{}")
    if isinstance(raw_body, dict):
        body = raw_body
    else:
        body = json.loads(raw_body or "{}")
    if isinstance(body, str):
        body = json.loads(body)
    return body


def handler(event, context):
    """Создание инвойса CryptoBot и сохранение платежа в БД"""
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
                "Access-Control-Max-Age": "86400",
            },
            "body": "",
        }

    cors = {"Access-Control-Allow-Origin": "*"}

    if event.get("httpMethod") != "POST":
        return {"statusCode": 405, "headers": cors, "body": json.dumps({"error": "Method not allowed"})}

    body = parse_body(event)
    user_id = str(body.get("user_id", "")).strip()
    if not user_id:
        return {"statusCode": 401, "headers": cors, "body": json.dumps({"error": "Не указан пользователь"})}

    amount = body.get("amount")

    if not amount:
        return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Укажите сумму"})}

    try:
        amount = float(amount)
    except (ValueError, TypeError):
        return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Некорректная сумма"})}

    if amount < 5:
        return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Минимальная сумма — 5 USDT"})}
    if amount > 5000:
        return {"statusCode": 400, "headers": cors, "body": json.dumps({"error": "Максимальная сумма — 5000 USDT"})}

    token = os.environ.get("CRYPTOBOT_API_TOKEN", "")
    if not token:
        return {"statusCode": 500, "headers": cors, "body": json.dumps({"error": "Токен CryptoBot не настроен"})}

    payload = json.dumps({
        "currency_type": "crypto",
        "asset": "USDT",
        "amount": str(amount),
        "description": f"Пополнение баланса на {amount} USDT",
        "payload": json.dumps({"user_id": user_id}),
        "expires_in": 3600,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://pay.crypt.bot/api/createInvoice",
        data=payload,
        headers={
            "Crypto-Pay-API-Token": token,
            "Content-Type": "application/json",
            "User-Agent": "JaguarCasino/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"CryptoBot API error: {e.code} {error_body}")
        return {"statusCode": 502, "headers": cors, "body": json.dumps({"error": "Ошибка CryptoBot", "details": error_body})}
    except Exception as e:
        print(f"CryptoBot request error: {str(e)}")
        return {"statusCode": 502, "headers": cors, "body": json.dumps({"error": "Ошибка соединения с CryptoBot"})}

    if not result.get("ok"):
        return {"statusCode": 502, "headers": cors, "body": json.dumps({"error": "Ошибка создания инвойса"})}

    invoice = result["result"]

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO payments (user_id, invoice_id, amount, status, pay_url) VALUES (%s, %s, %s, 'pending', %s)",
            (user_id, invoice["invoice_id"], amount, invoice["pay_url"])
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "statusCode": 200,
        "headers": cors,
        "body": json.dumps({
            "invoice_id": invoice["invoice_id"],
            "pay_url": invoice["pay_url"],
            "amount": invoice["amount"],
            "status": invoice["status"],
        }),
    }