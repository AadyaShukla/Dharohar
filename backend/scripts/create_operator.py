"""CLI script to create the first real Dharohar operator user without fake seed data."""

from __future__ import annotations

import argparse
import sys
import uuid

from backend.database import SessionLocal, UserRow


def mask_phone(phone: str) -> str:
    """Mask phone showing only the first 2 and last 2 digits."""
    clean = phone.strip()
    if len(clean) >= 6:
        return f"{clean[:2]}{'*' * (len(clean) - 4)}{clean[-2:]}"
    return f"{'*' * len(clean)}"


def create_operator(name: str, phone: str) -> UserRow:
    """Create and persist a new OPERATOR user in the database."""
    name = name.strip()
    phone = phone.strip()

    if not name:
        raise ValueError("Operator name cannot be empty.")
    if not phone or len(phone) < 8:
        raise ValueError("Operator phone must be at least 8 digits.")

    db = SessionLocal()
    try:
        existing = db.query(UserRow).filter(UserRow.phone == phone).first()
        if existing:
            if existing.role == "OPERATOR":
                print(
                    f"Operator already exists: ID='{existing.id}', "
                    f"Name='{existing.name}', Phone={mask_phone(existing.phone)}"
                )
                return existing
            raise ValueError(
                f"Phone {mask_phone(phone)} is already registered under role '{existing.role}'."
            )

        operator_id = f"user_operator_{uuid.uuid4().hex[:8]}"
        user = UserRow(
            id=operator_id,
            name=name,
            phone=phone,
            role="OPERATOR",
            artist_id=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        print(
            f"Successfully created operator user:\n"
            f"  ID:    {user.id}\n"
            f"  Name:  {user.name}\n"
            f"  Role:  {user.role}\n"
            f"  Phone: {mask_phone(user.phone)}"
        )
        return user
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create the first real Dharohar operator user without fake seed data."
    )
    parser.add_argument(
        "--name",
        type=str,
        help="Full name of the operator",
    )
    parser.add_argument(
        "--phone",
        type=str,
        help="Phone number of the operator (digits only)",
    )

    args = parser.parse_args()

    name = args.name
    phone = args.phone

    if not name:
        try:
            name = input("Enter operator full name: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            return 1

    if not phone:
        try:
            phone = input("Enter operator phone number: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            return 1

    try:
        create_operator(name=name, phone=phone)
        return 0
    except Exception as e:
        print(f"Error creating operator: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
