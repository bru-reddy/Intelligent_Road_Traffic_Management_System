"""
IRTMS demo-data seeder for the deployed PostgreSQL database.

Seeds:
- 84 TomTom Hyderabad 2025 citywide historical observations
- 5 explicitly marked current demo observations for live-monitoring fallback
- 10 traffic alerts

The historical source is citywide/metro aggregate data, not road-segment data.
The script is idempotent.
"""

from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

from app.core.database import Base, SessionLocal, engine
from app.models.alert import Alert
from app.models.traffic import TrafficRecord


HISTORICAL_SOURCE = (
    "TomTom Traffic Index - Hyderabad 2025; "
    "aggregate; vehicle_count_proxy"
)
LIVE_SOURCE = "demo-live"
FREE_FLOW_SPEED = 40.0

DATA_FILE = (
    Path(__file__).resolve().parent
    / "data"
    / "hyderabad_traffic_real_2025_tomtom.csv"
)

LIVE_POINTS = [
    ("Outer Ring Road", 17.3850, 78.4867, 128, 31.5, 55.0),
    ("Hitech City Road", 17.4435, 78.3772, 176, 24.0, 50.0),
    ("Gachibowli Main Road", 17.4401, 78.3489, 154, 27.5, 48.0),
    ("LB Nagar Junction", 17.3527, 78.5510, 198, 21.0, 50.0),
    ("Secunderabad S.D. Road", 17.4399, 78.4983, 112, 34.0, 52.0),
]

ALERTS = [
    ("Hayathnagar", "NH 65", "high", "high", 32.6, 65.2, 17.3281, 78.6045,
     "Heavy morning traffic reported along NH 65 near Hayathnagar, causing significant reduction in vehicle speeds."),
    ("Ghatkesar", "NH 163", "medium", "medium", 42.0, 60.0, 17.4500, 78.6800,
     "Moderate traffic buildup on NH 163 near Ghatkesar due to increased morning commuter movement."),
    ("Uppal", "Uppal Main Road", "critical", "critical", 20.0, 65.0, 17.4050, 78.5590,
     "Severe congestion detected around Uppal Main Road with very low vehicle speeds and substantial traffic delays."),
    ("LB Nagar", "LB Nagar Junction", "high", "high", 28.5, 60.0, 17.3527, 78.5510,
     "Heavy traffic accumulation at LB Nagar Junction is causing prolonged delays and reduced traffic flow."),
    ("Gachibowli", "Gachibowli Main Road", "medium", "medium", 38.0, 55.0, 17.4401, 78.3489,
     "Moderate congestion observed on Gachibowli Main Road, affecting traffic movement through the commercial district."),
    ("Hitech City", "Hitech City Road", "low", "low", 52.0, 60.0, 17.4435, 78.3772,
     "Light traffic slowdown detected on Hitech City Road with traffic continuing to move at relatively stable speeds."),
    ("Madhapur", "Madhapur Road", "high", "high", 25.0, 55.0, 17.4483, 78.3915,
     "Increasing evening traffic on Madhapur Road is causing substantial delays near major commercial and office areas."),
    ("Kukatpally", "NH 65", "critical", "critical", 18.0, 60.0, 17.4948, 78.3996,
     "Severe evening congestion detected on NH 65 near Kukatpally, resulting in very low average vehicle speeds."),
    ("Mehdipatnam", "Mehdipatnam–Tolichowki Road", "high", "high", 27.0, 60.0, 17.3950, 78.4280,
     "Heavy evening traffic between Mehdipatnam and Tolichowki is causing significant delays and restricted vehicle movement."),
    ("Secunderabad", "S.D. Road", "medium", "medium", 40.0, 55.0, 17.4399, 78.4983,
     "Moderate nighttime congestion reported on S.D. Road with reduced speeds around the central Secunderabad area."),
]


def classify(speed: float, free_flow: float) -> str:
    ratio = speed / free_flow if free_flow > 0 else 0
    if ratio >= 0.75:
        return "low"
    if ratio >= 0.50:
        return "medium"
    if ratio >= 0.25:
        return "high"
    return "critical"


def vehicle_proxy(speed: float) -> int:
    # Explicitly a proxy for demo analytics, not a measured count.
    return max(20, round(40 + (FREE_FLOW_SPEED - speed) * 4))


def seed_historical(db) -> int:
    exists = (
        db.query(TrafficRecord)
        .filter(TrafficRecord.data_source == HISTORICAL_SOURCE)
        .count()
    )
    if exists:
        return 0

    if not DATA_FILE.exists():
        raise FileNotFoundError(DATA_FILE)

    inserted = 0
    with DATA_FILE.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            speed = float(row["average_speed_kmph"])
            hour = int(row["hour"])

            db.add(
                TrafficRecord(
                    road_name="Hyderabad City Aggregate",
                    latitude=17.3850,
                    longitude=78.4867,
                    vehicle_count=vehicle_proxy(speed),
                    avg_speed_kmph=round(speed, 3),
                    free_flow_speed_kmph=FREE_FLOW_SPEED,
                    congestion_level=classify(speed, FREE_FLOW_SPEED),
                    data_source=HISTORICAL_SOURCE,
                    recorded_at=datetime(
                        2025, 1, 1, hour, 0, 0,
                        tzinfo=timezone.utc,
                    ),
                )
            )
            inserted += 1

    return inserted


def seed_live_demo(db) -> int:
    exists = (
        db.query(TrafficRecord)
        .filter(TrafficRecord.data_source == LIVE_SOURCE)
        .count()
    )
    if exists:
        return 0

    now = datetime.now(timezone.utc)

    for road, lat, lon, vehicles, speed, free_flow in LIVE_POINTS:
        db.add(
            TrafficRecord(
                road_name=road,
                latitude=lat,
                longitude=lon,
                vehicle_count=vehicles,
                avg_speed_kmph=speed,
                free_flow_speed_kmph=free_flow,
                congestion_level=classify(speed, free_flow),
                data_source=LIVE_SOURCE,
                recorded_at=now,
            )
        )

    return len(LIVE_POINTS)


def seed_alerts(db) -> int:
    existing = {row.road_name for row in db.query(Alert).all()}
    inserted = 0
    now = datetime.now(timezone.utc)

    for (
        area, road, congestion, severity, speed, free_flow,
        lat, lon, message
    ) in ALERTS:
        if road in existing:
            continue

        db.add(
            Alert(
                alert_type="traffic_congestion",
                area=area,
                road_name=road,
                congestion_level=congestion,
                current_speed_kmph=speed,
                free_flow_speed_kmph=free_flow,
                severity=severity,
                latitude=lat,
                longitude=lon,
                message=message,
                status="active",
                detected_at=now,
            )
        )
        inserted += 1

    return inserted


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        historical = seed_historical(db)
        live = seed_live_demo(db)
        alerts = seed_alerts(db)
        db.commit()

        print(
            "IRTMS demo seed completed: "
            f"{historical} historical, "
            f"{live} live-demo, "
            f"{alerts} alerts."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
