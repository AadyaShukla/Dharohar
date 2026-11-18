"""In-App notification provider for web dashboard feeds."""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from backend.notifications.provider_base import BaseNotifier, NotificationResult


class InAppNotifier(BaseNotifier):
    """Notifier delivering in-app alerts visible in the Dharohar web interface."""

    @property
    def channel_name(self) -> str:
        return "in_app"

    def is_configured(self) -> bool:
        """In-app notifications are always enabled."""
        return True

    async def send(
        self,
        recipient: str,
        message: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> NotificationResult:
        """In-app notifications are logged directly to the database notification_logs table."""
        msg_id = f"inapp_{uuid.uuid4().hex[:12]}"
        return NotificationResult(
            success=True,
            channel=self.channel_name,
            message_id=msg_id,
        )
