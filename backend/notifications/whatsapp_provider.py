"""Meta WhatsApp Cloud API notification provider."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
import httpx

from backend.config import get_settings
from backend.logging_config import logger
from backend.notifications.provider_base import BaseNotifier, NotificationResult


def normalize_whatsapp_phone(phone: str) -> str:
    """Normalize phone number to international E.164 digits without leading '+'."""
    digits = re.sub(r"\D", "", phone)
    # Default to 91 (India) if 10-digit mobile provided
    if len(digits) == 10:
        digits = f"91{digits}"
    return digits


class WhatsAppNotifier(BaseNotifier):
    """Notifier for WhatsApp Business Cloud API (Meta Graph API)."""

    def __init__(
        self,
        token: Optional[str] = None,
        phone_id: Optional[str] = None,
        api_version: str = "v21.0",
        client: Optional[httpx.AsyncClient] = None,
    ):
        settings = get_settings()
        self.token = token or settings.WHATSAPP_TOKEN
        self.phone_id = phone_id or settings.WHATSAPP_PHONE_ID or settings.WHATSAPP_PHONE_NUMBER_ID
        self.api_version = api_version
        self._client = client

    @property
    def channel_name(self) -> str:
        return "whatsapp"

    def is_configured(self) -> bool:
        """WhatsApp is configured if both Token and Phone ID are set."""
        return bool(self.token and str(self.token).strip() and self.phone_id and str(self.phone_id).strip())

    async def send(
        self,
        recipient: str,
        message: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> NotificationResult:
        """Send notification via WhatsApp Cloud API."""
        if not self.is_configured():
            return NotificationResult(
                success=False,
                channel=self.channel_name,
                error="WhatsApp Cloud API is not configured (missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID).",
            )

        clean_recipient = normalize_whatsapp_phone(recipient)
        endpoint = f"https://graph.facebook.com/{self.api_version}/{self.phone_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

        # Build payload
        buttons: List[Dict[str, Any]] = message.get("buttons") or []
        body_text: str = message.get("body", "")
        whatsapp_tpl_name: Optional[str] = message.get("whatsapp_template_name")

        # Meta requires template message for initial contact outside 24h window
        is_first_contact = context.get("is_first_contact", False) if context else False

        if is_first_contact and whatsapp_tpl_name:
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": clean_recipient,
                "type": "template",
                "template": {
                    "name": whatsapp_tpl_name,
                    "language": {"code": message.get("language", "hi")},
                },
            }
        elif buttons:
            # Interactive message with quick-reply buttons (up to 3 allowed by Meta)
            interactive_buttons = []
            for b in buttons[:3]:
                interactive_buttons.append({
                    "type": "reply",
                    "reply": {
                        "id": b["id"],
                        "title": b["title"][:20],  # Meta max 20 chars
                    },
                })
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": clean_recipient,
                "type": "interactive",
                "interactive": {
                    "type": "button",
                    "body": {"text": body_text[:1024]},
                    "action": {"buttons": interactive_buttons},
                },
            }
        else:
            # Standard text message
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": clean_recipient,
                "type": "text",
                "text": {"preview_url": False, "body": body_text[:4096]},
            }

        try:
            if self._client:
                resp = await self._client.post(endpoint, json=payload, headers=headers)
            else:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(endpoint, json=payload, headers=headers)

            if resp.status_code in [200, 201]:
                res_data = resp.json()
                msg_id = ""
                if "messages" in res_data and len(res_data["messages"]) > 0:
                    msg_id = res_data["messages"][0].get("id", "")
                return NotificationResult(
                    success=True,
                    channel=self.channel_name,
                    message_id=msg_id,
                    raw_response=res_data,
                )
            else:
                err_text = f"WhatsApp API HTTP {resp.status_code}: {resp.text}"
                logger.error("whatsapp_send_failed", extra={"error": err_text, "recipient": clean_recipient})
                return NotificationResult(
                    success=False,
                    channel=self.channel_name,
                    error=err_text,
                )
        except Exception as e:
            err_msg = f"WhatsApp network error: {str(e)}"
            logger.error("whatsapp_exception", extra={"error": err_msg, "recipient": clean_recipient})
            return NotificationResult(
                success=False,
                channel=self.channel_name,
                error=err_msg,
            )
