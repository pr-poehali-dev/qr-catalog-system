"""
Unisender Go Extension - Transactional Emails

Отправка транзакционных писем через Unisender Go API.
Подтверждения заказов, сброс пароля, уведомления и т.д.
"""

import json
import os
from datetime import datetime
from typing import Optional

import requests


# =============================================================================
# CONFIGURATION
# =============================================================================

UNISENDER_GO_API_URL = "https://go2.unisender.ru/ru/transactional/api/v1"


def get_api_key() -> str:
    """Get Unisender Go API key."""
    api_key = os.environ.get("UNISENDER_API_KEY", "")
    if not api_key:
        raise ValueError("UNISENDER_API_KEY not configured")
    return api_key


def get_sender_email() -> str:
    """Get default sender email."""
    return os.environ.get("UNISENDER_SENDER_EMAIL", "")


def get_sender_name() -> str:
    """Get default sender name."""
    return os.environ.get("UNISENDER_SENDER_NAME", "")


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
# UNISENDER GO API
# =============================================================================

def send_email(
    to_email: str,
    subject: str,
    body_html: str,
    to_name: Optional[str] = None,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None,
    template_id: Optional[str] = None,
    substitutions: Optional[dict] = None,
    tags: Optional[list] = None,
    track_links: bool = True,
    track_read: bool = True,
) -> dict:
    """
    Send transactional email via Unisender Go.

    Args:
        to_email: Recipient email
        subject: Email subject (supports {{substitutions}})
        body_html: HTML content (supports {{substitutions}})
        to_name: Recipient name
        from_email: Sender email (or use default)
        from_name: Sender name (or use default)
        template_id: Use saved template instead of body_html
        substitutions: Variables for template/body (e.g. {"order_id": "12345"})
        tags: Tags for categorization (max 4)
        track_links: Track link clicks
        track_read: Track email opens
    """
    api_key = get_api_key()
    sender_email = from_email or get_sender_email()
    sender_name = from_name or get_sender_name()

    if not sender_email:
        raise ValueError("Sender email not configured")

    # Build recipient
    recipient = {"email": to_email}
    if to_name:
        recipient["name"] = to_name
    if substitutions:
        recipient["substitutions"] = substitutions

    # Build message
    message = {
        "recipients": [recipient],
        "from_email": sender_email,
        "subject": subject,
        "track_links": 1 if track_links else 0,
        "track_read": 1 if track_read else 0,
    }

    if sender_name:
        message["from_name"] = sender_name

    if template_id:
        message["template_id"] = template_id
    else:
        message["body"] = {"html": body_html}

    if tags:
        message["tags"] = tags[:4]  # Max 4 tags

    # Send request
    try:
        response = requests.post(
            f"{UNISENDER_GO_API_URL}/email/send.json",
            headers={
                "Content-Type": "application/json",
                "X-API-KEY": api_key,
            },
            json={"message": message},
            timeout=30
        )
        return response.json()
    except requests.exceptions.Timeout:
        return {"status": "error", "message": "Unisender API timeout"}
    except requests.exceptions.ConnectionError:
        return {"status": "error", "message": "Unisender API unavailable"}
    except requests.exceptions.RequestException as e:
        return {"status": "error", "message": f"Request failed: {str(e)}"}


# =============================================================================
# ACTION HANDLERS
# =============================================================================

def handle_send(body: dict) -> dict:
    """
    POST ?action=send
    Send transactional email.
    """
    to_email = body.get("to_email", "").strip()
    to_name = body.get("to_name", "").strip()
    subject = body.get("subject", "").strip()
    body_html = body.get("body_html", "").strip()
    template_id = body.get("template_id")
    substitutions = body.get("substitutions", {})
    tags = body.get("tags", [])
    from_email = body.get("from_email")
    from_name = body.get("from_name")

    # Validation
    if not to_email:
        return cors_response(400, {"error": "to_email is required"})

    if "@" not in to_email:
        return cors_response(400, {"error": "Invalid email format"})

    if not subject:
        return cors_response(400, {"error": "subject is required"})

    if not body_html and not template_id:
        return cors_response(400, {"error": "body_html or template_id is required"})

    result = send_email(
        to_email=to_email,
        to_name=to_name if to_name else None,
        subject=subject,
        body_html=body_html,
        template_id=template_id,
        substitutions=substitutions if substitutions else None,
        tags=tags if tags else None,
        from_email=from_email,
        from_name=from_name,
    )

    # Check for errors
    if "status" in result and result["status"] == "error":
        return cors_response(400, {
            "error": result.get("message", "Send failed"),
            "code": result.get("code")
        })

    if "failed_emails" in result and result["failed_emails"]:
        failed = result["failed_emails"][0]
        return cors_response(400, {
            "error": f"Email rejected: {failed.get('reason', 'unknown')}",
            "email": failed.get("email")
        })

    return cors_response(200, {
        "success": True,
        "job_id": result.get("job_id"),
        "emails": result.get("emails", [])
    })


def handle_test(body: dict) -> dict:
    """
    POST ?action=test
    Send test email to verify Unisender Go configuration.
    """
    to_email = body.get("to_email", "").strip()

    if not to_email:
        return cors_response(400, {"error": "to_email is required"})

    if "@" not in to_email:
        return cors_response(400, {"error": "Invalid email format"})

    result = send_email(
        to_email=to_email,
        subject="Тестовое письмо от Unisender Go",
        body_html="""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">Тестовое письмо</h1>
            <p>Если вы видите это письмо — настройка Unisender Go прошла успешно!</p>
            <p style="color: #666; font-size: 14px;">
                Отправитель: {{sender_email}}<br>
                Время: {{timestamp}}
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">
                Это автоматическое тестовое письмо. Отвечать на него не нужно.
            </p>
        </div>
        """,
        substitutions={
            "sender_email": get_sender_email(),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        },
        tags=["test"],
    )

    if "status" in result and result["status"] == "error":
        return cors_response(400, {
            "error": result.get("message", "Test failed"),
            "code": result.get("code")
        })

    if "failed_emails" in result and result["failed_emails"]:
        failed = result["failed_emails"][0]
        return cors_response(400, {
            "error": f"Email rejected: {failed.get('reason', 'unknown')}",
        })

    return cors_response(200, {
        "success": True,
        "message": f"Test email sent to {to_email}",
        "job_id": result.get("job_id"),
    })


def handle_send_template(body: dict) -> dict:
    """
    POST ?action=send-template
    Send email using saved template.
    """
    to_email = body.get("to_email", "").strip()
    to_name = body.get("to_name", "").strip()
    template_id = body.get("template_id", "").strip()
    substitutions = body.get("substitutions", {})
    subject = body.get("subject", "").strip()

    if not to_email:
        return cors_response(400, {"error": "to_email is required"})

    if not template_id:
        return cors_response(400, {"error": "template_id is required"})

    result = send_email(
        to_email=to_email,
        to_name=to_name if to_name else None,
        subject=subject or "Уведомление",
        body_html="",
        template_id=template_id,
        substitutions=substitutions if substitutions else None,
    )

    if "status" in result and result["status"] == "error":
        return cors_response(400, {
            "error": result.get("message", "Send failed"),
            "code": result.get("code")
        })

    if "failed_emails" in result and result["failed_emails"]:
        failed = result["failed_emails"][0]
        return cors_response(400, {
            "error": f"Email rejected: {failed.get('reason', 'unknown')}",
        })

    return cors_response(200, {
        "success": True,
        "job_id": result.get("job_id"),
    })


# =============================================================================
# MAIN HANDLER
# =============================================================================

def handler(event: dict, context) -> dict:
    """Main entry point."""
    method = event.get("httpMethod", "GET")

    if method == "OPTIONS":
        return options_response()

    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    body = {}
    if method == "POST":
        raw_body = event.get("body", "{}")
        try:
            body = json.loads(raw_body) if raw_body else {}
        except json.JSONDecodeError:
            return cors_response(400, {"error": "Invalid JSON"})

    if action == "send" and method == "POST":
        return handle_send(body)
    elif action == "send-template" and method == "POST":
        return handle_send_template(body)
    elif action == "test" and method == "POST":
        return handle_test(body)
    else:
        return cors_response(400, {"error": f"Unknown action: {action}"})
