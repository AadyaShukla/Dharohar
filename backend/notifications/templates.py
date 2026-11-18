"""Notification templates for Dharohar.

ALL notification templates reside in this single file with both Hindi (hi) and English (en) versions.
Supports variable interpolation, quick-reply action buttons, and Meta WhatsApp template mappings.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


TEMPLATES: Dict[str, Dict[str, Dict[str, Any]]] = {
    # -------------------------------------------------------------------------
    # 1. New Offer Awaiting Artist Approval
    # -------------------------------------------------------------------------
    "OFFER_AWAITING_APPROVAL": {
        "hi": {
            "title": "धरोहर: नया बुकिंग प्रस्ताव - स्वीकृति अपेक्षित",
            "body": (
                "नमस्ते {artist_name},\n\n"
                "आपके लिए एक नया बुकिंग प्रस्ताव आया है:\n"
                "• कला विधा: {art_form}\n"
                "• कार्यक्रम दिनांक: {event_date}\n"
                "• समय: {event_time}\n"
                "• अवधि: {duration_minutes} मिनट\n"
                "• मानदेय राशि: ₹{fee_inr}\n\n"
                "कृपया नीचे दिए गए बटन पर टैप करके 24 घंटे के भीतर इस प्रस्ताव को स्वीकार या अस्वीकार करें।"
            ),
            "buttons": [
                {"id": "APPROVE:{approve_token}", "title": "स्वीकारें (Approve)", "action": "APPROVE"},
                {"id": "DECLINE:{decline_token}", "title": "अस्वीकार (Decline)", "action": "DECLINE"},
            ],
            "whatsapp_template_name": "dharohar_offer_approval_hi",
        },
        "en": {
            "title": "Dharohar: New Booking Offer - Action Required",
            "body": (
                "Hello {artist_name},\n\n"
                "You have received a new booking offer:\n"
                "• Art Form: {art_form}\n"
                "• Event Date: {event_date}\n"
                "• Time: {event_time}\n"
                "• Duration: {duration_minutes} mins\n"
                "• Offered Fee: ₹{fee_inr}\n\n"
                "Please tap below to approve or decline this offer within 24 hours."
            ),
            "buttons": [
                {"id": "APPROVE:{approve_token}", "title": "Approve", "action": "APPROVE"},
                {"id": "DECLINE:{decline_token}", "title": "Decline", "action": "DECLINE"},
            ],
            "whatsapp_template_name": "dharohar_offer_approval_en",
        },
    },

    # -------------------------------------------------------------------------
    # 2. Standby Re-confirmation (72 hours pre-event)
    # -------------------------------------------------------------------------
    "STANDBY_RECONFIRMATION": {
        "hi": {
            "title": "धरोहर: स्टैंडबाय उपलब्धता की पुष्टि (72 घंटे पूर्व)",
            "body": (
                "नमस्ते {artist_name},\n\n"
                "धरोहर पर {event_date} को होने वाले {art_form} कार्यक्रम के लिए आप स्टैंडबाय कलाकार के रूप में नामांकित हैं।\n"
                "कृपया पुष्टि करें कि आपकी मंडली आपातकालीन आवश्यकता की स्थिति में उपलब्ध रहेगी।"
            ),
            "buttons": [
                {"id": "STANDBY_CONFIRM:{booking_id}", "title": "उपलब्ध हूँ (Available)", "action": "CONFIRM"},
            ],
            "whatsapp_template_name": "dharohar_standby_reconfirm_hi",
        },
        "en": {
            "title": "Dharohar: Standby Re-confirmation (72h Notice)",
            "body": (
                "Hello {artist_name},\n\n"
                "You are listed as standby candidate for the upcoming {art_form} event on {event_date}.\n"
                "Please confirm your troupe's availability in case the primary artist is unable to perform."
            ),
            "buttons": [
                {"id": "STANDBY_CONFIRM:{booking_id}", "title": "I'm Available", "action": "CONFIRM"},
            ],
            "whatsapp_template_name": "dharohar_standby_reconfirm_en",
        },
    },

    # -------------------------------------------------------------------------
    # 3. Payment Received in Escrow
    # -------------------------------------------------------------------------
    "PAYMENT_RECEIVED": {
        "hi": {
            "title": "धरोहर TrustPay: बुकिंग भुगतान सुरक्षित प्राप्त हुआ",
            "body": (
                "नमस्ते {recipient_name},\n\n"
                "बुकिंग #{booking_id} के लिए ₹{amount_inr} का भुगतान धरोहर TrustPay एस्क्रो खाते में सुरक्षित प्राप्त हो गया है।\n"
                "कला विधा: {art_form}\n"
                "कार्यक्रम दिनांक: {event_date}\n\n"
                "कार्यक्रम सफलतापूर्वक संपन्न होने के बाद मानदेय सीधे कलाकार के खाते में स्थानांतरित कर दिया जाएगा।"
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_payment_received_hi",
        },
        "en": {
            "title": "Dharohar TrustPay: Booking Payment Secured in Escrow",
            "body": (
                "Hello {recipient_name},\n\n"
                "Payment of ₹{amount_inr} for booking #{booking_id} has been safely deposited into Dharohar TrustPay escrow.\n"
                "Art Form: {art_form}\n"
                "Event Date: {event_date}\n\n"
                "Funds are securely locked and will be disbursed directly to the artist upon successful event completion."
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_payment_received_en",
        },
    },

    # -------------------------------------------------------------------------
    # 4. Payout Status Changes (RELEASED, PROCESSED, FAILED)
    # -------------------------------------------------------------------------
    "PAYOUT_STATUS_CHANGED": {
        "hi": {
            "title": "धरोहर: मानदेय भुगतान स्थिति अपडेट ({status_label})",
            "body": (
                "नमस्ते {artist_name},\n\n"
                "बुकिंग #{booking_id} के लिए आपके मानदेय (₹{amount_inr}) का विवरण:\n"
                "स्थिति: {status_label}\n"
                "विवरण: {status_details}\n\n"
                "धरोहर के साथ अपनी प्रामाणिक कला साझा करने के लिए धन्यवाद।"
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_payout_status_hi",
        },
        "en": {
            "title": "Dharohar: Artist Payout Status Update ({status_label})",
            "body": (
                "Hello {artist_name},\n\n"
                "Update on your artist payout of ₹{amount_inr} for booking #{booking_id}:\n"
                "Status: {status_label}\n"
                "Details: {status_details}\n\n"
                "Thank you for sharing your authentic folk traditions on Dharohar."
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_payout_status_en",
        },
    },

    # -------------------------------------------------------------------------
    # 5. Refund Processed
    # -------------------------------------------------------------------------
    "REFUND_PROCESSED": {
        "hi": {
            "title": "धरोहर TrustPay: रिफंड सफलतापूर्वक प्रोसेस हुआ",
            "body": (
                "नमस्ते {organizer_name},\n\n"
                "बुकिंग #{booking_id} के लिए ₹{amount_inr} का रिफंड सफलतापूर्वक प्रोसेस कर दिया गया है।\n"
                "रिफंड संदर्भ संख्या: {refund_id}\n\n"
                "यह राशि 3-5 कार्य दिवसों के भीतर आपके मूल भुगतान स्रोत में दिखाई देगी।"
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_refund_processed_hi",
        },
        "en": {
            "title": "Dharohar TrustPay: Refund Processed Successfully",
            "body": (
                "Hello {organizer_name},\n\n"
                "A refund of ₹{amount_inr} has been successfully processed for booking #{booking_id}.\n"
                "Refund Reference: {refund_id}\n\n"
                "The amount will credit to your original payment method in 3-5 business days."
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_refund_processed_en",
        },
    },

    # -------------------------------------------------------------------------
    # 6. Dispute Opened & Resolved
    # -------------------------------------------------------------------------
    "DISPUTE_OPENED": {
        "hi": {
            "title": "धरोहर सहायता: बुकिंग #{booking_id} पर विवाद दर्ज",
            "body": (
                "धरोहर सूचना:\n\n"
                "बुकिंग #{booking_id} के संबंध में एक विवाद दर्ज किया गया है।\n"
                "टिकट आईडी: #{ticket_id}\n"
                "कारण: {reason}\n\n"
                "एस्क्रो भुगतान की सुरक्षा हेतु इस बुकिंग पर भुगतान अस्थायी रूप से रोक दिया गया है। हमारी संचालन टीम 24 घंटे में आपसे संपर्क करेगी।"
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_dispute_opened_hi",
        },
        "en": {
            "title": "Dharohar Support: Dispute Raised on Booking #{booking_id}",
            "body": (
                "Dharohar Notice:\n\n"
                "A formal dispute has been logged regarding booking #{booking_id}.\n"
                "Ticket ID: #{ticket_id}\n"
                "Reason: {reason}\n\n"
                "Escrow funds are safely placed on hold pending investigation. Our operations team will contact you within 24 hours."
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_dispute_opened_en",
        },
    },
    "DISPUTE_RESOLVED": {
        "hi": {
            "title": "धरोहर सहायता: विवाद का समाधान हुआ (टिकट #{ticket_id})",
            "body": (
                "धरोहर सूचना:\n\n"
                "बुकिंग #{booking_id} के विवाद (टिकट #{ticket_id}) की जांच पूर्ण हो चुकी है और इसका समाधान कर दिया गया है।\n"
                "निर्णय: {resolution}\n\n"
                "अधिक जानकारी के लिए कृपया अपने डैशबोर्ड में जाएं।"
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_dispute_resolved_hi",
        },
        "en": {
            "title": "Dharohar Support: Dispute Resolved (Ticket #{ticket_id})",
            "body": (
                "Dharohar Notice:\n\n"
                "The investigation for booking #{booking_id} dispute (Ticket #{ticket_id}) has been completed and resolved.\n"
                "Resolution: {resolution}\n\n"
                "Please check your dashboard for settlement breakdown."
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_dispute_resolved_en",
        },
    },

    # -------------------------------------------------------------------------
    # 7. Listing Approved & Rejected
    # -------------------------------------------------------------------------
    "LISTING_APPROVED": {
        "hi": {
            "title": "धरोहर: बधाई! आपकी कलाकार प्रोफ़ाइल स्वीकृत और लाइव हो गई है",
            "body": (
                "बधाई हो {artist_name}!\n\n"
                "धरोहर पर आपकी कलाकार प्रोफ़ाइल और वीडियो ऑडिशन की समीक्षा सफलतापूर्वक पूरी हो गई है।\n"
                "विधा: {art_form}\n"
                "सत्यापन स्तर: {tier}\n\n"
                "आपकी प्रोफ़ाइल अब देशभर के आयोजकों के लिए लाइव और उपलब्ध है।"
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_listing_approved_hi",
        },
        "en": {
            "title": "Dharohar: Congratulations! Your Artist Profile is LIVE",
            "body": (
                "Congratulations {artist_name}!\n\n"
                "Your artist profile and audition video review has been successfully approved by the operator.\n"
                "Art Form: {art_form}\n"
                "Verification Tier: {tier}\n\n"
                "Your profile is now LIVE and discoverable by organizers across the country."
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_listing_approved_en",
        },
    },
    "LISTING_REJECTED": {
        "hi": {
            "title": "धरोहर: कलाकार प्रोफ़ाइल समीक्षा अपडेट (सुधार अपेक्षित)",
            "body": (
                "नमस्ते {artist_name},\n\n"
                "आपकी कलाकार प्रोफ़ाइल की समीक्षा के उपरांत कुछ सुधार आवश्यक पाए गए हैं:\n"
                "कारण: {reason}\n\n"
                "कृपया अपनी प्रोफ़ाइल में आवश्यक सुधार कर पुनः समीक्षा हेतु सबमिट करें।"
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_listing_rejected_hi",
        },
        "en": {
            "title": "Dharohar: Artist Profile Review Update (Action Needed)",
            "body": (
                "Hello {artist_name},\n\n"
                "Your artist listing submission requires corrections before it can go live:\n"
                "Feedback: {reason}\n\n"
                "Please update your profile details or upload a new audition video and re-submit."
            ),
            "buttons": [],
            "whatsapp_template_name": "dharohar_listing_rejected_en",
        },
    },
}


class TemplateRenderer:
    """Renders localized notification messages, subjects, and interactive buttons."""

    @classmethod
    def render(
        cls,
        event_type: str,
        context: Dict[str, Any],
        language: str = "hi",
    ) -> Dict[str, Any]:
        """Render localized notification payload for an event."""
        template_group = TEMPLATES.get(event_type)
        if not template_group:
            raise ValueError(f"Unknown notification event type: '{event_type}'")

        lang = "hi" if language.lower().startswith("hi") else "en"
        tpl = template_group.get(lang) or template_group.get("en") or template_group.get("hi")

        title = tpl["title"]
        body = tpl["body"]
        buttons_spec = tpl.get("buttons", [])

        # Safe formatting with fallback to empty string
        safe_ctx = {k: ("" if v is None else str(v)) for k, v in context.items()}

        rendered_title = title
        rendered_body = body
        try:
            rendered_title = title.format_map(safe_ctx)
            rendered_body = body.format_map(safe_ctx)
        except KeyError as e:
            # If any specific key is missing, format as best as possible
            pass

        # Format button IDs with context tokens
        rendered_buttons = []
        for btn in buttons_spec:
            btn_id = btn["id"]
            try:
                btn_id = btn_id.format_map(safe_ctx)
            except Exception:
                pass
            rendered_buttons.append({
                "id": btn_id,
                "title": btn["title"],
                "action": btn.get("action", ""),
            })

        return {
            "event_type": event_type,
            "language": lang,
            "title": rendered_title,
            "body": rendered_body,
            "buttons": rendered_buttons,
            "whatsapp_template_name": tpl.get("whatsapp_template_name"),
            "context": context,
        }
