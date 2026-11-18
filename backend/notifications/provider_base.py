"""Abstract base classes and schemas for notification providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from pydantic import BaseModel


class NotificationResult(BaseModel):
    """Result of a notification delivery attempt."""
    success: bool
    channel: str  # "whatsapp" | "email" | "in_app"
    message_id: Optional[str] = None
    error: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None


class BaseNotifier(ABC):
    """Abstract interface that all notification providers must implement."""

    @property
    @abstractmethod
    def channel_name(self) -> str:
        """Name of the communication channel."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Return True if required secrets and endpoints are present."""
        pass

    @abstractmethod
    async def send(
        self,
        recipient: str,
        message: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> NotificationResult:
        """Send notification payload to the recipient."""
        pass
