import json
import os
import psycopg2


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


CORS = {"Access-Control-Allow-Origin": "*"}

ROLE_OWNER = 0
ROLE_CHIEF = 1
ROLE_ADMIN = 2
ROLE_TECH = 3

OWNER_DISPLAY_ID = 4003134

ROLE_NAMES = {0: "Владелец", 1: "Гл.Администратор", 2: "Администратор", 3: "Тех.Специалист"}


def handler(event, context):
    """Админ-панель: роли, управление игроками и админами"""
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

    actions = {
        "check": lambda: handle_check(qs),
        "check_block": lambda: handle_check_block(qs),
        "players": lambda: handle_players(qs),
        "block": lambda: handle_block(event),
        "unblock": lambda: handle_unblock(event),
        "set_balance": lambda: handle_set_balance(event),
        "stats": lambda: handle_stats(qs),
        "list_admins": lambda: handle_list_admins(qs),
        "add_admin": lambda: handle_add_admin(event),
        "remove_admin": lambda: handle_remove_admin(event),
        "change_role": lambda: handle_change_role(event),
        "get_game_settings": lambda: handle_get_game_settings(qs),
        "set_game_settings": lambda: handle_set_game_settings(event),
        "force_crash": lambda: handle_force_crash(event),
    }

    if action in actions:
        return actions[action]()
    return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}


def get_admin_role(display_id):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT role FROM admin_users WHERE display_id = %s", (int(display_id),))
        row = cur.fetchone()
        return row[0] if row else None
    finally:
        conn.close()


def verify_admin(display_id):
    return get_admin_role(display_id) is not None


def require_role(admin_id, max_role):
    role = get_admin_role(admin_id)
    if role is None:
        return None, {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Нет доступа"})}
    if role > max_role:
        return None, {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Недостаточно прав"})}
    return role, None


def handle_check(qs):
    display_id = qs.get("display_id", "")
    if not display_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"is_admin": False, "role": None})}
    role = get_admin_role(display_id)
    return {
        "statusCode": 200,
        "headers": CORS,
        "body": json.dumps({
            "is_admin": role is not None,
            "role": role,
            "role_name": ROLE_NAMES.get(role, "") if role is not None else "",
        }),
    }


def handle_check_block(qs):
    user_id = qs.get("user_id", "")
    if not user_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "user_id обязателен"})}
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT is_blocked, block_reason FROM users WHERE id = %s", (int(user_id),))
        row = cur.fetchone()
        if not row:
            return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Пользователь не найден"})}
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"is_blocked": row[0], "block_reason": row[1] or ""})}
    finally:
        conn.close()


def handle_stats(qs):
    admin_id = qs.get("admin_id", "")
    _, err = require_role(admin_id, ROLE_TECH)
    if err:
        return err

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM users")
        total_users = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM users WHERE is_blocked = true")
        blocked_users = cur.fetchone()[0]
        cur.execute("SELECT COALESCE(SUM(balance), 0) FROM user_balances")
        total_balance = float(cur.fetchone()[0])
        cur.execute("SELECT COUNT(*) FROM payments WHERE status = 'paid'")
        total_payments = cur.fetchone()[0]
    finally:
        conn.close()

    return {
        "statusCode": 200,
        "headers": CORS,
        "body": json.dumps({
            "total_users": total_users,
            "blocked_users": blocked_users,
            "total_balance": total_balance,
            "total_payments": total_payments,
        }),
    }


def handle_players(qs):
    admin_id = qs.get("admin_id", "")
    _, err = require_role(admin_id, ROLE_ADMIN)
    if err:
        return err

    search = qs.get("search", "").strip()
    conn = get_db()
    try:
        cur = conn.cursor()
        if search:
            cur.execute(
                """SELECT u.id, u.display_id, u.name, u.telegram_id, u.is_blocked, u.created_at,
                          COALESCE(b.balance, 0) as balance, u.block_reason
                   FROM users u
                   LEFT JOIN user_balances b ON b.user_id = CAST(u.id AS TEXT)
                   WHERE CAST(u.display_id AS TEXT) LIKE %s
                      OR LOWER(u.name) LIKE %s
                      OR u.telegram_id LIKE %s
                   ORDER BY u.created_at DESC
                   LIMIT 100""",
                (f"%{search}%", f"%{search.lower()}%", f"%{search}%"),
            )
        else:
            cur.execute(
                """SELECT u.id, u.display_id, u.name, u.telegram_id, u.is_blocked, u.created_at,
                          COALESCE(b.balance, 0) as balance, u.block_reason
                   FROM users u
                   LEFT JOIN user_balances b ON b.user_id = CAST(u.id AS TEXT)
                   ORDER BY u.created_at DESC
                   LIMIT 100"""
            )
        rows = cur.fetchall()
        players = []
        for r in rows:
            players.append({
                "id": r[0],
                "display_id": r[1],
                "name": r[2] or "",
                "telegram_id": r[3] or "",
                "is_blocked": r[4],
                "created_at": r[5].isoformat() if r[5] else None,
                "balance": float(r[6]),
                "block_reason": r[7] or "",
            })
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"players": players})}


def handle_block(event):
    body = json.loads(event.get("body") or "{}")
    admin_id = body.get("admin_id", "")
    user_id = body.get("user_id", "")
    reason = body.get("reason", "").strip()
    _, err = require_role(admin_id, ROLE_ADMIN)
    if err:
        return err
    if not user_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "user_id обязателен"})}
    if not reason:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Укажите причину блокировки"})}

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE users SET is_blocked = true, block_reason = %s WHERE id = %s", (reason, int(user_id)))
        conn.commit()
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}


def handle_unblock(event):
    body = json.loads(event.get("body") or "{}")
    admin_id = body.get("admin_id", "")
    user_id = body.get("user_id", "")
    _, err = require_role(admin_id, ROLE_ADMIN)
    if err:
        return err
    if not user_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "user_id обязателен"})}

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE users SET is_blocked = false, block_reason = NULL WHERE id = %s", (int(user_id),))
        conn.commit()
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}


def handle_set_balance(event):
    body = json.loads(event.get("body") or "{}")
    admin_id = body.get("admin_id", "")
    user_id = body.get("user_id", "")
    new_balance = body.get("balance")
    _, err = require_role(admin_id, ROLE_ADMIN)
    if err:
        return err
    if not user_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "user_id обязателен"})}
    if new_balance is None:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "balance обязателен"})}

    new_balance = float(new_balance)
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO user_balances (user_id, balance, updated_at)
               VALUES (%s, %s, NOW())
               ON CONFLICT (user_id) DO UPDATE SET balance = %s, updated_at = NOW()""",
            (str(user_id), new_balance, new_balance),
        )
        conn.commit()
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "balance": new_balance})}


def handle_list_admins(qs):
    admin_id = qs.get("admin_id", "")
    _, err = require_role(admin_id, ROLE_ADMIN)
    if err:
        return err

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT a.id, a.display_id, a.role, a.created_at, a.name,
                      u.name as user_name, u.telegram_id
               FROM admin_users a
               LEFT JOIN users u ON u.display_id = a.display_id
               ORDER BY a.role ASC, a.created_at ASC"""
        )
        rows = cur.fetchall()
        admins = []
        for r in rows:
            admins.append({
                "id": r[0],
                "display_id": r[1],
                "role": r[2],
                "role_name": ROLE_NAMES.get(r[2], ""),
                "created_at": r[3].isoformat() if r[3] else None,
                "custom_name": r[4] or "",
                "user_name": r[5] or "",
                "telegram_id": r[6] or "",
            })
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"admins": admins})}


def handle_add_admin(event):
    body = json.loads(event.get("body") or "{}")
    admin_id = body.get("admin_id", "")
    caller_role, err = require_role(admin_id, ROLE_CHIEF)
    if err:
        return err

    target_display_id = body.get("display_id")
    target_role = body.get("role", ROLE_ADMIN)
    if not target_display_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "display_id обязателен"})}

    target_role = int(target_role)
    if target_role == ROLE_OWNER:
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Роль Владелец нельзя назначить"})}
    if target_role < ROLE_CHIEF or target_role > ROLE_TECH:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Неверная роль"})}

    if caller_role == ROLE_OWNER:
        pass
    elif caller_role == ROLE_CHIEF and target_role == ROLE_CHIEF:
        pass
    elif caller_role >= target_role:
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Нельзя назначить роль выше или равную своей"})}

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE display_id = %s", (int(target_display_id),))
        user_row = cur.fetchone()
        if not user_row:
            return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Пользователь с таким ID не найден"})}

        cur.execute("SELECT id FROM admin_users WHERE display_id = %s", (int(target_display_id),))
        if cur.fetchone():
            return {"statusCode": 409, "headers": CORS, "body": json.dumps({"error": "Этот пользователь уже админ"})}

        cur.execute(
            "INSERT INTO admin_users (display_id, role) VALUES (%s, %s)",
            (int(target_display_id), target_role),
        )
        conn.commit()
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}


def handle_remove_admin(event):
    body = json.loads(event.get("body") or "{}")
    admin_id = body.get("admin_id", "")
    caller_role, err = require_role(admin_id, ROLE_CHIEF)
    if err:
        return err

    target_display_id = body.get("display_id")
    if not target_display_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "display_id обязателен"})}

    target_role = get_admin_role(int(target_display_id))
    if target_role is None:
        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Админ не найден"})}

    if target_role == ROLE_OWNER:
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Владельца нельзя удалить"})}

    if caller_role != ROLE_OWNER and target_role <= caller_role:
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Нельзя удалить админа с ролью выше или равной своей"})}

    if str(target_display_id) == str(admin_id):
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нельзя удалить самого себя"})}

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM admin_users WHERE display_id = %s", (int(target_display_id),))
        conn.commit()
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}


def handle_change_role(event):
    body = json.loads(event.get("body") or "{}")
    admin_id = body.get("admin_id", "")
    caller_role, err = require_role(admin_id, ROLE_CHIEF)
    if err:
        return err

    target_display_id = body.get("display_id")
    new_role = body.get("role")
    if not target_display_id or new_role is None:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "display_id и role обязательны"})}

    new_role = int(new_role)
    if new_role == ROLE_OWNER:
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Роль Владелец нельзя назначить"})}
    if new_role < ROLE_CHIEF or new_role > ROLE_TECH:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Неверная роль"})}

    target_current_role = get_admin_role(int(target_display_id))
    if target_current_role == ROLE_OWNER:
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Роль Владельца нельзя изменить"})}

    if str(target_display_id) == str(admin_id):
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нельзя менять свою роль"})}

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE admin_users SET role = %s WHERE display_id = %s", (new_role, int(target_display_id)))
        conn.commit()
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}


def handle_get_game_settings(qs):
    admin_id = qs.get("admin_id", "")
    _, err = require_role(admin_id, ROLE_ADMIN)
    if err:
        return err

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT game_name, win_chance, updated_at FROM game_settings ORDER BY game_name")
        rows = cur.fetchall()
        games = []
        for r in rows:
            games.append({
                "game_name": r[0],
                "win_chance": r[1],
                "updated_at": r[2].isoformat() if r[2] else None,
            })
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"games": games})}


def handle_set_game_settings(event):
    body = json.loads(event.get("body") or "{}")
    admin_id = body.get("admin_id", "")
    _, err = require_role(admin_id, ROLE_ADMIN)
    if err:
        return err

    game_name = body.get("game_name", "")
    win_chance = body.get("win_chance")
    if not game_name or win_chance is None:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "game_name и win_chance обязательны"})}

    win_chance = int(win_chance)
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO game_settings (game_name, win_chance, updated_at)
               VALUES (%s, %s, NOW())
               ON CONFLICT (game_name) DO UPDATE SET win_chance = %s, updated_at = NOW()""",
            (game_name, win_chance, win_chance),
        )
        conn.commit()
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "game_settings_updated": win_chance})}


def handle_force_crash(event):
    body = json.loads(event.get("body") or "{}")
    admin_id = body.get("admin_id", "")
    _, err = require_role(admin_id, ROLE_ADMIN)
    if err:
        return err

    crash_at = body.get("crash_at")
    if not crash_at or float(crash_at) < 1.01:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "crash_at должен быть >= 1.01"})}

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE crash_game_state SET force_crash = %s WHERE id = 1", (float(crash_at),))
        conn.commit()
    finally:
        conn.close()

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "force_crash_set": float(crash_at)})}