"""Email notification provider using standard SMTP."""

from __future__ import annotations

import asyncio
from email.message import EmailMessage
import smtplib
from typing import Any, Dict, Optional

from backend.config import get_settings
from backend.logging_config import logger
from backend.notifications.provider_base import BaseNotifier, NotificationResult


class EmailNotifier(BaseNotifier):
    """Notifier delivering messages over SMTP."""

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        user: Optional[str] = None,
        password: Optional[str] = None,
        from_email: Optional[str] = None,
        use_tls: bool = True,
    ):
        settings = get_settings()
        self.host = host or settings.SMTP_HOST
        self.port = port or settings.SMTP_PORT
        self.user = user or settings.SMTP_USER
        self.password = password or settings.SMTP_PASSWORD
        self.from_email = from_email or settings.SMTP_FROM_EMAIL or "notifications@dharohar.org"
        self.use_tls = use_tls if use_tls is not None else settings.SMTP_USE_TLS

    @property
    def channel_name(self) -> str:
        return "email"

    def is_configured(self) -> bool:
        """Configured if SMTP host is set."""
        return bool(self.host and str(self.host).strip())

    async def send(
        self,
        recipient: str,
        message: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> NotificationResult:
        """Send formatted email via SMTP in an executor thread to avoid blocking the event loop."""
        if not self.is_configured():
            return NotificationResult(
                success=False,
                channel=self.channel_name,
                error="SMTP email provider is not configured (missing SMTP_HOST).",
            )

        if not recipient or "@" not in recipient:
            return NotificationResult(
                success=False,
                channel=self.channel_name,
                error=f"Invalid email recipient: '{recipient}'.",
            )

        subject = message.get("title") or "Dharohar Notification"
        body_text = message.get("body", "")

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = self.from_email
        msg["To"] = recipient
        msg.set_content(body_text)

        # Include buttons as clickable links if available
        buttons = message.get("buttons") or []
        if buttons:
            html_links = []
            for btn in buttons:
                btn_title = btn.get("title", "Click here")
                btn_action = btn.get("action", "")
                html_links.append(f"<p><strong>{btn_title}</strong>: {btn.get('id')}</p>")
            html_content = f"<html><body><pre>{body_text}</pre><hr/>{''.join(html_links)}</body></html>"
            msg.add_alternative(html_content, subtype="html")

        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(None, self._send_sync, msg)
            return NotificationResult(
                success=True,
                channel=self.channel_name,
                message_id=f"email_{recipient}_{id(msg)}",
            )
        except Exception as e:
            err_msg = f"SMTP send error: {str(e)}"
            logger.error("email_send_exception", extra={"error": err_msg, "recipient": recipient})
            return NotificationResult(
                success=False,
                channel=self.channel_name,
                error=err_msg,
            )

    def _send_sync(self, msg: EmailMessage) -> None:
        """Synchronous SMTP transmission."""
        with smtplib.SMTP(self.host, self.port, timeout=10) as server:
            if self.use_tls:
                server.starttls()
            if self.user and self.password:
                server.login(self.user, self.password)
            server.send_message(msg)
