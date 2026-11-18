"""Central notification dispatcher managing user preferences, consent checks, fallbacks, and retry worker."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from backend.audit import log_event
from backend.config import get_settings
from backend.database import ConsentRow, NotificationLogRow, SessionLocal, UserRow
from backend.logging_config import logger
from backend.notifications.email_provider import EmailNotifier
from backend.notifications.in_app_provider import InAppNotifier
from backend.notifications.provider_base import BaseNotifier, NotificationResult
from backend.notifications.templates import TemplateRenderer
from backend.notifications.whatsapp_provider import WhatsAppNotifier, normalize_whatsapp_phone


class NotificationDispatcher:
    """Orchestrates multi-channel notification dispatch with strict consent enforcement and intelligent fallback."""

    def __init__(
        self,
        whatsapp_provider: Optional[WhatsAppNotifier] = None,
        email_provider: Optional[EmailNotifier] = None,
        in_app_provider: Optional[InAppNotifier] = None,
    ):
        self.whatsapp = whatsapp_provider or WhatsAppNotifier()
        self.email = email_provider or EmailNotifier()
        self.in_app = in_app_provider or InAppNotifier()

    def get_provider(self, channel: str) -> BaseNotifier:
        """Resolve provider by channel name."""
        if channel == "whatsapp":
            return self.whatsapp
        elif channel == "email":
            return self.email
        elif channel == "in_app":
            return self.in_app
        raise ValueError(f"Unknown channel: '{channel}'")

    async def dispatch(
        self,
        event_type: str,
        recipient_user_id: Optional[str] = None,
        recipient_phone: Optional[str] = None,
        recipient_email: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        db: Optional[Session] = None,
        preferred_channel: Optional[str] = None,
        language: Optional[str] = None,
    ) -> List[NotificationResult]:
        """Dispatch a notification adhering to user preferences, consent rules, and fallback policies."""
        ctx = context or {}
        settings = get_settings()
        local_db = db or SessionLocal()
        should_close_db = db is None

        results: List[NotificationResult] = []

        try:
            # 1. Look up user record if recipient_user_id or phone provided
            user: Optional[UserRow] = None
            if recipient_user_id:
                user = local_db.query(UserRow).filter(UserRow.id == recipient_user_id).first()
            elif recipient_phone:
                clean_p = normalize_whatsapp_phone(recipient_phone)
                # Match against both raw phone and formatted phone
                user = local_db.query(UserRow).filter(
                    (UserRow.phone == recipient_phone) | (UserRow.phone == f"+{clean_p}") | (UserRow.phone == clean_p)
                ).first()

            # 2. Check User Consent & Opt-Out status
            if user:
                if user.opted_out:
                    logger.info("notification_skipped_opted_out", extra={"user_id": user.id, "phone": user.phone})
                    log_entry = NotificationLogRow(
                        user_id=user.id,
                        recipient=user.phone or (recipient_email or "unknown"),
                        channel=user.notification_preference or "whatsapp",
                        event_type=event_type,
                        template_name=event_type,
                        language=user.language or "hi",
                        context_data=ctx,
                        status="FAILED",
                        retry_count=0,
                        error_message="User has opted out (STOP/UNSUBSCRIBE). Notification suppressed.",
                    )
                    local_db.add(log_entry)
                    local_db.commit()
                    return [
                        NotificationResult(
                            success=False,
                            channel=user.notification_preference or "whatsapp",
                            error="User has opted out of notifications.",
                        )
                    ]

            # 3. Determine Language
            lang = language or (user.language if user else "hi") or "hi"

            # 4. Render Message Payload
            message = TemplateRenderer.render(event_type=event_type, context=ctx, language=lang)

            # 5. Resolve Channel & Fallback Strategy
            # Priority: explicit arg -> user.notification_preference -> "whatsapp"
            channel = preferred_channel or (user.notification_preference if user else None) or "whatsapp"

            # Target recipients
            phone = recipient_phone or (user.phone if user else None)
            email_addr = recipient_email or (user.email if user else None)

            # Rule: If WhatsApp is selected but unconfigured, fall back to in-app plus email!
            targets_to_send: List[Tuple[str, str]] = []  # (channel, recipient_address)

            if channel == "whatsapp":
                if self.whatsapp.is_configured() and phone:
                    targets_to_send.append(("whatsapp", phone))
                else:
                    logger.info(
                        "whatsapp_not_configured_fallback_to_inapp_and_email",
                        extra={"event_type": event_type, "has_email": bool(email_addr)}
                    )
                    # Always include in-app
                    targets_to_send.append(("in_app", user.id if user else (phone or "anonymous")))
                    # Include email if available
                    if email_addr:
                        targets_to_send.append(("email", email_addr))
            elif channel == "email":
                if email_addr:
                    targets_to_send.append(("email", email_addr))
                targets_to_send.append(("in_app", user.id if user else (email_addr or "anonymous")))
            else:  # in_app
                targets_to_send.append(("in_app", user.id if user else "anonymous"))

            # 6. Execute dispatches and persist audit log rows
            for chan, recip in targets_to_send:
                # Create initial PENDING log entry
                log_entry = NotificationLogRow(
                    user_id=user.id if user else None,
                    recipient=recip,
                    channel=chan,
                    event_type=event_type,
                    template_name=event_type,
                    language=lang,
                    context_data=ctx,
                    status="PENDING",
                    retry_count=0,
                )
                local_db.add(log_entry)
                local_db.commit()
                local_db.refresh(log_entry)

                provider = self.get_provider(chan)
                res = await provider.send(recipient=recip, message=message, context=ctx)
                results.append(res)

                if res.success:
                    log_entry.status = "SENT"
                    log_entry.error_message = None
                    log_entry.updated_at = datetime.utcnow()
                else:
                    log_entry.status = "FAILED"
                    log_entry.error_message = res.error
                    # Schedule retry with backoff
                    base_interval = getattr(settings, "NOTIFICATION_RETRY_INTERVAL_SECONDS", 60)
                    log_entry.next_retry_at = datetime.utcnow() + timedelta(seconds=base_interval)
                    log_entry.updated_at = datetime.utcnow()

                local_db.commit()

        finally:
            if should_close_db:
                local_db.close()

        return results

    async def retry_failed_notifications(
        self,
        db: Session,
        max_retries: Optional[int] = None,
    ) -> List[NotificationLogRow]:
        """Background worker that retries failed notifications with exponential backoff."""
        settings = get_settings()
        limit_retries = max_retries or getattr(settings, "NOTIFICATION_MAX_RETRIES", 5)
        base_interval = getattr(settings, "NOTIFICATION_RETRY_INTERVAL_SECONDS", 60)
        now = datetime.utcnow()

        failed_rows = (
            db.query(NotificationLogRow)
            .filter(
                NotificationLogRow.status == "FAILED",
                NotificationLogRow.retry_count < limit_retries,
                (NotificationLogRow.next_retry_at == None) | (NotificationLogRow.next_retry_at <= now),
            )
            .all()
        )

        retried_rows = []
        for row in failed_rows:
            provider = self.get_provider(row.channel)
            message = TemplateRenderer.render(
                event_type=row.event_type,
                context=row.context_data or {},
                language=row.language or "hi",
            )
            res = await provider.send(
                recipient=row.recipient,
                message=message,
                context=row.context_data or {},
            )

            row.retry_count += 1
            if res.success:
                row.status = "SENT"
                row.error_message = None
                row.next_retry_at = None
            else:
                row.error_message = res.error
                # Exponential backoff: interval * (2 ** retry_count)
                backoff_seconds = base_interval * (2 ** row.retry_count)
                row.next_retry_at = datetime.utcnow() + timedelta(seconds=backoff_seconds)

            row.updated_at = datetime.utcnow()
            db.commit()
            retried_rows.append(row)

        return retried_rows


# Global default instance
default_dispatcher = NotificationDispatcher()


def get_dispatcher() -> NotificationDispatcher:
    """Return configured singleton notification dispatcher."""
    return default_dispatcher
