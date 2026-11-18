"""Platform fee and GST calculation in integer paise.

Organizer pays booking price + visible platform fee + GST on fee.
Artist receives the full agreed price without deductions.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from backend.config import get_settings


def calculate_platform_fees(
    base_price_paise: int = 0,
    fee_percent: Optional[float] = None,
    fee_gst_percent: Optional[float] = None,
    *,
    base_paise: Optional[int] = None,
) -> Dict[str, Any]:
    """Calculate platform fee and GST in integer paise.

    Rules:
    - Base price (artist fee) is in integer paise.
    - Platform fee is a percentage of the base price (default from settings).
    - GST is applied strictly to the platform fee (not the artist portion).
    - Organizer pays: base_price + platform_fee + gst.
    - Artist receives: base_price (100% of agreed price).
    - All money calculations return integer paise.

    Args:
        base_price_paise: The negotiated artist fee in integer paise.
        fee_percent: Optional override for platform fee percentage (e.g. 5.0).
        fee_gst_percent: Optional override for GST percentage on fee (e.g. 18.0).
        base_paise: Optional alias for base_price_paise.

    Returns:
        Dict containing integer paise breakdowns and INR equivalents for display.
    """
    if base_paise is not None:
        base_price_paise = base_paise
    if base_price_paise < 0:
        raise ValueError(f"Base price cannot be negative: {base_price_paise}")

    settings = get_settings()
    if fee_percent is None:
        fee_percent = float(getattr(settings, "PLATFORM_FEE_PERCENT", 5.0))
    if fee_gst_percent is None:
        fee_gst_percent = float(getattr(settings, "FEE_GST_PERCENT", 18.0))

    if fee_percent < 0:
        raise ValueError(f"Platform fee percent cannot be negative: {fee_percent}")
    if fee_gst_percent < 0:
        raise ValueError(f"GST percent cannot be negative: {fee_gst_percent}")

    # Compute integer paise using standard rounding
    platform_fee_paise = round(base_price_paise * (fee_percent / 100.0))
    gst_paise = round(platform_fee_paise * (fee_gst_percent / 100.0))
    total_organizer_paise = base_price_paise + platform_fee_paise + gst_paise
    artist_payout_paise = base_price_paise

    return {
        "base_paise": int(base_price_paise),
        "platform_fee_paise": int(platform_fee_paise),
        "fee_gst_paise": int(gst_paise),
        "total_organizer_paise": int(total_organizer_paise),
        "artist_payout_paise": int(artist_payout_paise),
        "fee_percent": fee_percent,
        "fee_gst_percent": fee_gst_percent,
        # API boundary conversion for UI display
        "base_inr": round(base_price_paise / 100.0, 2),
        "platform_fee_inr": round(platform_fee_paise / 100.0, 2),
        "fee_gst_inr": round(gst_paise / 100.0, 2),
        "total_organizer_inr": round(total_organizer_paise / 100.0, 2),
        "artist_payout_inr": round(artist_payout_paise / 100.0, 2),
    }
