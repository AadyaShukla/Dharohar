"""Reconciliation system handling failed payouts, disputes, retries, and refunds."""

from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from backend.audit import log_event
from backend.database import BookingRow, ReconciliationTicketRow, SessionLocal, TrustPayRow


def open_ticket(
    booking_id: str,
    reason: str,
    db: Optional[Session] = None,
) -> ReconciliationTicketRow:
    """Open an automated reconciliation ticket for a failed payout or dispute."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        ticket = ReconciliationTicketRow(
            booking_id=booking_id,
            reason=reason,
            status="OPEN",
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)

        log_event(
            booking_id=booking_id,
            actor="SYSTEM",
            action="STANDBY_CHECKED",
            details={
                "event": "RECONCILIATION_TICKET_OPENED",
                "ticket_id": ticket.id,
                "reason": reason,
            },
            db=db,
        )

        try:
            from backend.notifications.service import notify_dispute_opened
            notify_dispute_opened(booking_id=booking_id, ticket_id=ticket.id, reason=reason, db=db)
        except Exception:
            pass

        return ticket
    finally:
        if should_close:
            db.close()


def retry_payout(
    ticket_id: int,
    service: Optional[Any] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Retry a failed payout for an existing reconciliation ticket."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        ticket = (
            db.query(ReconciliationTicketRow)
            .filter(ReconciliationTicketRow.id == ticket_id)
            .first()
        )
        if not ticket:
            raise ValueError(f"Reconciliation ticket #{ticket_id} not found.")

        ticket.status = "RETRYING"
        db.commit()

        if service:
            payout_res = service.release_payout(ticket.booking_id, db=db)
            if payout_res.get("status") in ["PENDING", "SUCCESSFUL"]:
                ticket.status = "RESOLVED"
                db.commit()
                try:
                    from backend.notifications.service import notify_dispute_resolved
                    notify_dispute_resolved(booking_id=ticket.booking_id, ticket_id=ticket_id, resolution="Payout retry successful", db=db)
                except Exception:
                    pass

        log_event(
            booking_id=ticket.booking_id,
            actor="SYSTEM",
            action="STANDBY_CHECKED",
            details={
                "event": "RECONCILIATION_RETRY",
                "ticket_id": ticket_id,
                "new_status": ticket.status,
            },
            db=db,
        )

        return {
            "ticket_id": ticket.id,
            "status": ticket.status,
            "simulated": True,
        }
    finally:
        if should_close:
            db.close()


def refund_booking(
    ticket_id: int,
    service: Optional[Any] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Execute an idempotent refund back to organizer for a disputed or cancelled booking."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        ticket = (
            db.query(ReconciliationTicketRow)
            .filter(ReconciliationTicketRow.id == ticket_id)
            .first()
        )
        if not ticket:
            raise ValueError(f"Reconciliation ticket #{ticket_id} not found.")

        trustpay = (
            db.query(TrustPayRow).filter(TrustPayRow.booking_id == ticket.booking_id).first()
        )
        booking = (
            db.query(BookingRow).filter(BookingRow.id == ticket.booking_id).first()
        )

        # Idempotency check: if already refunded, return existing record
        if trustpay and trustpay.organizer_payment_status == "REFUNDED" and ticket.status == "REFUNDED":
            return {
                "ticket_id": ticket.id,
                "status": "REFUNDED",
                "refund_id": trustpay.refund_id,
                "booking_status": booking.status if booking else "CANCELLED",
                "simulated": False,
            }

        refund_res: Dict[str, Any] = {}
        if service and trustpay and trustpay.order_id:
            total_refund_paise = trustpay.amount + trustpay.platform_fee_paise + trustpay.fee_gst_paise
            refund_res = service.provider.refund(
                trustpay.order_id,
                payment_id=trustpay.txn_id,
                amount_paise=total_refund_paise,
                notes={"ticket_id": str(ticket_id), "booking_id": ticket.booking_id},
            )
            if trustpay:
                trustpay.organizer_payment_status = "REFUNDED"
                trustpay.refund_id = refund_res.get("refund_id")
                trustpay.refund_amount = total_refund_paise

        ticket.status = "REFUNDED"
        if booking:
            booking.status = "CANCELLED"

        db.commit()

        log_event(
            booking_id=ticket.booking_id,
            actor="SYSTEM",
            action="ORGANIZER_APPROVED_CHANGE",
            details={
                "event": "BOOKING_REFUNDED",
                "ticket_id": ticket_id,
                "reason": ticket.reason,
                "refund_id": refund_res.get("refund_id"),
            },
            db=db,
        )

        try:
            from backend.notifications.service import notify_dispute_resolved, notify_refund_processed
            if trustpay:
                notify_refund_processed(
                    booking_id=ticket.booking_id,
                    refund_id=str(trustpay.refund_id or ticket_id),
                    amount_paise=trustpay.refund_amount,
                    db=db,
                )
            notify_dispute_resolved(
                booking_id=ticket.booking_id,
                ticket_id=ticket_id,
                resolution=f"Booking refunded to organizer ({ticket.reason})",
                db=db,
            )
        except Exception:
            pass

        return {
            "ticket_id": ticket.id,
            "status": "REFUNDED",
            "refund_id": refund_res.get("refund_id"),
            "booking_status": booking.status if booking else "CANCELLED",
            "simulated": refund_res.get("simulated", True),
        }
    finally:
        if should_close:
            db.close()


def reconcile_with_razorpay(
    provider: Any,
    days: int = 7,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Periodic reconciliation job comparing DB records to Razorpay for the last N days.

    Fetches payments and transfers from Razorpay, checks for status mismatches against
    TrustPayRow, and opens a reconciliation ticket on any discrepancy.
    """
    from datetime import datetime, timedelta

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        since_time = datetime.utcnow() - timedelta(days=days)
        records = provider.fetch_reconciliation_records(days=days) if hasattr(provider, "fetch_reconciliation_records") else {"payments": [], "transfers": []}

        rzp_payments = {p.get("order_id"): p for p in records.get("payments", []) if p.get("order_id")}
        rzp_transfers = {t.get("id"): t for t in records.get("transfers", []) if t.get("id")}

        # Query trustpay records from the window
        trustpay_rows = (
            db.query(TrustPayRow)
            .filter(TrustPayRow.updated_at >= since_time)
            .all()
        )

        reconciled_count = 0
        mismatches_found = 0
        tickets_opened: list[int] = []

        for tp in trustpay_rows:
            reconciled_count += 1
            # 1. Check payment status
            if tp.order_id and tp.order_id in rzp_payments:
                payment = rzp_payments[tp.order_id]
                rzp_status = payment.get("status")  # captured, failed, etc.
                if rzp_status == "captured" and tp.organizer_payment_status == "NOT_PAID":
                    mismatches_found += 1
                    t = open_ticket(
                        booking_id=tp.booking_id,
                        reason=f"Reconciliation mismatch: Razorpay shows payment {payment.get('id')} captured, but DB is NOT_PAID.",
                        db=db,
                    )
                    tp.organizer_payment_status = "RECEIVED"
                    tp.txn_id = payment.get("id")
                    tickets_opened.append(t.id)

            # 2. Check transfer/payout status
            if tp.payout_id and tp.payout_id in rzp_transfers:
                transfer = rzp_transfers[tp.payout_id]
                trf_status = transfer.get("status")  # processed, failed, reversed
                if trf_status in ["failed", "reversed"] and tp.artist_payout_status != "FAILED":
                    mismatches_found += 1
                    t = open_ticket(
                        booking_id=tp.booking_id,
                        reason=f"Reconciliation mismatch: Razorpay transfer {tp.payout_id} failed ({trf_status}).",
                        db=db,
                    )
                    tp.artist_payout_status = "FAILED"
                    tickets_opened.append(t.id)
                elif trf_status == "processed" and tp.artist_payout_status == "PENDING":
                    tp.artist_payout_status = "SUCCESSFUL"

        db.commit()

        log_event(
            booking_id="SYSTEM",
            actor="SYSTEM",
            action="STANDBY_CHECKED",
            details={
                "event": "RECONCILIATION_RUN_COMPLETED",
                "days": days,
                "reconciled": reconciled_count,
                "mismatches": mismatches_found,
                "tickets_opened": len(tickets_opened),
            },
            db=db,
        )

        return {
            "reconciled": reconciled_count,
            "mismatches_found": mismatches_found,
            "tickets_opened": tickets_opened,
        }
    finally:
        if should_close:
            db.close()


def escalate(
    ticket_id: int,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Escalate a reconciliation ticket for human investigation."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        ticket = (
            db.query(ReconciliationTicketRow)
            .filter(ReconciliationTicketRow.id == ticket_id)
            .first()
        )
        if not ticket:
            raise ValueError(f"Reconciliation ticket #{ticket_id} not found.")

        ticket.status = "ESCALATED"
        db.commit()

        log_event(
            booking_id=ticket.booking_id,
            actor="SYSTEM",
            action="STANDBY_CHECKED",
            details={
                "event": "TICKET_ESCALATED",
                "ticket_id": ticket_id,
                "reason": ticket.reason,
            },
            db=db,
        )

        return {
            "ticket_id": ticket.id,
            "status": "ESCALATED",
            "simulated": True,
        }
    finally:
        if should_close:
            db.close()
