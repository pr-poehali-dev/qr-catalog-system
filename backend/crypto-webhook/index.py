import json
import os
import hashlib
import psycopg2


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def verify_signature(token, body_str, signature):
    """Проверка подписи webhook от CryptoBot"""
    secret = hashlib.sha256(token.encode("utf-8")).digest()
    check = hashlib.sha256(body_str.encode("utf-8")).hexdigest()

    import hmac
    expected = hmac.new(secret, body_str.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def handler(event, context):
    """Webhook для приёма уведомлений об оплате от CryptoBot"""
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Crypto-Pay-API-Signature",
                "Access-Control-Max-Age": "86400",
            },
            "body": "",
        }

    cors = {"Access-Control-Allow-Origin": "*"}

    if event.get("httpMethod") != "POST":
        return {"statusCode": 405, "headers": cors, "body": json.dumps({"error": "Method not allowed"})}

    token = os.environ.get("CRYPTOBOT_API_TOKEN", "")
    if not token:
        return {"statusCode": 500, "headers": cors, "body": json.dumps({"error": "Token not configured"})}

    headers = event.get("headers", {})
    signature = headers.get("Crypto-Pay-API-Signature") or headers.get("crypto-pay-api-signature") or ""

    raw_body = event.get("body", "")
    if isinstance(raw_body, dict):
        body_str = json.dumps(raw_body)
        body = raw_body
    else:
        body_str = raw_body or "{}"
        body = json.loads(body_str)
    if isinstance(body, str):
        body_str = body
        body = json.loads(body)

    if signature and not verify_signature(token, body_str, signature):
        print("Invalid webhook signature")
        return {"statusCode": 403, "headers": cors, "body": json.dumps({"error": "Invalid signature"})}

    update_type = body.get("update_type")
    if update_type != "invoice_paid":
        return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True, "skipped": True})}

    payload = body.get("payload", {})
    invoice_id = payload.get("invoice_id")
    amount = float(payload.get("amount", 0))
    status = payload.get("status", "")

    if not invoice_id or status != "paid":
        return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True, "skipped": True})}

    print(f"Processing payment: invoice_id={invoice_id}, amount={amount}")

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("SELECT user_id, status FROM payments WHERE invoice_id = %s", (invoice_id,))
        row = cur.fetchone()

        if not row:
            print(f"Invoice {invoice_id} not found in DB")
            return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True, "message": "Invoice not found"})}

        user_id, current_status = row

        if current_status == "paid":
            print(f"Invoice {invoice_id} already processed")
            return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True, "message": "Already processed"})}

        cur.execute(
            "UPDATE payments SET status = 'paid', paid_at = NOW() WHERE invoice_id = %s AND status = 'pending'",
            (invoice_id,)
        )

        cur.execute(
            """INSERT INTO user_balances (user_id, balance, updated_at)
               VALUES (%s, %s, NOW())
               ON CONFLICT (user_id) DO UPDATE SET balance = user_balances.balance + %s, updated_at = NOW()""",
            (user_id, amount, amount)
        )

        conn.commit()
        print(f"Balance updated for user {user_id}: +{amount} USDT")

    finally:
        conn.close()

    return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True})}
