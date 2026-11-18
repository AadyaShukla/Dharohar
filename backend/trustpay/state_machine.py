"""Deterministic TrustPay escrow and payout state machine."""

from typing import Any, Dict, Optional
from datetime import datetime, date, time, timedelta
from sqlalchemy.orm import Session

from backend.audit import log_event
from backend.database import ArtistRow, AuditLogRow, BookingRow, SessionLocal, TrustPayRow, ReconciliationTicketRow
from backend.trustpay.provider_base import PaymentProvider
from backend.trustpay.fees import calculate_platform_fees
from backend.trustpay import reconciliation


class TrustPayService:
    """Escrow state machine managing milestones, payouts, and settlement sync."""

    def __init__(self, provider: PaymentProvider) -> None:
        self.provider = provider
        self.strict_release_rule: bool = False

    def _has_artist_approval(self, booking_id: str, db: Session) -> bool:
        """Check whether artist approval was explicitly recorded for this booking."""
        approval = (
            db.query(AuditLogRow)
            .filter(
                AuditLogRow.booking_id == booking_id,
                AuditLogRow.action == "ARTIST_APPROVED",
            )
            .first()
        )
        return approval is not None

    def start_payment(
        self,
        booking_id: str,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Start escrow payment order including platform fee and GST.

        Allowed ONLY if booking status is AWAITING_ARTIST_APPROVAL and artist approval is recorded.
        """
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
            if not booking:
                raise ValueError(f"Booking '{booking_id}' does not exist.")

            if booking.status != "AWAITING_ARTIST_APPROVAL":
                raise ValueError(
                    f"Cannot start payment: Booking is in status '{booking.status}', "
                    "expected 'AWAITING_ARTIST_APPROVAL'."
                )

            if not self._has_artist_approval(booking_id, db):
                raise ValueError(
                    f"Cannot start payment: Artist approval has not been recorded for booking '{booking_id}'."
                )

            # Compute platform fee & GST in integer paise
            fees = calculate_platform_fees(booking.budget)

            order_res = self.provider.create_order(
                booking_id=booking_id,
                amount_inr=fees["total_organizer_paise"],
            )

            trustpay = (
                db.query(TrustPayRow).filter(TrustPayRow.booking_id == booking_id).first()
            )
            if not trustpay:
                trustpay = TrustPayRow(
                    booking_id=booking_id,
                    order_id=order_res["order_id"],
                    amount=fees["base_paise"],
                    platform_fee_paise=fees["platform_fee_paise"],
                    fee_gst_paise=fees["fee_gst_paise"],
                    organizer_payment_status="NOT_PAID",
                )
                db.add(trustpay)
            else:
                trustpay.order_id = order_res["order_id"]
                trustpay.amount = fees["base_paise"]
                trustpay.platform_fee_paise = fees["platform_fee_paise"]
                trustpay.fee_gst_paise = fees["fee_gst_paise"]

            db.commit()

            log_event(
                booking_id=booking_id,
                actor="SYSTEM",
                action="STANDBY_CHECKED",
                details={
                    "event": "PAYMENT_ORDER_STARTED",
                    "order_id": order_res["order_id"],
                    "base_amount_paise": fees["base_paise"],
                    "platform_fee_paise": fees["platform_fee_paise"],
                    "fee_gst_paise": fees["fee_gst_paise"],
                    "total_organizer_paise": fees["total_organizer_paise"],
                },
                db=db,
            )

            # Enrich order_res with fee breakdown
            order_res["fees"] = fees
            return order_res
        finally:
            if should_close:
                db.close()

    def record_organizer_payment(
        self,
        booking_id: str,
        txn_id: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Record receipt of organizer deposit in escrow, transition booking to PAID.

        Never allowed before artist approval.
        """
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
            if not booking:
                raise ValueError(f"Booking '{booking_id}' does not exist.")

            if not self._has_artist_approval(booking_id, db):
                raise ValueError(
                    f"Cannot record payment: Artist approval has not been recorded for booking '{booking_id}'."
                )

            trustpay = (
                db.query(TrustPayRow).filter(TrustPayRow.booking_id == booking_id).first()
            )
            if not trustpay or not trustpay.order_id:
                raise ValueError(
                    f"Cannot record payment: Escrow order has not been started for booking '{booking_id}'."
                )

            resolved_txn_id = txn_id
            if not resolved_txn_id:
                confirm_res = self.provider.confirm_payment(trustpay.order_id)
                resolved_txn_id = confirm_res.get("txn_id")
            else:
                confirm_res = {
                    "txn_id": resolved_txn_id,
                    "order_id": trustpay.order_id,
                    "status": "CAPTURED",
                    "simulated": False,
                }

            trustpay.organizer_payment_status = "RECEIVED"
            trustpay.txn_id = resolved_txn_id

            booking.status = "PAID"
            db.commit()

            log_event(
                booking_id=booking_id,
                actor="SYSTEM",
                action="ORGANIZER_APPROVED_CHANGE",
                details={
                    "event": "ORGANIZER_PAYMENT_RECEIVED",
                    "txn_id": resolved_txn_id,
                    "status": "PAID",
                },
                db=db,
            )

            return confirm_res
        finally:
            if should_close:
                db.close()

    def release_payout(
        self,
        booking_id: str,
        artist_id: Optional[str] = None,
        operator_approved_early: bool = False,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Release payout from escrow to artist.

        Release Rule (Requirement 8):
        - Allowed only after event date has passed AND the dispute window (48h)
          closed without a dispute, OR the operator approves early.
        - Artist acknowledgement is still tracked separately.
        """
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
            if not booking:
                raise ValueError(f"Booking '{booking_id}' does not exist.")

            trustpay = (
                db.query(TrustPayRow).filter(TrustPayRow.booking_id == booking_id).first()
            )
            if not trustpay or trustpay.organizer_payment_status != "RECEIVED":
                raise ValueError(
                    f"Cannot release payout: Organizer payment not yet RECEIVED for booking '{booking_id}'."
                )

            if booking.status not in ["PAID", "PERFORMED"]:
                raise ValueError(
                    f"Cannot release payout: Booking is in status '{booking.status}', expected 'PAID' or 'PERFORMED'."
                )

            # Evaluate Release Rule
            from backend.trustpay.mock_provider import MockProvider
            is_mock = isinstance(self.provider, MockProvider)
            enforce_rule = not is_mock or self.strict_release_rule

            if operator_approved_early:
                trustpay.operator_approved_early = True
            elif enforce_rule:
                # 1. Check if event date has passed
                event_d = booking.event_date
                event_t_str = booking.event_time or "18:00"
                try:
                    parts = [int(p) for p in event_t_str.split(":")]
                    event_t = time(parts[0], parts[1] if len(parts) > 1 else 0)
                except Exception:
                    event_t = time(18, 0)

                event_dt = datetime.combine(event_d, event_t)
                now = datetime.utcnow()

                if event_dt > now:
                    raise ValueError(
                        f"Cannot release payout: Event date ({booking.event_date}) has not yet passed. Early release requires operator approval."
                    )

                # 2. Check 48h dispute window
                window_hours = trustpay.dispute_window_hours or 48
                dispute_deadline = event_dt + timedelta(hours=window_hours)
                if now < dispute_deadline:
                    raise ValueError(
                        f"Cannot release payout: Dispute window of {window_hours} hours is still open. Early release requires operator approval."
                    )

                # 3. Check for active dispute tickets
                active_dispute = (
                    db.query(ReconciliationTicketRow)
                    .filter(
                        ReconciliationTicketRow.booking_id == booking_id,
                        ReconciliationTicketRow.status == "OPEN",
                    )
                    .first()
                )
                if active_dispute or trustpay.artist_ack_status == "DISPUTED":
                    raise ValueError(
                        f"Cannot release payout: An active dispute is open for booking '{booking_id}'."
                    )

            # Resolve artist and Route linked account
            resolved_artist_id = artist_id
            if not resolved_artist_id and booking.roles_needed and isinstance(booking.roles_needed, list):
                for r in booking.roles_needed:
                    if isinstance(r, dict) and (r.get("assigned_artist_id") or r.get("artist_id")):
                        resolved_artist_id = r.get("assigned_artist_id") or r.get("artist_id")
                        break
            if not resolved_artist_id:
                resolved_artist_id = getattr(booking, "assigned_artist_id", None) or "default_artist"

            artist = db.query(ArtistRow).filter(ArtistRow.id == resolved_artist_id).first()
            linked_account_id = artist.linked_account_id if artist else None

            payout_res = self.provider.create_payout(
                booking_id=booking_id,
                artist_id=resolved_artist_id,
                amount_inr=trustpay.amount,
                linked_account_id=linked_account_id,
                payment_id=trustpay.txn_id,
            )

            payout_mode = payout_res.get("payout_mode", "ROUTE")
            trustpay.payout_id = payout_res["payout_id"]
            trustpay.artist_payout_status = payout_res["status"]
            trustpay.payout_mode = payout_mode

            # If Route not enabled, record manual operator payout task in reconciliation
            if payout_mode == "MANUAL":
                reconciliation.open_ticket(
                    booking_id=booking_id,
                    reason=f"Manual operator payout required: Route transfer unavailable for artist '{artist.name if artist else resolved_artist_id}'. Payout ID: {payout_res['payout_id']}",
                    db=db,
                )
                log_event(
                    booking_id=booking_id,
                    actor="SYSTEM",
                    action="STANDBY_CHECKED",
                    details={
                        "event": "MANUAL_PAYOUT_TASK_RECORDED",
                        "payout_id": payout_res["payout_id"],
                        "artist_id": resolved_artist_id,
                        "amount_paise": trustpay.amount,
                    },
                    db=db,
                )

            db.commit()

            log_event(
                booking_id=booking_id,
                actor="OPERATOR" if operator_approved_early else "SYSTEM",
                action="STANDBY_CHECKED",
                details={
                    "event": "PAYOUT_RELEASED",
                    "payout_id": payout_res["payout_id"],
                    "payout_mode": payout_mode,
                    "status": payout_res["status"],
                    "operator_approved_early": operator_approved_early,
                },
                db=db,
            )

            return payout_res
        finally:
            if should_close:
                db.close()

        try:
            booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
            if not booking:
                raise ValueError(f"Booking '{booking_id}' does not exist.")

            trustpay = (
                db.query(TrustPayRow).filter(TrustPayRow.booking_id == booking_id).first()
            )
            if not trustpay or trustpay.organizer_payment_status != "RECEIVED":
                raise ValueError(
                    f"Cannot release payout: Organizer payment not yet RECEIVED for booking '{booking_id}'."
                )

            if booking.status != "PAID":
                raise ValueError(
                    f"Cannot release payout: Booking is in status '{booking.status}', expected 'PAID'."
                )

            payout_res = self.provider.create_payout(
                booking_id=booking_id,
                artist_id=artist_id,
                amount_inr=trustpay.amount,
            )

            trustpay.payout_id = payout_res["payout_id"]
            trustpay.artist_payout_status = payout_res["status"]
            db.commit()

            log_event(
                booking_id=booking_id,
                actor="SYSTEM",
                action="STANDBY_CHECKED",
                details={
                    "event": "PAYOUT_RELEASED",
                    "payout_id": payout_res["payout_id"],
                    "status": payout_res["status"],
                },
                db=db,
            )

            return payout_res
        finally:
            if should_close:
                db.close()

    def sync_payout(
        self,
        booking_id: str,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Read provider status, update artist_payout_status; if FAILED open ticket and retry."""
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            trustpay = (
                db.query(TrustPayRow).filter(TrustPayRow.booking_id == booking_id).first()
            )
            if not trustpay or not trustpay.payout_id:
                raise ValueError(f"No payout initiated for booking '{booking_id}'.")

            status_res = self.provider.get_payout_status(trustpay.payout_id)
            new_status = status_res["status"]
            trustpay.artist_payout_status = new_status
            db.commit()

            if new_status == "FAILED":
                ticket = reconciliation.open_ticket(
                    booking_id=booking_id,
                    reason="Payout failed during banking settlement.",
                    db=db,
                )
                reconciliation.retry_payout(ticket.id, service=self, db=db)

            # A booking becomes CLOSED only when payout is SUCCESSFUL AND ack is CONFIRMED
            booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
            if (
                booking
                and trustpay.artist_payout_status == "SUCCESSFUL"
                and trustpay.artist_ack_status == "CONFIRMED"
            ):
                booking.status = "CLOSED"
                db.commit()

            log_event(
                booking_id=booking_id,
                actor="SYSTEM",
                action="STANDBY_CHECKED",
                details={
                    "event": "PAYOUT_SYNCED",
                    "status": new_status,
                    "reference": status_res.get("reference"),
                },
                db=db,
            )

            return status_res
        finally:
            if should_close:
                db.close()

    def artist_acknowledge(
        self,
        booking_id: str,
        confirmed: bool,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Record artist payout acknowledgment (CONFIRMED or DISPUTED).

        Booking becomes CLOSED only when payout is SUCCESSFUL and ack is CONFIRMED.
        """
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            trustpay = (
                db.query(TrustPayRow).filter(TrustPayRow.booking_id == booking_id).first()
            )
            if not trustpay:
                raise ValueError(f"TrustPay record for booking '{booking_id}' not found.")

            ack_status = "CONFIRMED" if confirmed else "DISPUTED"
            trustpay.artist_ack_status = ack_status

            booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
            if (
                booking
                and trustpay.artist_payout_status == "SUCCESSFUL"
                and ack_status == "CONFIRMED"
            ):
                booking.status = "CLOSED"

            db.commit()

            log_event(
                booking_id=booking_id,
                actor="SYSTEM",
                action="ARTIST_APPROVED" if confirmed else "ARTIST_DECLINED",
                details={
                    "event": "ARTIST_ACKNOWLEDGEMENT",
                    "ack_status": ack_status,
                    "booking_status": booking.status if booking else None,
                },
                db=db,
            )

            return {
                "booking_id": booking_id,
                "artist_ack_status": ack_status,
                "booking_status": booking.status if booking else None,
            }
        finally:
            if should_close:
                db.close()

    def handle_non_receipt_claim(
        self,
        booking_id: str,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Investigate non-receipt claims by inspecting txn_id, beneficiary, and provider.

        Never treats organizer payment RECEIVED as proof of artist receipt.
        """
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            trustpay = (
                db.query(TrustPayRow).filter(TrustPayRow.booking_id == booking_id).first()
            )
            if not trustpay:
                raise ValueError(f"No TrustPay record found for booking '{booking_id}'.")

            if not trustpay.payout_id:
                findings = {
                    "finding": "PAYOUT_NOT_INITIATED",
                    "details": "Organizer funds received in escrow, but payout has not been released.",
                    "txn_id": trustpay.txn_id,
                    "beneficiary": None,
                    "status": "NOT_STARTED",
                }
            else:
                payout_info = self.provider.get_payout_status(trustpay.payout_id)
                beneficiary = payout_info.get("beneficiary", "")
                payout_status = payout_info.get("status")

                if "MISMATCHED" in beneficiary:
                    findings = {
                        "finding": "BENEFICIARY_MISMATCH",
                        "details": f"Payout routed to mismatched account: {beneficiary}",
                        "txn_id": trustpay.txn_id,
                        "beneficiary": beneficiary,
                        "status": payout_status,
                        "reference": payout_info.get("reference"),
                    }
                elif payout_status == "PENDING":
                    findings = {
                        "finding": "PAYOUT_PENDING",
                        "details": "Payout is processing in banking settlement queue.",
                        "txn_id": trustpay.txn_id,
                        "beneficiary": beneficiary,
                        "status": payout_status,
                        "reference": payout_info.get("reference"),
                    }
                elif payout_status == "SUCCESSFUL":
                    findings = {
                        "finding": "PAYOUT_SUCCESSFUL_WITH_REFERENCE",
                        "details": f"Settled under bank reference {payout_info.get('reference')}.",
                        "txn_id": trustpay.txn_id,
                        "beneficiary": beneficiary,
                        "status": payout_status,
                        "reference": payout_info.get("reference"),
                    }
                else:
                    findings = {
                        "finding": "PAYOUT_FAILED",
                        "details": "Payout failed in banking network.",
                        "txn_id": trustpay.txn_id,
                        "beneficiary": beneficiary,
                        "status": payout_status,
                        "reference": payout_info.get("reference"),
                    }

            log_event(
                booking_id=booking_id,
                actor="SYSTEM",
                action="STANDBY_CHECKED",
                details={"event": "NON_RECEIPT_INVESTIGATION", "findings": findings},
                db=db,
            )

            return findings
        finally:
            if should_close:
                db.close()
