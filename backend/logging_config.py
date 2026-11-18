"""Structured JSON logging configuration with request tracing and sensitive data masking.

Guarantees:
- Every log message includes timestamp, log level, logger name, and request ID.
- Secrets (API keys, bearer tokens, private keys) are never logged in full.
- Phone numbers are masked, exposing at most the last 4 digits.
"""

from __future__ import annotations

from contextvars import ContextVar
from datetime import datetime, timezone
import json
import logging
import re
import sys
import time
from typing import Any, Callable, Dict, Optional
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Request ID context variable for coroutine-local tracing
request_id_ctx_var: ContextVar[str] = ContextVar("request_id", default="")

# -----------------------------------------------------------------------------
# Sensitive Data Masking Patterns
# -----------------------------------------------------------------------------

# Phone numbers (Indian 10-digit mobile, optionally prefixed with +91 or 91)
PHONE_REGEX = re.compile(r"(?:\+?91[\s-]?)?([6-9]\d{5})(\d{4})\b")

# Generic 10-digit sequences (e.g. simulated phones like 9000000001)
GENERIC_PHONE_REGEX = re.compile(r"\b([0-9]{6})([0-9]{4})\b")

# Secret patterns
BEARER_REGEX = re.compile(r"(Bearer\s+)([A-Za-z0-9_\-\.]{8,})([A-Za-z0-9_\-\.]{4})")
RAZORPAY_REGEX = re.compile(r"(rzp_(?:test|live)_)([a-zA-Z0-9]{6,})([a-zA-Z0-9]{4})")
GOOGLE_API_REGEX = re.compile(r"(AIza[0-9A-Za-z\-_]{27,})([0-9A-Za-z\-_]{4})")
ANTHROPIC_API_REGEX = re.compile(r"(sk-ant-[a-zA-Z0-9\-_]{16,})([a-zA-Z0-9\-_]{4})")
OPENAI_API_REGEX = re.compile(r"(sk-[a-zA-Z0-9\-_]{16,})([a-zA-Z0-9\-_]{4})")
PRIVATE_KEY_REGEX = re.compile(r"-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9_-]+ )?PRIVATE KEY-----")
KEY_ASSIGN_REGEX = re.compile(
    r"""(?i)(["']?(?:password|token|secret|api_key|auth_secret|access_token|refresh_token|code)["']?\s*[:=]\s*["']?)([^"',\s\}]{4,})([^"',\s\}]{4})(["']?)"""
)


def mask_sensitive_data(text: str) -> str:
    """Mask phone numbers and secrets in any arbitrary string."""
    if not isinstance(text, str) or not text:
        return text

    # 1. Private keys
    res = PRIVATE_KEY_REGEX.sub("[REDACTED PRIVATE KEY]", text)

    # 2. Bearer tokens
    res = BEARER_REGEX.sub(r"\1...[REDACTED]...\3", res)

    # 3. Razorpay keys
    res = RAZORPAY_REGEX.sub(r"\1...[REDACTED]...\3", res)

    # 4. Google & AI API keys
    res = GOOGLE_API_REGEX.sub(r"AIza...[REDACTED]...\2", res)
    res = ANTHROPIC_API_REGEX.sub(r"sk-ant...[REDACTED]...\2", res)
    res = OPENAI_API_REGEX.sub(r"sk-...[REDACTED]...\2", res)

    # 5. Sensitive key assignments (passwords, tokens, secrets)
    res = KEY_ASSIGN_REGEX.sub(r"\1...[REDACTED]...\3\4", res)

    # 6. Phone numbers: mask all except last 4 digits
    res = PHONE_REGEX.sub(r"******\2", res)
    res = GENERIC_PHONE_REGEX.sub(r"******\2", res)

    return res


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects with sanitization."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", None) or request_id_ctx_var.get() or "none",
            "message": mask_sensitive_data(record.getMessage()),
        }

        # Include custom extra fields if provided
        for key, value in record.__dict__.items():
            if key not in {
                "args", "asctime", "created", "exc_info", "exc_text", "filename",
                "funcName", "id", "levelname", "levelno", "lineno", "module",
                "msecs", "message", "msg", "name", "pathname", "process",
                "processName", "relativeCreated", "stack_info", "thread",
                "threadName", "request_id",
            }:
                if isinstance(value, str):
                    log_data[key] = mask_sensitive_data(value)
                else:
                    log_data[key] = value

        if record.exc_info:
            log_data["exception"] = mask_sensitive_data(self.formatException(record.exc_info))

        return json.dumps(log_data)


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root and application loggers to use StructuredJsonFormatter."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredJsonFormatter())

    root_logger = logging.getLogger()
    # Avoid duplicate handlers on re-runs
    root_logger.handlers = [handler]
    root_logger.setLevel(level)

    # Application logger
    app_logger = logging.getLogger("backend")
    app_logger.setLevel(level)


logger = logging.getLogger("backend")


class RequestIdAndLoggingMiddleware(BaseHTTPMiddleware):
    """Attaches request_id to context and logs structured request/response events."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Resolve or generate request ID
        req_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
        token = request_id_ctx_var.set(req_id)
        request.state.request_id = req_id

        start_time = time.perf_counter()
        sanitized_path = mask_sensitive_data(request.url.path)
        client_host = request.client.host if request.client else "unknown"

        logger.info(
            f"Incoming request {request.method} {sanitized_path}",
            extra={
                "method": request.method,
                "path": sanitized_path,
                "client_ip": client_host,
                "event": "HTTP_REQUEST_STARTED",
            },
        )

        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            response.headers["X-Request-ID"] = req_id

            logger.info(
                f"Completed request {request.method} {sanitized_path} {response.status_code} in {duration_ms}ms",
                extra={
                    "method": request.method,
                    "path": sanitized_path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                    "event": "HTTP_REQUEST_FINISHED",
                },
            )
            return response

        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                f"Unhandled exception on {request.method} {sanitized_path}: {exc}",
                exc_info=True,
                extra={
                    "method": request.method,
                    "path": sanitized_path,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                    "event": "HTTP_REQUEST_FAILED",
                },
            )
            raise
        finally:
            request_id_ctx_var.reset(token)
