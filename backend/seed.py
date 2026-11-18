# ALL DATA IS FICTIONAL AND SIMULATED
# ALL USERS ARE FICTIONAL.
"""Database seeding module providing fictional folk artist profiles and simulated user accounts."""

from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from backend.database import ArtistRow, OrganizerProfileRow, SessionLocal, UserRow, reset_db

FICTIONAL_ARTISTS = [
    # 4 Dance Groups (min_fee stored in integer paise: 1 INR = 100 paise)
    {
        "id": "dance_kalbelia_01",
        "name": "Surila Kabilo Troupe (Simulated)",
        "art_form": "Kalbelia Dance",
        "city": "Jodhpur",
        "min_fee": 14000 * 100,  # 1,400,000 paise (₹14,000)
        "blackout_dates": ["2026-12-25", "2026-12-31"],
        "travel_range_km": 250,
        "min_duration_minutes": 60,
        "max_group_size": 150,
        "rating": 4.9,
        "languages": ["Hindi", "Rajasthani"],
    },
    {
        "id": "dance_ghoomar_02",
        "name": "Rangilo Ghoomar Mandali (Simulated)",
        "art_form": "Ghoomar Dance",
        "city": "Jaipur",
        "min_fee": 12500 * 100,  # 1,250,000 paise (₹12,500)
        "blackout_dates": [],
        "travel_range_km": 200,
        "min_duration_minutes": 60,
        "max_group_size": 150,
        "rating": 4.8,
        "languages": ["Hindi"],
    },
    {
        "id": "dance_bhavai_03",
        "name": "Matka Nritya Sangeet (Simulated)",
        "art_form": "Bhavai Folk Dance",
        "city": "Udaipur",
        "min_fee": 15000 * 100,  # 1,500,000 paise (₹15,000)
        "blackout_dates": ["2026-11-15"],
        "travel_range_km": 300,
        "min_duration_minutes": 45,
        "max_group_size": 150,
        "rating": 4.9,
        "languages": ["Hindi", "Mewari"],
    },
    {
        "id": "dance_chhau_04",
        "name": "Purulia Mask Dancers (Simulated)",
        "art_form": "Chhau Dance",
        "city": "Ranchi",
        "min_fee": 13500 * 100,  # 1,350,000 paise (₹13,500)
        "blackout_dates": [],
        "travel_range_km": 220,
        "min_duration_minutes": 60,
        "max_group_size": 150,
        "rating": 4.7,
        "languages": ["Hindi", "Bengali"],
    },
    # Folk Musicians
    # Preferred musician (blackout date on Dec 20, 2026)
    {
        "id": "music_manganiyar_01",
        "name": "Desert Sarangi Swar (Simulated)",
        "art_form": "Manganiyar Folk Music",
        "city": "Jaisalmer",
        "min_fee": 11000 * 100,  # 1,100,000 paise (₹11,000)
        "blackout_dates": ["2026-12-20"],  # Blackout date on Dec 20!
        "travel_range_km": 350,
        "min_duration_minutes": 60,
        "max_group_size": 150,
        "rating": 5.0,
        "languages": ["Hindi", "Marwari"],
    },
    # Standby 2: Musician with fee ₹2,000 above budget share (12,000 vs 10,000)
    {
        "id": "music_pandavani_02",
        "name": "Surili Tarang Ballad (Simulated)",
        "art_form": "Manganiyar Folk Music",
        "city": "Jodhpur",
        "min_fee": 12000 * 100,  # 1,200,000 paise (₹12,000)
        "blackout_dates": [],
        "travel_range_km": 250,
        "min_duration_minutes": 60,
        "max_group_size": 150,
        "rating": 4.8,
        "languages": ["Hindi"],
    },
    # Standby 3: Compatible musician, min_fee ₹7,000, within budget
    {
        "id": "music_sarangi_03",
        "name": "Swara Shehnai Ensemble (Simulated)",
        "art_form": "Manganiyar Folk Music",
        "city": "Jaipur",
        "min_fee": 7000 * 100,  # 700,000 paise (₹7,000)
        "blackout_dates": [],
        "travel_range_km": 250,
        "min_duration_minutes": 60,
        "max_group_size": 150,
        "rating": 4.8,
        "languages": ["Hindi"],
    },
    # 2 Puppeteers (Standby 1 is puppet_kathputli_01: puppeteer art form)
    {
        "id": "puppet_kathputli_01",
        "name": "Kathputli Kaarwan (Simulated)",
        "art_form": "Kathputli Puppet Theatre",
        "city": "Jaipur",
        "min_fee": 7000 * 100,  # 700,000 paise (₹7,000)
        "blackout_dates": [],
        "travel_range_km": 200,
        "min_duration_minutes": 45,
        "max_group_size": 150,
        "rating": 4.7,
        "languages": ["Hindi"],
    },
    {
        "id": "puppet_tholu_02",
        "name": "Chhaya Shadow Puppets (Simulated)",
        "art_form": "Tholu Bommalata Shadow Puppetry",
        "city": "Hyderabad",
        "min_fee": 7500 * 100,  # 750,000 paise (₹7,500)
        "blackout_dates": ["2026-12-24"],
        "travel_range_km": 250,
        "min_duration_minutes": 60,
        "max_group_size": 150,
        "rating": 4.8,
        "languages": ["Telugu", "Hindi"],
    },
    # 1 Craft Demonstrator
    {
        "id": "craft_bluepottery_01",
        "name": "Neel Mritika Clay Studio (Simulated)",
        "art_form": "Blue Pottery Craft Demonstration",
        "city": "Jaipur",
        "min_fee": 6000 * 100,  # 600,000 paise (₹6,000)
        "blackout_dates": [],
        "travel_range_km": 100,
        "min_duration_minutes": 60,
        "max_group_size": 150,
        "rating": 4.9,
        "languages": ["Hindi", "English"],
    },
]

# Static phone mapping for deterministic test & demo reference
ARTIST_PHONES = {
    "dance_kalbelia_01": "9000000001",
    "dance_ghoomar_02": "9000000002",
    "dance_bhavai_03": "9000000003",
    "dance_chhau_04": "9000000004",
    "music_manganiyar_01": "9000000005",
    "music_pandavani_02": "9000000006",
    "music_sarangi_03": "9000000007",
    "puppet_kathputli_01": "9000000008",
    "puppet_tholu_02": "9000000009",
    "craft_bluepottery_01": "9000000010",
}

ORGANIZER_PHONE = "9000000099"
OPERATOR_PHONE = "9000000000"
COORDINATOR_PHONE = "9000000088"


def seed_database(db: Optional[Session] = None) -> List[ArtistRow]:
    """Reset database and insert fictional artists and simulated user accounts."""
    reset_db()

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        db.expunge_all()

    try:
        created_artists: List[ArtistRow] = []
        for data in FICTIONAL_ARTISTS:
            artist = ArtistRow(
                **data,
                listing_status="LIVE",
                verification_stage="TRUSTED",
                payout_account_status="ACTIVE",
                state="Rajasthan",
                years_experience=5,
                group_size=6,
                equipment_needed="Standard audio setup, 2 vocal mics, 2 instrument mics.",
                bio=f"Acclaimed traditional folk ensemble dedicated to preserving authentic {data['art_form']} in {data['city']}.",
                video_urls=[f"/uploads/audition_{data['id']}.mp4"],
                photo_urls=[f"/uploads/photo_{data['id']}.jpg"],
                completed_bookings_count=12,
                reliability_score=100.0,
            )
            db.add(artist)
            created_artists.append(artist)

        # ALL USERS ARE FICTIONAL.
        # 1. Create a user for EVERY seeded fictional artist
        for idx, artist_data in enumerate(FICTIONAL_ARTISTS):
            aid = artist_data["id"]
            phone = ARTIST_PHONES.get(aid, f"90000000{idx + 1:02d}")
            user = UserRow(
                id=f"user_{aid}",
                name=artist_data["name"],
                phone=phone,
                role="ARTIST",
                artist_id=aid,
            )
            db.add(user)

        # 2. One ORGANIZER user "Hotel Rajmahal Heritage (fictional)"
        organizer_user = UserRow(
            id="user_organizer_rajmahal",
            name="Hotel Rajmahal Heritage (fictional)",
            phone=ORGANIZER_PHONE,
            role="ORGANIZER",
            artist_id=None,
        )
        db.add(organizer_user)

        org_profile = OrganizerProfileRow(
            id="org_prof_rajmahal",
            user_id="user_organizer_rajmahal",
            organization_name="Hotel Rajmahal Heritage (fictional)",
            org_type="hotel",
            gst_number="08AAAAA0000A1Z5",
            work_email="events@rajmahalheritage.example.com",
            verification_status="VERIFIED",
        )
        db.add(org_profile)

        # 3. One OPERATOR user "Dharohar Operator (demo)"
        operator_user = UserRow(
            id="user_operator_demo",
            name="Dharohar Operator (demo)",
            phone=OPERATOR_PHONE,
            role="OPERATOR",
            artist_id=None,
        )
        db.add(operator_user)

        # 4. One COORDINATOR user "Smt. Sharda Devi (Cultural Coordinator)"
        coordinator_user = UserRow(
            id="user_coordinator_demo",
            name="Smt. Sharda Devi (Cultural Coordinator)",
            phone=COORDINATOR_PHONE,
            role="COORDINATOR",
            artist_id=None,
        )
        db.add(coordinator_user)

        db.commit()
        for artist in created_artists:
            db.refresh(artist)

        return created_artists
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    seeded = seed_database()
    print(f"Successfully seeded {len(seeded)} fictional artists and users.")
