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

ALERTS = [
    {
        "area": "Hayathnagar",
        "road_name": "NH 65",
        "congestion_level": "high",
        "severity": "high",
        "current_speed_kmph": 32.6,
        "free_flow_speed_kmph": 65.2,
        "latitude": 17.3281,
        "longitude": 78.6045,
        "message": (
            "Heavy morning traffic reported along NH 65 near Hayathnagar, "
            "causing significant reduction in vehicle speeds."
        ),
    },
    {
        "area": "Ghatkesar",
        "road_name": "NH 163",
        "congestion_level": "medium",
        "severity": "medium",
        "current_speed_kmph": 42.0,
        "free_flow_speed_kmph": 60.0,
        "latitude": 17.4500,
        "longitude": 78.6800,
        "message": (
            "Moderate traffic buildup on NH 163 near Ghatkesar due to "
            "increased morning commuter movement."
        ),
    },
    {
        "area": "Uppal",
        "road_name": "Uppal Main Road",
        "congestion_level": "critical",
        "severity": "critical",
        "current_speed_kmph": 20.0,
        "free_flow_speed_kmph": 65.0,
        "latitude": 17.4050,
        "longitude": 78.5590,
        "message": (
            "Severe congestion detected around Uppal Main Road with very "
            "low vehicle speeds and substantial traffic delays."
        ),
    },
    {
        "area": "LB Nagar",
        "road_name": "LB Nagar Junction",
        "congestion_level": "high",
        "severity": "high",
        "current_speed_kmph": 28.5,
        "free_flow_speed_kmph": 60.0,
        "latitude": 17.3527,
        "longitude": 78.5510,
        "message": (
            "Heavy traffic accumulation at LB Nagar Junction is causing "
            "prolonged delays and reduced traffic flow."
        ),
    },
    {
        "area": "Gachibowli",
        "road_name": "Gachibowli Main Road",
        "congestion_level": "medium",
        "severity": "medium",
        "current_speed_kmph": 38.0,
        "free_flow_speed_kmph": 55.0,
        "latitude": 17.4401,
        "longitude": 78.3489,
        "message": (
            "Moderate congestion observed on Gachibowli Main Road, "
            "affecting traffic movement through the commercial district."
        ),
    },
    {
        "area": "Hitech City",
        "road_name": "Hitech City Road",
        "congestion_level": "low",
        "severity": "low",
        "current_speed_kmph": 52.0,
        "free_flow_speed_kmph": 60.0,
        "latitude": 17.4435,
        "longitude": 78.3772,
        "message": (
            "Light traffic slowdown detected on Hitech City Road with "
            "traffic continuing to move at relatively stable speeds."
        ),
    },
    {
        "area": "Madhapur",
        "road_name": "Madhapur Road",
        "congestion_level": "high",
        "severity": "high",
        "current_speed_kmph": 25.0,
        "free_flow_speed_kmph": 55.0,
        "latitude": 17.4483,
        "longitude": 78.3915,
        "message": (
            "Increasing evening traffic on Madhapur Road is causing "
            "substantial delays near major commercial and office areas."
        ),
    },
    {
        "area": "Kukatpally",
        "road_name": "NH 65",
        "congestion_level": "critical",
        "severity": "critical",
        "current_speed_kmph": 18.0,
        "free_flow_speed_kmph": 60.0,
        "latitude": 17.4948,
        "longitude": 78.3996,
        "message": (
            "Severe evening congestion detected on NH 65 near Kukatpally, "
            "resulting in very low average vehicle speeds."
        ),
    },
    {
        "area": "Mehdipatnam",
        "road_name": "Mehdipatnam–Tolichowki Road",
        "congestion_level": "high",
        "severity": "high",
        "current_speed_kmph": 27.0,
        "free_flow_speed_kmph": 60.0,
        "latitude": 17.3950,
        "longitude": 78.4280,
        "message": (
            "Heavy evening traffic between Mehdipatnam and Tolichowki is "
            "causing significant delays and restricted vehicle movement."
        ),
    },
    {
        "area": "Secunderabad",
        "road_name": "S.D. Road",
        "congestion_level": "medium",
        "severity": "medium",
        "current_speed_kmph": 40.0,
        "free_flow_speed_kmph": 55.0,
        "latitude": 17.4399,
        "longitude": 78.4983,
        "message": (
            "Moderate nighttime congestion reported on S.D. Road with "
            "reduced speeds around the central Secunderabad area."
        ),
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def classify_congestion(
    speed: float,
    free_flow_speed: float,
) -> str:
    if free_flow_speed <= 0:
        return "unknown"

    ratio = speed / free_flow_speed

    if ratio >= 0.75:
        return "low"

    if ratio >= 0.50:
        return "medium"

    if ratio >= 0.25:
        return "high"

    return "severe"


def vehicle_proxy(speed: float) -> int:
    """
    Demo-only vehicle-count proxy.

    The historical source contains speed/travel-time information rather
    than measured vehicle counts. This proxy allows the analytics UI to
    display a populated vehicle metric without claiming it is a measured
    count.
    """

    return max(
        20,
        round(
            40 + (FREE_FLOW_SPEED - speed) * 4
        ),
    )


# ---------------------------------------------------------------------------
# Historical traffic
# ---------------------------------------------------------------------------

def seed_historical(db) -> int:
    existing = (
        db.query(TrafficRecord)
        .filter(
            TrafficRecord.data_source == HISTORICAL_SOURCE
        )
        .count()
    )

    if existing:
        print(
            f"Historical traffic already exists: "
            f"{existing} records."
        )
        return 0

    if not DATA_FILE.exists():
        raise FileNotFoundError(
            "Historical dataset was not found.\n"
            f"Expected file:\n{DATA_FILE}\n\n"
            "Create backend/data and upload "
            "hyderabad_traffic_real_2025_tomtom.csv."
        )

    inserted = 0

    with DATA_FILE.open(
        "r",
        encoding="utf-8",
        newline="",
    ) as handle:

        reader = csv.DictReader(handle)

        for row in reader:
            speed = float(
                row["average_speed_kmph"]
            )

            hour = int(
                row["hour"]
            )

            day_name = (
                row.get(
                    "day_of_week",
                    "Monday",
                )
                .strip()
            )

            # Map each weekday to a real 2025 date.
            weekday_dates = {
                "Monday": "2025-01-06",
                "Tuesday": "2025-01-07",
                "Wednesday": "2025-01-08",
                "Thursday": "2025-01-09",
                "Friday": "2025-01-10",
                "Saturday": "2025-01-11",
                "Sunday": "2025-01-12",
            }

            date_string = weekday_dates.get(
                day_name,
                "2025-01-06",
            )

            recorded_at = datetime.fromisoformat(
                f"{date_string}T{hour:02d}:00:00+00:00"
            )

            db.add(
                TrafficRecord(
                    road_name="Hyderabad City Aggregate",
                    state="Telangana",
                    area="Hyderabad",
                    latitude=17.3850,
                    longitude=78.4867,
                    vehicle_count=vehicle_proxy(
                        speed
                    ),
                    avg_speed_kmph=round(
                        speed,
                        3,
                    ),
                    free_flow_speed_kmph=FREE_FLOW_SPEED,
                    congestion_level=classify_congestion(
                        speed,
                        FREE_FLOW_SPEED,
                    ),
                    data_source=HISTORICAL_SOURCE,
                    recorded_at=recorded_at,
                )
            )

            inserted += 1

    return inserted


# ---------------------------------------------------------------------------
# Current demo-live traffic
# ---------------------------------------------------------------------------

def seed_live_demo(db) -> int:
    existing = (
        db.query(TrafficRecord)
        .filter(
            TrafficRecord.data_source == LIVE_SOURCE
        )
        .count()
    )

    if existing:
        print(
            f"Demo-live traffic already exists: "
            f"{existing} records."
        )
        return 0

    now = datetime.now(timezone.utc)

    for point in LIVE_POINTS:

        speed = point[
            "avg_speed_kmph"
        ]

        free_flow = point[
            "free_flow_speed_kmph"
        ]

        db.add(
            TrafficRecord(
                road_name=point[
                    "road_name"
                ],
                state="Telangana",
                area="Hyderabad",
                latitude=point[
                    "latitude"
                ],
                longitude=point[
                    "longitude"
                ],
                vehicle_count=point[
                    "vehicle_count"
                ],
                avg_speed_kmph=speed,
                free_flow_speed_kmph=free_flow,
                congestion_level=classify_congestion(
                    speed,
                    free_flow,
                ),
                data_source=LIVE_SOURCE,
                recorded_at=now,
            )
        )

    return len(LIVE_POINTS)


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

def seed_alerts(db) -> int:
    existing = {
        (
            row.area,
            row.road_name,
        )
        for row in db.query(Alert).all()
    }

    inserted = 0

    now = datetime.now(
        timezone.utc
    )

    for item in ALERTS:

        key = (
            item["area"],
            item["road_name"],
        )

        if key in existing:
            continue

        db.add(
            Alert(
                alert_type="traffic_congestion",
                state="Telangana",
                area=item["area"],
                road_name=item["road_name"],
                congestion_level=item[
                    "congestion_level"
                ],
                current_speed_kmph=item[
                    "current_speed_kmph"
                ],
                free_flow_speed_kmph=item[
                    "free_flow_speed_kmph"
                ],
                severity=item["severity"],
                latitude=item["latitude"],
                longitude=item["longitude"],
                message=item["message"],
                status="active",
                detected_at=now,
            )
        )

        inserted += 1

    return inserted




# ---------------------------------------------------------------------------
# City/town demo alerts
# ---------------------------------------------------------------------------
#
# Hyderabad is excluded because it already has the curated alert set above.
# All other catalogued Indian cities/towns receive five synthetic alerts.
#

CITY_ALERT_VARIANTS = [
    {
        "road_suffix": "Central Corridor",
        "congestion_level": "low",
        "severity": "low",
        "current_speed_kmph": 44.0,
        "free_flow_speed_kmph": 55.0,
        "message_template": "Demo traffic alert: light congestion on {city} Central Corridor.",
    },
    {
        "road_suffix": "Main Arterial",
        "congestion_level": "medium",
        "severity": "medium",
        "current_speed_kmph": 36.0,
        "free_flow_speed_kmph": 55.0,
        "message_template": "Demo traffic alert: moderate congestion on {city} Main Arterial.",
    },
    {
        "road_suffix": "Market Road",
        "congestion_level": "high",
        "severity": "high",
        "current_speed_kmph": 28.0,
        "free_flow_speed_kmph": 55.0,
        "message_template": "Demo traffic alert: high congestion on {city} Market Road.",
    },
    {
        "road_suffix": "Ring Road",
        "congestion_level": "critical",
        "severity": "critical",
        "current_speed_kmph": 20.0,
        "free_flow_speed_kmph": 55.0,
        "message_template": "Demo traffic alert: critical congestion on {city} Ring Road.",
    },
    {
        "road_suffix": "Junction Corridor",
        "congestion_level": "medium",
        "severity": "medium",
        "current_speed_kmph": 33.0,
        "free_flow_speed_kmph": 50.0,
        "message_template": "Demo traffic alert: moderate congestion at the {city} Junction Corridor.",
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

        if not state or not city or city.casefold() == "hyderabad":
            continue

        try:
            latitude = float(row["latitude"]) if str(row.get("latitude") or "").strip() else None
        except (TypeError, ValueError):
            latitude = None

        try:
            longitude = float(row["longitude"]) if str(row.get("longitude") or "").strip() else None
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
