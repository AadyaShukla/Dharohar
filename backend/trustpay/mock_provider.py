"""Mock payment provider implementing simulated escrow and payout delays with failure injection."""

import os
import sys
from typing import Any, Dict
from backend.trustpay.provider_base import PaymentProvider


class MockProvider(PaymentProvider):
    """Deterministic in-memory mock provider simulating payments, settlements, and payouts."""

    def __init__(self, allow_non_demo: bool = False) -> None:
        from backend.config import get_settings
        in_test = "pytest" in sys.modules or os.getenv("PYTEST_CURRENT_TEST") is not None
        if not get_settings().DEMO_MODE and not in_test and not allow_non_demo:
            raise ValueError("Mock payment provider cannot be selected when DEMO_MODE=false.")

        self._order_counter = 0
        self._txn_counter = 0
        self._payout_counter = 0
        self._refund_counter = 0

        self._fail_next_payout = False
        self._beneficiary_mismatch = False

        self._orders: Dict[str, Dict[str, Any]] = {}
        self._payouts: Dict[str, Dict[str, Any]] = {}
        self._refunds: Dict[str, Dict[str, Any]] = {}

    def set_fail_next_payout(self, fail: bool = True) -> None:
        """Inject failure for the next created payout."""
        self._fail_next_payout = fail

    def set_beneficiary_mismatch(self, mismatch: bool = True) -> None:
        """Inject beneficiary mismatch for subsequent payouts."""
        self._beneficiary_mismatch = mismatch

    def advance_time(self) -> int:
        """Simulate settlement delay by advancing pending payouts to SUCCESSFUL."""
        settled_count = 0
        for p_id, p_data in self._payouts.items():
            if p_data["status"] == "PENDING":
                p_data["status"] = "SUCCESSFUL"
                settled_count += 1
        return settled_count

    def create_order(self, booking_id: str, amount_inr: int) -> Dict[str, Any]:
        self._order_counter += 1
        order_id = f"MOCK-ORD-{self._order_counter:04d}"
        order_info = {
            "order_id": order_id,
            "booking_id": booking_id,
            "amount_inr": amount_inr,
            "status": "CREATED",
            "simulated": True,
        }
        self._orders[order_id] = order_info
        return {
            "order_id": order_id,
            "status": "CREATED",
            "simulated": True,
        }

    def confirm_payment(self, order_id: str) -> Dict[str, Any]:
        if order_id not in self._orders:
            raise ValueError(f"Order '{order_id}' does not exist in mock payment provider.")

        self._txn_counter += 1
        txn_id = f"MOCK-TXN-{self._txn_counter:04d}"
        self._orders[order_id]["status"] = "RECEIVED"
        self._orders[order_id]["txn_id"] = txn_id

        return {
            "txn_id": txn_id,
            "status": "RECEIVED",
            "simulated": True,
        }

    def create_payout(
        self,
        booking_id: str,
        artist_id: str,
        amount_inr: int,
        linked_account_id: Any = None,
        payment_id: Any = None,
    ) -> Dict[str, Any]:
        self._payout_counter += 1
        payout_id = f"MOCK-PAY-{self._payout_counter:04d}"

        if self._fail_next_payout:
            status = "FAILED"
            self._fail_next_payout = False  # Reset one-shot injection
        else:
            status = "PENDING"

        beneficiary = (
            "MISMATCHED_BANK_ACCOUNT_9999"
            if self._beneficiary_mismatch
            else f"VERIFIED_ACC_{artist_id}"
        )

        payout_info = {
            "payout_id": payout_id,
            "booking_id": booking_id,
            "artist_id": artist_id,
            "amount_inr": amount_inr,
            "status": status,
            "reference": f"REF-{self._payout_counter:04d}",
            "beneficiary": beneficiary,
            "payout_mode": "MANUAL" if linked_account_id == "MANUAL" else "ROUTE",
            "simulated": True,
        }
        self._payouts[payout_id] = payout_info

        return {
            "payout_id": payout_id,
            "status": status,
            "payout_mode": "MANUAL" if linked_account_id == "MANUAL" else "ROUTE",
            "simulated": True,
        }

    def get_payout_status(self, payout_id: str) -> Dict[str, Any]:
        if payout_id not in self._payouts:
            raise ValueError(f"Payout '{payout_id}' not found in mock provider.")

        data = self._payouts[payout_id]
        return {
            "status": data["status"],
            "reference": data["reference"],
            "beneficiary": data["beneficiary"],
            "simulated": True,
        }

    def refund(
        self,
        order_id: str,
        payment_id: Any = None,
        amount_paise: Any = None,
        notes: Any = None,
    ) -> Dict[str, Any]:
        self._refund_counter += 1
        refund_id = f"MOCK-REFUND-{self._refund_counter:04d}"
        if order_id in self._orders:
            self._orders[order_id]["status"] = "REFUNDED"

        self._refunds[refund_id] = {
            "refund_id": refund_id,
            "order_id": order_id,
            "amount_paise": amount_paise or 0,
            "status": "REFUNDED",
            "simulated": True,
        }

        return {
            "refund_id": refund_id,
            "status": "REFUNDED",
            "amount_paise": amount_paise or 0,
            "simulated": True,
        }

    def fetch_reconciliation_records(self, days: int = 7) -> Dict[str, Any]:
        """Return simulated payments and transfers for reconciliation tests."""
        payments = []
        for ord_id, o_data in self._orders.items():
            if o_data.get("status") in ["RECEIVED", "CAPTURED"]:
                payments.append({
                    "id": o_data.get("txn_id", f"pay_{ord_id}"),
                    "order_id": ord_id,
                    "status": "captured",
                    "amount": o_data.get("amount_inr", 0),
                })
        transfers = []
        for p_id, p_data in self._payouts.items():
            transfers.append({
                "id": p_id,
                "status": "processed" if p_data.get("status") == "SUCCESSFUL" else p_data.get("status", "pending").lower(),
                "amount": p_data.get("amount_inr", 0),
            })
        return {"payments": payments, "transfers": transfers}
