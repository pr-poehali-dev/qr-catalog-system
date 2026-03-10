"""
Telegram Auth Extension - Backend Function

Authentication via Telegram bot with temporary token approach.
Flow:
1. User clicks "Login via Telegram" -> redirect to bot
2. Bot generates unique auth link and sends to user
3. User clicks link -> frontend exchanges token for JWT
4. Refresh tokens stored hashed (SHA256) in DB
"""

import json
import os
import hashlib
import hmac
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from urllib.parse import parse_qs, unquote
import psycopg2
import jwt


# =============================================================================
# CONFIGURATION
# =============================================================================

def get_db_connection():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_schema() -> str:
    """Get database schema prefix."""
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    return f"{schema}." if schema else ""


def get_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise ValueError(f"Missing environment variable: {key}")
    return value


# =============================================================================
# SECURITY HELPERS
# =============================================================================

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def generate_token(length: int = 32) -> str:
    return secrets.token_urlsafe(length)


def create_jwt(user_id: int, secret: str, expires_in: int = 900) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


# =============================================================================
# DATABASE OPERATIONS
# =============================================================================

def get_auth_token(cursor, token: str) -> Optional[dict]:
    """Get auth token data by token."""
    token_hash = hash_token(token)
    schema = get_schema()

    cursor.execute(f"""
        SELECT telegram_id, telegram_username, telegram_first_name,
               telegram_last_name, telegram_photo_url, expires_at, used
        FROM {schema}telegram_auth_tokens
        WHERE token_hash = %s
    """, (token_hash,))

    row = cursor.fetchone()
    if not row:
        return None

    return {
        "telegram_id": row[0],
        "telegram_username": row[1],
        "telegram_first_name": row[2],
        "telegram_last_name": row[3],
        "telegram_photo_url": row[4],
        "expires_at": row[5],
        "used": row[6],
    }


def mark_token_used(cursor, token: str) -> bool:
    """Mark token as used."""
    token_hash = hash_token(token)
    schema = get_schema()

    cursor.execute(f"""
        UPDATE {schema}telegram_auth_tokens
        SET used = TRUE
        WHERE token_hash = %s AND used = FALSE
        RETURNING id
    """, (token_hash,))

    return cursor.fetchone() is not None


def cleanup_expired_tokens(cursor) -> None:
    """Remove expired auth tokens."""
    schema = get_schema()
    cursor.execute(f"""
        DELETE FROM {schema}telegram_auth_tokens
        WHERE expires_at < NOW() OR (used = TRUE AND created_at < NOW() - INTERVAL '1 hour')
    """)


def find_user_by_telegram_id(cursor, telegram_id: str) -> Optional[dict]:
    """Find user by Telegram ID."""
    schema = get_schema()
    cursor.execute(f"""
        SELECT id, email, name, avatar_url, telegram_id, display_id, is_blocked, block_reason
        FROM {schema}users
        WHERE telegram_id = %s
    """, (telegram_id,))

    row = cursor.fetchone()
    if row:
        return {
            "id": row[0],
            "email": row[1],
            "name": row[2],
            "avatar_url": row[3],
            "telegram_id": row[4],
            "display_id": row[5],
            "is_blocked": row[6],
            "block_reason": row[7],
        }
    return None


def create_or_update_user(
    cursor,
    telegram_id: str,
    username: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    photo_url: Optional[str]
) -> dict:
    """Create new user or update existing one."""
    schema = get_schema()

    # Build display name
    name_parts = []
    if first_name:
        name_parts.append(first_name)
    if last_name:
        name_parts.append(last_name)
    display_name = " ".join(name_parts) if name_parts else username or f"User {telegram_id}"

    # Check if user exists
    existing = find_user_by_telegram_id(cursor, telegram_id)

    if existing:
        # Update existing user
        cursor.execute(f"""
            UPDATE {schema}users
            SET name = COALESCE(%s, name),
                avatar_url = COALESCE(%s, avatar_url),
                last_login_at = NOW(),
                updated_at = NOW()
            WHERE telegram_id = %s
            RETURNING id, email, name, avatar_url, telegram_id, display_id, is_blocked, block_reason
        """, (display_name, photo_url, telegram_id))
    else:
        # Create new user
        cursor.execute(f"""
            INSERT INTO {schema}users (telegram_id, name, avatar_url, email_verified, password_hash, created_at, updated_at, last_login_at)
            VALUES (%s, %s, %s, TRUE, '', NOW(), NOW(), NOW())
            RETURNING id, email, name, avatar_url, telegram_id, display_id, is_blocked, block_reason
        """, (telegram_id, display_name, photo_url))

    row = cursor.fetchone()
    return {
        "id": row[0],
        "email": row[1],
        "name": row[2],
        "avatar_url": row[3],
        "telegram_id": row[4],
        "display_id": row[5],
        "is_blocked": row[6],
        "block_reason": row[7],
    }


def save_refresh_token(cursor, user_id: int, token_hash: str, expires_at: datetime) -> None:
    """Save hashed refresh token to DB."""
    schema = get_schema()
    cursor.execute(f"""
        INSERT INTO {schema}refresh_tokens (user_id, token_hash, expires_at)
        VALUES (%s, %s, %s)
    """, (user_id, token_hash, expires_at))


def find_refresh_token(cursor, token_hash: str) -> Optional[dict]:
    """Find refresh token by hash."""
    schema = get_schema()
    cursor.execute(f"""
        SELECT user_id, expires_at
        FROM {schema}refresh_tokens
        WHERE token_hash = %s AND expires_at > NOW()
    """, (token_hash,))

    row = cursor.fetchone()
    if row:
        return {"user_id": row[0], "expires_at": row[1]}
    return None


def delete_refresh_token(cursor, token_hash: str) -> None:
    """Delete refresh token."""
    schema = get_schema()
    cursor.execute(f"DELETE FROM {schema}refresh_tokens WHERE token_hash = %s", (token_hash,))


def get_user_by_id(cursor, user_id: int) -> Optional[dict]:
    """Get user by ID."""
    schema = get_schema()
    cursor.execute(f"""
        SELECT id, email, name, avatar_url, telegram_id, display_id, is_blocked, block_reason
        FROM {schema}users WHERE id = %s
    """, (user_id,))

    row = cursor.fetchone()
    if row:
        return {
            "id": row[0],
            "email": row[1],
            "name": row[2],
            "avatar_url": row[3],
            "telegram_id": row[4],
            "display_id": row[5],
            "is_blocked": row[6],
            "block_reason": row[7],
        }
    return None


def cleanup_expired_refresh_tokens(cursor) -> None:
    """Remove expired refresh tokens."""
    schema = get_schema()
    cursor.execute(f"DELETE FROM {schema}refresh_tokens WHERE expires_at < NOW()")


# =============================================================================
# CORS HELPERS
# =============================================================================

def get_cors_headers() -> dict:
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*")
    return {
        "Access-Control-Allow-Origin": allowed_origins,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def cors_response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {**get_cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def options_response() -> dict:
    return {
        "statusCode": 204,
        "headers": get_cors_headers(),
        "body": "",
    }


# =============================================================================
# ACTION HANDLERS
# =============================================================================

def handle_callback(cursor, body: dict) -> dict:
    """
    POST ?action=callback
    Frontend calls this with token to exchange for JWT.
    Like standard OAuth callback.
    """
    token = body.get("token")
    if not token:
        return cors_response(400, {"error": "Missing token"})

    token_data = get_auth_token(cursor, token)

    if not token_data:
        return cors_response(404, {"error": "Token not found"})

    # Check if expired (handle both naive and aware datetime from DB)
    expires_at = token_data["expires_at"]
    now = datetime.now(timezone.utc)
    # Convert to naive UTC for comparison if needed
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        return cors_response(410, {"error": "Token expired"})

    # Check if already used
    if token_data["used"]:
        return cors_response(410, {"error": "Token already used"})

    # Check if user data exists
    if not token_data["telegram_id"]:
        return cors_response(400, {"error": "Token not authenticated"})

    # Get JWT secret
    jwt_secret = get_env("JWT_SECRET")
    if len(jwt_secret) < 32:
        return cors_response(500, {"error": "Server configuration error"})

    # Create or update user
    user = create_or_update_user(
        cursor,
        telegram_id=token_data["telegram_id"],
        username=token_data["telegram_username"],
        first_name=token_data["telegram_first_name"],
        last_name=token_data["telegram_last_name"],
        photo_url=token_data["telegram_photo_url"],
    )

    if user.get("is_blocked"):
        mark_token_used(cursor, token)
        return cors_response(403, {"error": "blocked", "block_reason": user.get("block_reason") or ""})

    # Mark token as used
    mark_token_used(cursor, token)

    # Generate tokens
    access_token = create_jwt(user["id"], jwt_secret)
    refresh_token = generate_token(48)
    refresh_token_hash = hash_token(refresh_token)
    refresh_expires = datetime.now(timezone.utc) + timedelta(days=30)

    save_refresh_token(cursor, user["id"], refresh_token_hash, refresh_expires)

    return cors_response(200, {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": 900,
        "user": user,
    })


def validate_webapp_init_data(init_data: str, bot_token: str) -> Optional[dict]:
    """Validate Telegram WebApp initData signature and return user dict."""
    try:
        parsed = parse_qs(init_data, keep_blank_values=True)
        data_check_string_parts = []
        hash_value = None

        for key, values in sorted(parsed.items()):
            val = values[0]
            if key == "hash":
                hash_value = val
            else:
                data_check_string_parts.append(f"{key}={unquote(val)}")

        if not hash_value:
            return None

        data_check_string = "\n".join(data_check_string_parts)
        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        # hmac.new is correct Python stdlib

        if computed_hash != hash_value:
            return None

        # Parse user from initData
        user_raw = parsed.get("user", [None])[0]
        if not user_raw:
            return None

        return json.loads(unquote(user_raw))
    except Exception:
        return None


def handle_webapp(cursor, body: dict) -> dict:
    """
    POST ?action=webapp
    Authenticate via Telegram Web App initData.
    Called automatically when app opens as Mini App.
    """
    init_data = body.get("init_data", "")
    if not init_data:
        return cors_response(400, {"error": "Missing init_data"})

    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not bot_token:
        return cors_response(500, {"error": "Server configuration error"})

    tg_user = validate_webapp_init_data(init_data, bot_token)
    if not tg_user:
        return cors_response(401, {"error": "Invalid initData signature"})

    jwt_secret = get_env("JWT_SECRET")

    telegram_id = str(tg_user.get("id", ""))
    first_name = tg_user.get("first_name")
    last_name = tg_user.get("last_name")
    username = tg_user.get("username")
    photo_url = tg_user.get("photo_url")

    user = create_or_update_user(
        cursor,
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
        last_name=last_name,
        photo_url=photo_url,
    )

    if user.get("is_blocked"):
        return cors_response(403, {"error": "blocked", "block_reason": user.get("block_reason") or ""})

    access_token = create_jwt(user["id"], jwt_secret)
    refresh_token = generate_token(48)
    refresh_token_hash = hash_token(refresh_token)
    refresh_expires = datetime.now(timezone.utc) + timedelta(days=30)

    save_refresh_token(cursor, user["id"], refresh_token_hash, refresh_expires)

    return cors_response(200, {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": 900,
        "user": user,
    })


def handle_refresh(cursor, body: dict) -> dict:
    """
    POST ?action=refresh
    Refresh access token using refresh token.
    """
    refresh_token = body.get("refresh_token")
    if not refresh_token:
        return cors_response(400, {"error": "Missing refresh_token"})

    jwt_secret = get_env("JWT_SECRET")
    token_hash = hash_token(refresh_token)

    token_data = find_refresh_token(cursor, token_hash)
    if not token_data:
        return cors_response(401, {"error": "Invalid or expired refresh token"})

    user = get_user_by_id(cursor, token_data["user_id"])
    if not user:
        return cors_response(401, {"error": "User not found"})

    if user.get("is_blocked"):
        token_hash_del = hash_token(refresh_token)
        delete_refresh_token(cursor, token_hash_del)
        return cors_response(403, {"error": "blocked", "block_reason": user.get("block_reason") or ""})

    # Generate new access token
    access_token = create_jwt(user["id"], jwt_secret)

    return cors_response(200, {
        "access_token": access_token,
        "expires_in": 900,
        "user": user,
    })


def handle_logout(cursor, body: dict) -> dict:
    """
    POST ?action=logout
    Invalidate refresh token.
    """
    refresh_token = body.get("refresh_token")
    if refresh_token:
        token_hash = hash_token(refresh_token)
        delete_refresh_token(cursor, token_hash)

    return cors_response(200, {"success": True})


# =============================================================================
# MAIN HANDLER
# =============================================================================

def handler(event, context):
    """Main entry point."""
    method = event.get("httpMethod", "GET")

    # Handle CORS preflight
    if method == "OPTIONS":
        return options_response()

    # Parse query params
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    # Parse body for POST requests
    body = {}
    if method == "POST":
        raw_body = event.get("body", "{}")
        try:
            body = json.loads(raw_body) if raw_body else {}
        except json.JSONDecodeError:
            return cors_response(400, {"error": "Invalid JSON"})

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Cleanup expired tokens periodically
        cleanup_expired_tokens(cursor)
        cleanup_expired_refresh_tokens(cursor)

        # Route to action handler
        if action == "callback" and method == "POST":
            response = handle_callback(cursor, body)
        elif action == "webapp" and method == "POST":
            response = handle_webapp(cursor, body)
        elif action == "refresh" and method == "POST":
            response = handle_refresh(cursor, body)
        elif action == "logout" and method == "POST":
            response = handle_logout(cursor, body)
        else:
            response = cors_response(400, {"error": f"Unknown action: {action}"})

        conn.commit()
        return response

    except ValueError as e:
        return cors_response(500, {"error": "Server configuration error"})
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error: {e}")
        return cors_response(500, {"error": "Internal server error"})
    finally:
        if conn:
            conn.close()