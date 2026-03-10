import json
import os
import psycopg2


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


CORS = {"Access-Control-Allow-Origin": "*"}


def handler(event, context):
    """Создание и управление заявками на вывод средств"""
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token, X-Session-Id",
                "Access-Control-Max-Age": "86400",
            },
            "body": "",
        }

    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")

    if action == "create":
        return handle_create(event)
    elif action == "list":
        return handle_list(qs)
    elif action == "approve":
        return handle_approve(event)
    elif action == "reject":
        return handle_reject(event)
    else:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}


def handle_create(event):
    body = json.loads(event.get("body") or "{}")
    user_id = body.get("user_id")
    network = body.get("network", "").strip()
    address = body.get("address", "").strip()
    amount = body.get("amount")
    currency = body.get("currency", "usdt")

    if not user_id or not network or not address or amount is None:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Все поля обязательны"})}

    amount = float(amount)
    is_stars = currency == "stars"

    if is_stars:
        amount = int(amount)
        if amount < 100:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Минимальный вывод — 100 звёзд"})}
    else:
        if amount < 15:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Минимальная сумма вывода — 15 USDT"})}

    conn = get_db()
    try:
        cur = conn.cursor()

        if is_stars:
            cur.execute("SELECT balance FROM user_stars_balances WHERE user_id = %s", (str(user_id),))
            row = cur.fetchone()
            balance = int(row[0]) if row else 0
        else:
            cur.execute("SELECT balance FROM user_balances WHERE user_id = %s", (str(user_id),))
            row = cur.fetchone()
            balance = float(row[0]) if row else 0.0

        if amount > balance:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Недостаточно средств"})}

        cur.execute("SELECT id, display_id, name FROM users WHERE id = %s", (int(user_id),))
        user_row = cur.fetchone()
        if not user_row:
            return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Пользователь не найден"})}

        display_id = user_row[1]
        user_name = user_row[2] or ""

        cur.execute(
            """INSERT INTO withdrawal_requests (user_id, display_id, user_name, network, address, amount, status)
               VALUES (%s, %s, %s, %s, %s, %s, 'pending') RETURNING id""",
            (int(user_id), display_id, user_name, network, address, amount),
        )
        req_id = cur.fetchone()[0]

        if is_stars:
            cur.execute(
                "UPDATE user_stars_balances SET balance = balance - %s, updated_at = NOW() WHERE user_id = %s",
                (int(amount), str(user_id)),
            )
        else:
            cur.execute(
                "UPDATE user_balances SET balance = balance - %s, updated_at = NOW() WHERE user_id = %s",
                (amount, str(user_id)),
            )
        conn.commit()
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "id": req_id})}


def handle_list(qs):
    status_filter = qs.get("status", "all")
    conn = get_db()
    try:
        cur = conn.cursor()
        if status_filter and status_filter != "all":
            cur.execute(
                """SELECT id, user_id, display_id, user_name, network, address, amount, status, created_at, processed_at
                   FROM withdrawal_requests WHERE status = %s ORDER BY created_at DESC LIMIT 200""",
                (status_filter,),
            )
        else:
            cur.execute(
                """SELECT id, user_id, display_id, user_name, network, address, amount, status, created_at, processed_at
                   FROM withdrawal_requests ORDER BY created_at DESC LIMIT 200"""
            )
        rows = cur.fetchall()
        items = []
        for r in rows:
            items.append({
                "id": r[0],
                "user_id": r[1],
                "display_id": r[2],
                "user_name": r[3] or "",
                "network": r[4],
                "address": r[5],
                "amount": float(r[6]),
                "status": r[7],
                "created_at": r[8].isoformat() if r[8] else None,
                "processed_at": r[9].isoformat() if r[9] else None,
            })
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"withdrawals": items})}


def handle_approve(event):
    body = json.loads(event.get("body") or "{}")
    req_id = body.get("withdrawal_id") or body.get("id")
    if not req_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "id обязателен"})}

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT status, user_id, amount, network FROM withdrawal_requests WHERE id = %s", (int(req_id),))
        row = cur.fetchone()
        if not row:
            return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Заявка не найдена"})}
        if row[0] != "pending":
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заявка уже обработана"})}

        user_id = row[1]
        amount = float(row[2])
        network = row[3]

        cur.execute(
            "UPDATE withdrawal_requests SET status = 'approved', processed_at = NOW() WHERE id = %s",
            (int(req_id),),
        )

        w_type = "stars_withdrawal" if network == "TG_STARS" else "withdrawal"
        cur.execute(
            """INSERT INTO payments (user_id, invoice_id, amount, status, type, created_at, paid_at)
               VALUES (%s, %s, %s, 'paid', %s, NOW(), NOW())""",
            (str(user_id), int(req_id), amount, w_type),
        )

        conn.commit()
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}


def handle_reject(event):
    body = json.loads(event.get("body") or "{}")
    req_id = body.get("withdrawal_id") or body.get("id")
    if not req_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "id обязателен"})}

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT status, user_id, amount, network FROM withdrawal_requests WHERE id = %s", (int(req_id),))
        row = cur.fetchone()
        if not row:
            return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Заявка не найдена"})}
        if row[0] != "pending":
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заявка уже обработана"})}

        user_id = row[1]
        amount = float(row[2])
        network = row[3]

        cur.execute(
            "UPDATE withdrawal_requests SET status = 'rejected', processed_at = NOW() WHERE id = %s",
            (int(req_id),),
        )

        if network == "TG_STARS":
            cur.execute(
                """INSERT INTO user_stars_balances (user_id, balance, updated_at) VALUES (%s, %s, NOW())
                   ON CONFLICT (user_id) DO UPDATE SET balance = user_stars_balances.balance + %s, updated_at = NOW()""",
                (str(user_id), int(amount), int(amount)),
            )
        else:
            cur.execute(
                """INSERT INTO user_balances (user_id, balance, updated_at) VALUES (%s, %s, NOW())
                   ON CONFLICT (user_id) DO UPDATE SET balance = user_balances.balance + %s, updated_at = NOW()""",
                (str(user_id), amount, amount),
            )

        w_type = "stars_withdrawal" if network == "TG_STARS" else "withdrawal"
        cur.execute(
            """INSERT INTO payments (user_id, invoice_id, amount, status, type, created_at, paid_at)
               VALUES (%s, %s, %s, 'rejected', %s, NOW(), NOW())""",
            (str(user_id), int(req_id), amount, w_type),
        )

        conn.commit()
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}
