"""Dharohar Notification Subsystem."""

from backend.notifications.dispatcher import NotificationDispatcher, default_dispatcher, get_dispatcher
from backend.notifications.email_provider import EmailNotifier
from backend.notifications.in_app_provider import InAppNotifier
from backend.notifications.provider_base import BaseNotifier, NotificationResult
from backend.notifications.templates import TEMPLATES, TemplateRenderer
from backend.notifications.tokens import create_action_token, verify_and_consume_token
from backend.notifications.voice_handler import (
    confirm_voice_proposal,
    create_voice_proposal,
    parse_rules_from_transcript,
    transcribe_audio_with_llm,
)
from backend.notifications.whatsapp_provider import WhatsAppNotifier, normalize_whatsapp_phone

__all__ = [
    "BaseNotifier",
    "NotificationResult",
    "WhatsAppNotifier",
    "EmailNotifier",
    "InAppNotifier",
    "NotificationDispatcher",
    "default_dispatcher",
    "get_dispatcher",
    "TEMPLATES",
    "TemplateRenderer",
    "create_action_token",
    "verify_and_consume_token",
    "transcribe_audio_with_llm",
    "parse_rules_from_transcript",
    "create_voice_proposal",
    "confirm_voice_proposal",
    "normalize_whatsapp_phone",
]
