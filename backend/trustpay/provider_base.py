"""Abstract base interface for TrustPay payment and payout providers."""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class PaymentProvider(ABC):
    """Abstract interface defining required payment, escrow, and payout primitives."""

    @abstractmethod
    def create_order(self, booking_id: str, amount_inr: int) -> Dict[str, Any]:
        """Create a payment order for the organizer to deposit funds into escrow.

        Returns:
            {"order_id": str, "status": str, "simulated": bool}
        """
        pass

    @abstractmethod
    def confirm_payment(self, order_id: str) -> Dict[str, Any]:
        """Confirm receipt of organizer payment in escrow.

        Returns:
            {"txn_id": str, "status": str, "simulated": bool}
        """
        pass

    @abstractmethod
    def create_payout(
        self,
        booking_id: str,
        artist_id: str,
        amount_inr: int,
        linked_account_id: Optional[str] = None,
        payment_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Initiate payout release from escrow to artist.

        Returns:
            {"payout_id": str, "status": str, "simulated": bool}
        """
        pass

    @abstractmethod
    def get_payout_status(self, payout_id: str) -> Dict[str, Any]:
        """Check status of an initiated payout.

        Returns:
            {
                "status": "PENDING" | "SUCCESSFUL" | "FAILED",
                "reference": str,
                "beneficiary": str,
                "simulated": bool
            }
        """
        pass

    @abstractmethod
    def refund(
        self,
        order_id: str,
        payment_id: Optional[str] = None,
        amount_paise: Optional[int] = None,
        notes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Process refund back to the organizer from escrow.

        Returns:
            {"refund_id": str, "status": str, "simulated": bool}
        """
        pass
