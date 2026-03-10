import json
import os
import psycopg2


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def handler(event, context):
    """Списание/начисление баланса + настройки игр"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    if event.get("httpMethod") == "GET":
        qs = event.get("queryStringParameters") or {}
        game = qs.get("game", "mines")
        conn = get_db()
        try:
            cur = conn.cursor()
            cur.execute("SELECT win_chance FROM game_settings WHERE game_name = %s", (game,))
            row = cur.fetchone()
            win_chance = row[0] if row else 50
        finally:
            conn.close()
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"win_chance": win_chance})}

    if event.get("httpMethod") != "POST":
        return {"statusCode": 405, "headers": CORS, "body": json.dumps({"error": "Method not allowed"})}

    body = json.loads(event.get("body") or "{}")
    user_id = str(body.get("user_id", "")).strip()
    action = body.get("action", "")
    amount = body.get("amount", 0)
    currency = body.get("currency", "usdt")

    if not user_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "user_id required"})}
    if action not in ("bet", "win"):
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "action must be bet or win"})}
    if not amount or float(amount) <= 0:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "amount must be > 0"})}

    amount = float(amount)
    is_stars = currency == "stars"
    table = "user_stars_balances" if is_stars else "user_balances"

    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("SELECT balance FROM %s WHERE user_id = '%s'" % (table, user_id.replace("'", "''")))
        row = cur.fetchone()
        current = float(row[0]) if row else 0.0

        if action == "bet":
            if current < amount:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Недостаточно средств", "balance": current})}
            if is_stars:
                cur.execute(
                    "UPDATE user_stars_balances SET balance = balance - %s, updated_at = NOW() WHERE user_id = %s",
                    (int(amount), user_id),
                )
            else:
                cur.execute(
                    "UPDATE user_balances SET balance = balance - %s, updated_at = NOW() WHERE user_id = %s",
                    (amount, user_id),
                )
        elif action == "win":
            if is_stars:
                cur.execute(
                    """INSERT INTO user_stars_balances (user_id, balance, updated_at) VALUES (%s, %s, NOW())
                       ON CONFLICT (user_id) DO UPDATE SET balance = user_stars_balances.balance + %s, updated_at = NOW()""",
                    (user_id, int(amount), int(amount)),
                )
            else:
                cur.execute(
                    """INSERT INTO user_balances (user_id, balance, updated_at) VALUES (%s, %s, NOW())
                       ON CONFLICT (user_id) DO UPDATE SET balance = user_balances.balance + %s, updated_at = NOW()""",
                    (user_id, amount, amount),
                )

        conn.commit()

        cur.execute("SELECT balance FROM %s WHERE user_id = '%s'" % (table, user_id.replace("'", "''")))
        row = cur.fetchone()
        new_balance = float(row[0]) if row else 0.0

    finally:
        conn.close()

    return {
        "statusCode": 200,
        "headers": CORS,
        "body": json.dumps({"ok": True, "balance": new_balance}),
    }