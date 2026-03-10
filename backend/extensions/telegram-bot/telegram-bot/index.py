"""
Telegram Bot — Jaguar Casino

Обрабатывает:
1. Webhook от Telegram (команды, платежи Stars)
2. Отправку уведомлений через API
3. Оплату через Telegram Stars с начислением баланса
"""

import json
import os
import psycopg2
import telebot


def get_bot_token() -> str:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        raise ValueError("TELEGRAM_BOT_TOKEN not configured")
    return token


def get_bot() -> telebot.TeleBot:
    return telebot.TeleBot(get_bot_token())


def get_default_chat_id() -> str:
    return os.environ.get("TELEGRAM_CHAT_ID", "")


def get_db_connection():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_cors_headers() -> dict:
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Telegram-Bot-Api-Secret-Token",
    }


def cors_response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**get_cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def options_response() -> dict:
    return {"statusCode": 204, "headers": get_cors_headers(), "body": ""}


STARS_RATE = 0.02


def stars_to_usdt(stars: int) -> float:
    return round(stars * STARS_RATE, 2)


def handle_start(chat_id: int, args: str = "") -> None:
    """Обработка /start с параметрами."""
    bot = get_bot()

    if args.startswith("stars_"):
        parts = args.split("_")
        if len(parts) == 3:
            try:
                amount_stars = int(parts[1])
                user_id = parts[2]
            except (ValueError, IndexError):
                bot.send_message(chat_id, "Неверная ссылка для оплаты. Попробуйте ещё раз через приложение.")
                return

            if amount_stars < 10 or amount_stars > 10000:
                bot.send_message(chat_id, "Сумма должна быть от 10 до 10000 звёзд.")
                return

            usdt_amount = stars_to_usdt(amount_stars)

            prices = [telebot.types.LabeledPrice(
                label=f"Пополнение {usdt_amount} USDT",
                amount=amount_stars
            )]

            bot.send_invoice(
                chat_id=chat_id,
                title="Пополнение баланса Jaguar Casino",
                description=f"Вы получите {usdt_amount} USDT на баланс за {amount_stars} звёзд",
                invoice_payload=json.dumps({"user_id": user_id, "stars": amount_stars, "usdt": usdt_amount}),
                provider_token="",
                currency="XTR",
                prices=prices,
            )
            return

    site_url = os.environ.get("SITE_URL", "").rstrip("/")
    markup = telebot.types.InlineKeyboardMarkup()
    markup.add(
        telebot.types.InlineKeyboardButton(
            "🎰 Открыть Jaguar Casino",
            web_app=telebot.types.WebAppInfo(url=site_url)
        )
    )
    bot.send_message(
        chat_id,
        "Добро пожаловать в Jaguar Casino! 🐆\n\nНажмите кнопку ниже, чтобы открыть приложение.",
        reply_markup=markup
    )


def handle_pre_checkout(pre_checkout_query_id: str) -> None:
    """Подтверждаем pre_checkout_query — обязательный шаг для Telegram Stars."""
    bot = get_bot()
    bot.answer_pre_checkout_query(pre_checkout_query_id, ok=True)


def handle_successful_payment(message: dict) -> None:
    """Обработка успешного платежа Stars — начисляем баланс."""
    payment = message.get("successful_payment", {})
    payload_str = payment.get("invoice_payload", "{}")
    total_amount = payment.get("total_amount", 0)
    telegram_payment_charge_id = payment.get("telegram_payment_charge_id", "")

    chat_id = message.get("chat", {}).get("id")
    from_user = message.get("from", {})

    try:
        payload = json.loads(payload_str)
    except json.JSONDecodeError:
        print(f"[STARS] Invalid payload: {payload_str}")
        return

    user_id = str(payload.get("user_id", ""))
    usdt_amount = float(payload.get("usdt", 0))
    stars_amount = int(payload.get("stars", 0))

    if not user_id or stars_amount <= 0:
        print(f"[STARS] Invalid payment data: user_id={user_id}, stars={stars_amount}")
        return

    print(f"[STARS] Processing payment: user={user_id}, stars={stars_amount}, charge_id={telegram_payment_charge_id}")

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """INSERT INTO payments (user_id, invoice_id, amount, status, type, pay_url, created_at, paid_at)
               VALUES (%s, %s, %s, 'paid', 'stars', '', NOW(), NOW())""",
            (user_id, abs(hash(telegram_payment_charge_id)) % 2147483647, stars_amount)
        )

        cur.execute(
            """INSERT INTO user_stars_balances (user_id, balance, updated_at)
               VALUES (%s, %s, NOW())
               ON CONFLICT (user_id) DO UPDATE SET balance = user_stars_balances.balance + %s, updated_at = NOW()""",
            (user_id, stars_amount, stars_amount)
        )

        conn.commit()
        print(f"[STARS] Stars credited: user={user_id}, +{stars_amount} stars")

        bot = get_bot()
        bot.send_message(
            chat_id,
            f"✅ Оплата прошла успешно!\n\n"
            f"⭐ Начислено: {stars_amount} звёзд\n\n"
            f"Баланс обновлён. Возвращайтесь в приложение!"
        )

        site_url = os.environ.get("SITE_URL", "").rstrip("/")
        if site_url:
            markup = telebot.types.InlineKeyboardMarkup()
            markup.add(
                telebot.types.InlineKeyboardButton(
                    "🎰 Открыть Jaguar Casino",
                    web_app=telebot.types.WebAppInfo(url=site_url)
                )
            )
            bot.send_message(chat_id, "Нажмите, чтобы вернуться:", reply_markup=markup)

    except Exception as e:
        print(f"[STARS] DB error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()


def process_webhook(body: dict) -> dict:
    """Обработка webhook от Telegram."""

    if "pre_checkout_query" in body:
        pcq = body["pre_checkout_query"]
        print(f"[STARS] pre_checkout_query: {pcq.get('id')}")
        handle_pre_checkout(pcq["id"])
        return {"statusCode": 200, "body": json.dumps({"ok": True})}

    message = body.get("message")
    if not message:
        return {"statusCode": 200, "body": json.dumps({"ok": True})}

    if "successful_payment" in message:
        print(f"[STARS] successful_payment received")
        handle_successful_payment(message)
        return {"statusCode": 200, "body": json.dumps({"ok": True})}

    text = message.get("text", "")
    chat_id = message.get("chat", {}).get("id")

    if not chat_id:
        return {"statusCode": 200, "body": json.dumps({"ok": True})}

    try:
        if text.startswith("/start"):
            args = text[7:].strip() if len(text) > 6 else ""
            handle_start(chat_id, args)
    except telebot.apihelper.ApiTelegramException as e:
        print(f"Telegram API error: {e}")
    except Exception as e:
        print(f"Error processing webhook: {e}")

    return {"statusCode": 200, "body": json.dumps({"ok": True})}


def handle_send(body: dict) -> dict:
    text = body.get("text", "").strip()
    chat_id = body.get("chat_id") or get_default_chat_id()
    parse_mode = body.get("parse_mode", "HTML")
    silent = body.get("silent", False)

    if not text:
        return cors_response(400, {"error": "text is required"})
    if not chat_id:
        return cors_response(400, {"error": "chat_id is required"})
    if len(text) > 4096:
        return cors_response(400, {"error": "Message too long (max 4096 characters)"})

    try:
        bot = get_bot()
        result = bot.send_message(
            chat_id=chat_id, text=text, parse_mode=parse_mode,
            disable_notification=silent, disable_web_page_preview=True,
        )
        return cors_response(200, {"success": True, "message_id": result.message_id})
    except telebot.apihelper.ApiTelegramException as e:
        return cors_response(400, {"error": e.description, "error_code": e.error_code})
    except Exception as e:
        return cors_response(500, {"error": str(e)})


def handle_send_photo(body: dict) -> dict:
    photo_url = body.get("photo_url", "").strip()
    caption = body.get("caption", "").strip()
    chat_id = body.get("chat_id") or get_default_chat_id()
    parse_mode = body.get("parse_mode", "HTML")

    if not photo_url:
        return cors_response(400, {"error": "photo_url is required"})
    if not chat_id:
        return cors_response(400, {"error": "chat_id is required"})

    try:
        bot = get_bot()
        result = bot.send_photo(
            chat_id=chat_id, photo=photo_url,
            caption=caption if caption else None, parse_mode=parse_mode,
        )
        return cors_response(200, {"success": True, "message_id": result.message_id})
    except telebot.apihelper.ApiTelegramException as e:
        return cors_response(400, {"error": e.description, "error_code": e.error_code})
    except Exception as e:
        return cors_response(500, {"error": str(e)})


def handle_set_webhook() -> dict:
    webhook_url = "https://functions.poehali.dev/aee94186-9c12-42ba-9e6b-dd15aed466f9"
    webhook_secret = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")

    bot = get_bot()
    bot.remove_webhook()
    result = bot.set_webhook(
        url=webhook_url,
        secret_token=webhook_secret if webhook_secret else None,
    )

    return cors_response(200, {"success": result, "webhook_url": webhook_url})


def handler(event: dict, context) -> dict:
    """Обработка запросов к Telegram-боту."""
    method = event.get("httpMethod", "POST")

    if method == "OPTIONS":
        return options_response()

    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    if action:
        body = {}
        if method == "POST":
            raw_body = event.get("body", "{}")
            try:
                body = json.loads(raw_body) if raw_body else {}
            except json.JSONDecodeError:
                return cors_response(400, {"error": "Invalid JSON"})

        if action == "send" and method == "POST":
            return handle_send(body)
        elif action == "send-photo" and method == "POST":
            return handle_send_photo(body)
        elif action == "set-webhook" and method == "POST":
            return handle_set_webhook()
        else:
            return cors_response(400, {"error": f"Unknown action: {action}"})

    headers = event.get("headers", {})
    headers_lower = {k.lower(): v for k, v in headers.items()}
    webhook_secret = os.environ.get("TELEGRAM_WEBHOOK_SECRET")

    if webhook_secret:
        request_secret = headers_lower.get("x-telegram-bot-api-secret-token", "")
        if request_secret != webhook_secret:
            return {"statusCode": 401, "body": json.dumps({"error": "Unauthorized"})}

    raw_body = event.get("body", "{}")
    print(f"[WEBHOOK] Body: {raw_body[:500]}")
    body = json.loads(raw_body)
    return process_webhook(body)