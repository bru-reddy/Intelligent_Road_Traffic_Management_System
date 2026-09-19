"""
IRTMS demo-data seeder for the deployed PostgreSQL database.

Seeds:
- 84 TomTom Hyderabad 2025 citywide historical observations
- 5 explicitly marked current demo observations for live-monitoring fallback
- 10 curated Hyderabad traffic alerts

The historical source is citywide/metro aggregate data, not road-segment data.
The script is idempotent.
- 5 clearly labelled demo traffic alerts for every catalogued Indian city/town except Hyderabad.
"""

from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

from app.core.database import SessionLocal, initialize_database
from app.models.alert import Alert
from app.models.traffic import TrafficRecord


HISTORICAL_SOURCE = (
    "TomTom Traffic Index - Hyderabad 2025; "
    "aggregate; vehicle_count_proxy"
)

LIVE_SOURCE = "demo-live"

FREE_FLOW_SPEED = 40.0


# ---------------------------------------------------------------------------
# Historical dataset
# ---------------------------------------------------------------------------
#
# The CSV contains:
# 7 days x 12 two-hour periods = 84 observations.
#
# File required:
#
# backend/data/hyderabad_traffic_real_2025_tomtom.csv
#
# This is the dataset already prepared for the project.
# ---------------------------------------------------------------------------

INDIA_LOCATION_CATALOG_FILE = (
    Path(__file__).resolve().parent
    / "data"
    / "india_location_catalog.csv"
)


DATA_FILE = (
    Path(__file__).resolve().parent
    / "data"
    / "hyderabad_traffic_real_2025_tomtom.csv"
)


# ---------------------------------------------------------------------------
# Current demo-live monitoring points
# ---------------------------------------------------------------------------
#
# These are NOT historical records.
#
# They are used only when the TomTom live API does not return usable
# traffic data, so the deployed LinkedIn demo still has meaningful
# live-monitoring content.
# ---------------------------------------------------------------------------

LIVE_POINTS = [
    {
        "road_name": "Outer Ring Road",
        "latitude": 17.3850,
        "longitude": 78.4867,
        "vehicle_count": 128,
        "avg_speed_kmph": 31.5,
        "free_flow_speed_kmph": 55.0,
    },
    {
        "road_name": "Hitech City Road",
        "latitude": 17.4435,
        "longitude": 78.3772,
        "vehicle_count": 176,
        "avg_speed_kmph": 24.0,
        "free_flow_speed_kmph": 50.0,
    },
    {
        "road_name": "Gachibowli Main Road",
        "latitude": 17.4401,
        "longitude": 78.3489,
        "vehicle_count": 154,
        "avg_speed_kmph": 27.5,
        "free_flow_speed_kmph": 48.0,
    },
    {
        "road_name": "LB Nagar Junction",
        "latitude": 17.3527,
        "longitude": 78.5510,
        "vehicle_count": 198,
        "avg_speed_kmph": 21.0,
        "free_flow_speed_kmph": 50.0,
    },
    {
        "road_name": "Secunderabad S.D. Road",
        "latitude": 17.4399,
        "longitude": 78.4983,
        "vehicle_count": 112,
        "avg_speed_kmph": 34.0,
        "free_flow_speed_kmph": 52.0,
    },
]


# ---------------------------------------------------------------------------
# Traffic alerts
# ---------------------------------------------------------------------------
#
# Hyderabad keeps its existing curated demo alerts above.
# Every other city/town in the India location catalog receives five
# clearly labelled synthetic demo alerts. These are demonstration records,
# not live provider observations.

CITY_ALERT_VARIANTS = [
    {
        "road_suffix": "Central Corridor",
        "congestion_level": "low",
        "severity": "low",
        "current_speed_kmph": 44.0,
        "free_flow_speed_kmph": 55.0,
        "message_template": (
            "Demo traffic alert: light congestion on {city} Central Corridor."
        ),
    },
    {
        "road_suffix": "Main Arterial",
        "congestion_level": "medium",
        "severity": "medium",
        "current_speed_kmph": 36.0,
        "free_flow_speed_kmph": 55.0,
        "message_template": (
            "Demo traffic alert: moderate congestion on {city} Main Arterial."
        ),
    },
    {
        "road_suffix": "Market Road",
        "congestion_level": "high",
        "severity": "high",
        "current_speed_kmph": 28.0,
        "free_flow_speed_kmph": 55.0,
        "message_template": (
            "Demo traffic alert: high congestion on {city} Market Road."
        ),
    },
    {
        "road_suffix": "Ring Road",
        "congestion_level": "critical",
        "severity": "critical",
        "current_speed_kmph": 20.0,
        "free_flow_speed_kmph": 55.0,
        "message_template": (
            "Demo traffic alert: critical congestion on {city} Ring Road."
        ),
    },
    {
        "road_suffix": "Junction Corridor",
        "congestion_level": "medium",
        "severity": "medium",
        "current_speed_kmph": 33.0,
        "free_flow_speed_kmph": 50.0,
        "message_template": (
            "Demo traffic alert: moderate congestion at the {city} Junction Corridor."
        ),
    },
]


def _read_india_location_catalog():
    if not INDIA_LOCATION_CATALOG_FILE.exists():
        raise FileNotFoundError(
            "India location catalog was not found.\n"
            f"Expected file:\n{INDIA_LOCATION_CATALOG_FILE}"
        )

    with INDIA_LOCATION_CATALOG_FILE.open(
        "r",
        encoding="utf-8",
        newline="",
    ) as handle:
        return list(csv.DictReader(handle))


def seed_city_alerts(db) -> int:
    """
    Seed five synthetic demo alerts for every catalogued city/town except
    Hyderabad. Coordinates are included when the catalog provides them;
    alerts without coordinates remain fully filterable by state and area.
    """

    existing = {
        (
            str(row.state or "").strip().lower(),
            str(row.area or "").strip().lower(),
            str(row.road_name or "").strip().lower(),
        )
        for row in db.query(Alert).all()
    }

    now = datetime.now(timezone.utc)
    inserted = 0

    for row in _read_india_location_catalog():
        state = str(row.get("state") or "").strip()
        city = str(row.get("city_name") or "").strip()

        if not state or not city:
            continue

        if city.casefold() == "hyderabad":
            continue

        try:
            latitude = (
                float(row["latitude"])
                if str(row.get("latitude") or "").strip()
                else None
            )
        except (TypeError, ValueError):
            latitude = None

        try:
            longitude = (
                float(row["longitude"])
                if str(row.get("longitude") or "").strip()
                else None
            )
        except (TypeError, ValueError):
            longitude = None

        for variant in CITY_ALERT_VARIANTS:
            road_name = f"{city} - {variant['road_suffix']}"

            key = (
                state.casefold(),
                city.casefold(),
                road_name.casefold(),
            )

            if key in existing:
                continue

            db.add(
                Alert(
                    alert_type="traffic_congestion",
                    state=state,
                    area=city,
                    road_name=road_name,
                    congestion_level=variant["congestion_level"],
                    current_speed_kmph=variant["current_speed_kmph"],
                    free_flow_speed_kmph=variant["free_flow_speed_kmph"],
                    severity=variant["severity"],
                    latitude=latitude,
                    longitude=longitude,
                    message=variant["message_template"].format(city=city),
                    status="active",
                    detected_at=now,
                )
            )

            existing.add(key)
            inserted += 1

    return inserted


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    # create_all() does not alter existing PostgreSQL tables.
    # initialize_database() also applies the compatibility migration
    # that adds state/area columns to existing deployments.
    initialize_database()

    db = SessionLocal()

    try:

        historical = seed_historical(
            db
        )

        live = seed_live_demo(
            db
        )

        alerts = seed_alerts(
            db
        )

        city_alerts = seed_city_alerts(
            db
        )

        db.commit()

        print(
            "\n"
            "========================================\n"
            "IRTMS DEMO DATA SEED COMPLETE\n"
            "========================================\n"
            f"Historical records inserted: {historical}\n"
            f"Live-demo records inserted: {live}\n"
            f"Curated alerts inserted:     {alerts}\n"
            f"City/town demo alerts inserted: {city_alerts}\n"
            "========================================\n"
        )

    except Exception:

        db.rollback()

        raise

    finally:

        db.close()


if __name__ == "__main__":
    main()
