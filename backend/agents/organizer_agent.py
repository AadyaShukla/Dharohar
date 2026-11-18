"""Organizer agent representing organizer budget, finding artists, and proposing offers."""

import json
from datetime import date
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.agents.llm import LLMRetryExhaustedError, llm_call
from backend.agents.tools import execute_tool, get_tool_schemas
from backend.database import ArtistRow, BookingRow, SessionLocal

ORGANIZER_SYSTEM_PROMPT = """You are Dharohar's Organizer Agent.
You represent the event organizer's budget and requirements.
Your tasks:
1. Find artists for each requested role (e.g. dance group, folk musician).
2. Propose offers using propose_offer.
3. If an offer is rejected, inspect the violations and adjust the proposed terms.
4. If an artist is unavailable (e.g. blackout date), use list_standby_candidates and check_standby_candidate.
5. NEVER claim or assume a booking is confirmed or approved. You can ONLY propose offers.
6. The organizer will have final say on approvals and payments.
"""


def run_organizer_agent(
    booking_id: str,
    request: Dict[str, Any],
    db: Optional[Session] = None,
    max_iterations: int = 8,
) -> Dict[str, Any]:
    """Execute the organizer agent tool-calling loop.

    Returns a structured dictionary mapping each requested role to:
    - artist_id: str or None
    - price: int or None
    - status: "VALID" | "NEEDS_ORGANIZER_APPROVAL" | "NO_CANDIDATE"
    - reasons: list of str
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        # Normalize requested roles
        raw_roles = request.get("roles", [])
        if not raw_roles and "art_form" in request:
            raw_roles = [
                {
                    "role": request.get("role", "main"),
                    "art_form": request["art_form"],
                    "budget": request.get("price_budget", request.get("budget", 15000)),
                    "event_date": request.get("event_date", str(date.today())),
                    "distance_km": request.get("distance_km", 100),
                    "duration_minutes": request.get("duration_minutes", 60),
                    "group_size": request.get("group_size", 6),
                }
            ]

        # Track status per role
        role_state: Dict[str, Dict[str, Any]] = {}
        for r in raw_roles:
            role_name = r.get("role", r.get("art_form", "unnamed_role"))
            role_state[role_name] = {
                "role_config": r,
                "artist_id": None,
                "price": None,
                "status": "NO_CANDIDATE",
                "reasons": [],
            }

        messages: List[Dict[str, Any]] = [
            {
                "role": "user",
                "content": (
                    f"Organizer Booking ID: {booking_id}\n"
                    f"Event Requirements:\n{json.dumps(request, indent=2)}\n"
                    "Please search for artists and propose offers for each requested role."
                ),
            }
        ]

        tools = get_tool_schemas()

        for iteration in range(max_iterations):
            # Check if all roles are already resolved
            all_resolved = all(
                state["status"] in ["VALID", "NEEDS_ORGANIZER_APPROVAL"]
                for state in role_state.values()
            )
            if all_resolved and iteration > 0:
                break

            try:
                response = llm_call(
                    system_prompt=ORGANIZER_SYSTEM_PROMPT,
                    messages=messages,
                    tools=tools,
                )
            except LLMRetryExhaustedError:
                raise
            except Exception as e:
                # Scripted provider ended or offline test error
                break

            tool_calls = response.get("tool_calls", [])
            assistant_text = response.get("text")

            messages.append(
                {
                    "role": "assistant",
                    "content": assistant_text or f"Executing {len(tool_calls)} actions.",
                }
            )

            if not tool_calls:
                break

            for tc in tool_calls:
                t_name = tc.get("name")
                t_args = tc.get("arguments", {})

                try:
                    tool_result = execute_tool(t_name, t_args, db=db)
                except Exception as ex:
                    tool_result = {"error": str(ex)}

                messages.append(
                    {
                        "role": "user",
                        "content": f"Tool '{t_name}' result:\n{json.dumps(tool_result, default=str)}",
                    }
                )

                # Update role states based on tool execution
                if t_name == "propose_offer":
                    art_id = t_args.get("artist_id")
                    price = t_args.get("price")
                    # Match to role
                    matched_role = None
                    artist_row = db.query(ArtistRow).filter(ArtistRow.id == art_id).first() if db else None
                    artist_art_form = artist_row.art_form.lower() if artist_row else ""

                    # First check if artist_id is already assigned to a role
                    for r_name, r_info in role_state.items():
                        if r_info["artist_id"] == art_id:
                            matched_role = r_name
                            break

                    # Second check if art_form matches a role's requested art_form or role name
                    if not matched_role and artist_art_form:
                        for r_name, r_info in role_state.items():
                            req_af = r_info["role_config"].get("art_form", "").lower()
                            req_role = r_name.lower()
                            if (
                                (req_af and (req_af in artist_art_form or artist_art_form in req_af))
                                or (req_role and (req_role in artist_art_form or artist_art_form in req_role))
                            ):
                                matched_role = r_name
                                break

                    # Fallback: first role that is not yet VALID
                    if not matched_role:
                        for r_name, r_info in role_state.items():
                            if r_info["status"] != "VALID":
                                matched_role = r_name
                                break

                    if not matched_role:
                        matched_role = list(role_state.keys())[0]

                    if tool_result.get("valid") is True:
                        role_state[matched_role]["artist_id"] = art_id
                        role_state[matched_role]["price"] = price
                        role_state[matched_role]["status"] = "VALID"
                        role_state[matched_role]["reasons"] = []
                    else:
                        role_state[matched_role]["artist_id"] = art_id
                        role_state[matched_role]["price"] = price
                        role_state[matched_role]["status"] = "NO_CANDIDATE"
                        violations = tool_result.get("violations", [])
                        role_state[matched_role]["reasons"] = [
                            v.get("message", str(v)) for v in violations
                        ]

                elif t_name == "check_standby_candidate":
                    art_id = t_args.get("candidate_artist_id")
                    price = t_args.get("offered_price")
                    eligible = tool_result.get("eligible", False)
                    needs_approval = tool_result.get("needs_organizer_approval", False)
                    reasons = tool_result.get("approval_reasons", [])

                    # Find corresponding role
                    target_role = list(role_state.keys())[0]
                    for r_name in role_state.keys():
                        if role_state[r_name]["status"] != "VALID":
                            target_role = r_name
                            break

                    if eligible and needs_approval:
                        role_state[target_role]["artist_id"] = art_id
                        role_state[target_role]["price"] = price
                        role_state[target_role]["status"] = "NEEDS_ORGANIZER_APPROVAL"
                        role_state[target_role]["reasons"] = reasons
                    elif eligible and not needs_approval:
                        role_state[target_role]["artist_id"] = art_id
                        role_state[target_role]["price"] = price
                        role_state[target_role]["status"] = "VALID"
                        role_state[target_role]["reasons"] = []
                    else:
                        role_state[target_role]["status"] = "NO_CANDIDATE"
                        hard_fails = tool_result.get("hard_failures", [])
                        role_state[target_role]["reasons"] = [
                            f.get("message", str(f)) for f in hard_fails
                        ]

        # Prepare final clean structure
        summary_roles = {}
        for r_name, r_data in role_state.items():
            summary_roles[r_name] = {
                "artist_id": r_data["artist_id"],
                "price": r_data["price"],
                "status": r_data["status"],
                "reasons": r_data["reasons"],
            }

        return {
            "booking_id": booking_id,
            "roles": summary_roles,
        }
    finally:
        if should_close:
            db.close()
