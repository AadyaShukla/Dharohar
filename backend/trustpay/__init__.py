"""TrustPay module for escrow milestones and payment workflows."""

from typing import Optional

from backend.trustpay.provider_base import PaymentProvider
from backend.trustpay.mock_provider import MockProvider
from backend.trustpay.razorpay_provider import RazorpayProvider
from backend.trustpay.fees import calculate_platform_fees
from backend.trustpay.state_machine import TrustPayService

_mock_provider_singleton: Optional[MockProvider] = None


def get_payment_provider(provider_name: Optional[str] = None) -> PaymentProvider:
    """Resolve payment provider based on PAYMENT_PROVIDER setting or explicit parameter."""
    global _mock_provider_singleton
    from backend.config import get_settings
    settings = get_settings()

    target = (provider_name or settings.PAYMENT_PROVIDER).strip().lower()

    # In production (ENV=production), mock must not be selectable
    if settings.ENV.strip().lower() == "production" and target == "mock":
        raise ValueError("Mock payment provider cannot be selected in production (ENV=production).")

    if target == "mock":
        if _mock_provider_singleton is None:
            _mock_provider_singleton = MockProvider(allow_non_demo=True)
        return _mock_provider_singleton

    if target == "razorpay":
        missing = []
        if not settings.RAZORPAY_KEY_ID or not str(settings.RAZORPAY_KEY_ID).strip():
            missing.append("RAZORPAY_KEY_ID")
        if not settings.RAZORPAY_KEY_SECRET or not str(settings.RAZORPAY_KEY_SECRET).strip():
            missing.append("RAZORPAY_KEY_SECRET")
        if missing:
            raise ValueError(
                f"PAYMENT_PROVIDER is set to 'razorpay' but required Razorpay keys are missing: {', '.join(missing)}"
            )
        return RazorpayProvider(
            key_id=settings.RAZORPAY_KEY_ID,
            key_secret=settings.RAZORPAY_KEY_SECRET,
        )

    raise ValueError(f"Unknown payment provider: '{target}'. Must be 'mock' or 'razorpay'.")


__all__ = [
    "PaymentProvider",
    "MockProvider",
    "RazorpayProvider",
    "TrustPayService",
    "calculate_platform_fees",
    "get_payment_provider",
]
