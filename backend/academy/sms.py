import logging

import requests
from requests.auth import HTTPBasicAuth

from django.conf import settings

logger = logging.getLogger(__name__)


def _format_phone(phone: str) -> str:
    """Normalise a Tanzanian phone number to 255XXXXXXXXX format."""
    phone = phone.strip()
    if phone.startswith('+255'):
        return phone[1:]          # +255… → 255…
    if phone.startswith('255'):
        return phone              # already correct
    if phone.startswith('0'):
        return '255' + phone[1:]  # 07… → 2557…
    return phone


def _log(school, phone: str, message: str, status: str, message_id, error):
    """Persist an SMSLog record; silently ignore any DB errors."""
    try:
        from academy.models import SMSLog  # avoid top-level circular import
        SMSLog.objects.create(
            school=school,
            parent_phone=phone,
            message=message,
            status=status,
            message_id=message_id,
            error=error,
        )
    except Exception as exc:
        logger.error("Failed to write SMSLog: %s", exc)


def send_sms(phone: str, message: str, school=None) -> dict:
    """
    Send a single SMS via the NextSMS API.

    Parameters
    ----------
    phone   : Recipient phone number (any common TZ format).
    message : Text body to send.
    school  : Optional School instance for tenant-scoped logging.

    Returns
    -------
    dict with keys: success (bool), message_id (str|None), error (str|None)
    """
    phone = _format_phone(phone)

    # ------------------------------------------------------------------ #
    # Dry-run mode — no real API call                                      #
    # ------------------------------------------------------------------ #
    if settings.SMS_DRY_RUN:
        print(f"[DRY RUN] To: {phone} | {message}")
        result = {"success": True, "message_id": "dry-run-123", "error": None}
        _log(school, phone, message, "dry_run", result["message_id"], None)
        return result

    # ------------------------------------------------------------------ #
    # Live mode                                                            #
    # ------------------------------------------------------------------ #
    if not settings.NEXTSMS_SENDER_ID:
        print("[WAITING] Sender ID not configured yet")
        _log(school, phone, message, "failed", None, "Sender ID not configured")
        return {"success": False, "message_id": None, "error": "Sender ID not configured"}

    payload = {
        "from": settings.NEXTSMS_SENDER_ID,
        "to": phone,
        "text": message,
    }

    try:
        response = requests.post(
            "https://messaging-service.co.tz/api/sms/v1/text/single",
            json=payload,
            auth=HTTPBasicAuth(settings.NEXTSMS_USERNAME, settings.NEXTSMS_PASSWORD),
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            message_id = str(data.get("message_id") or data.get("id") or "")
            result = {"success": True, "message_id": message_id, "error": None}
            _log(school, phone, message, "sent", message_id, None)
            return result

        # Non-200 response
        error = response.text
        logger.error("NextSMS error %s for %s: %s", response.status_code, phone, error)
        _log(school, phone, message, "failed", None, error)
        return {"success": False, "message_id": None, "error": error}

    except Exception as exc:
        error = str(exc)
        logger.error("SMS send failed to %s: %s", phone, error)
        _log(school, phone, message, "failed", None, error)
        return {"success": False, "message_id": None, "error": error}
