from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from app.core.database import Base, SessionLocal, engine
from app.models.traffic import TrafficRecord
from app.models.user import (
    ROLE_COMMONER,
    ROLE_COMMISSIONER,
    ROLE_SYSTEM_OPERATOR,
    ROLE_TRAFFIC_OPERATOR,
    User,
)


Base.metadata.create_all(bind=engine)


ROAD_POINTS = [
    {
        "road_name": "Outer Ring Road",
        "latitude": 17.4485,
        "longitude": 78.3908,
        "free_flow_speed": 80.0,
    },
    {
        "road_name": "Ring Road",
        "latitude": 17.4065,
        "longitude": 78.4772,
        "free_flow_speed": 60.0,
    },
    {
        "road_name": "MG Road",
        "latitude": 17.4375,
        "longitude": 78.4483,
        "free_flow_speed": 50.0,
    },
]


def congestion_from_speed(
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


def seed_traffic_records(
    db,
    records_per_road: int = 25,
) -> int:
    existing_count = (
        db.query(TrafficRecord).count()
    )

    if existing_count >= 50:
        print(
            "Traffic data already contains "
            f"{existing_count} records. "
            "Skipping traffic seed."
        )
        return 0

    random.seed(42)

    now = datetime.now(timezone.utc)
    created = 0

    for road in ROAD_POINTS:
        for index in range(records_per_road):
            recorded_at = (
                now - timedelta(hours=24 - index)
            )

            free_flow = float(
                road["free_flow_speed"]
            )

            speed_factor = random.uniform(
                0.30,
                0.95,
            )

            speed = round(
                free_flow * speed_factor,
                2,
            )

            vehicle_count = random.randint(
                25,
                220,
            )

            congestion = congestion_from_speed(
                speed,
                free_flow,
            )

            record = TrafficRecord(
                road_name=road["road_name"],
                latitude=road["latitude"],
                longitude=road["longitude"],
                vehicle_count=vehicle_count,
                avg_speed_kmph=speed,
                free_flow_speed_kmph=free_flow,
                congestion_level=congestion,
                data_source="seed",
                recorded_at=recorded_at,
            )

            db.add(record)
            created += 1

    db.commit()

    return created


def seed_demo_users(db) -> int:
    demo_users = [
        {
            "full_name": "IRTMS Commoner",
            "email": "commoner@irtms.local",
            "password": "Commoner@123",
            "role": ROLE_COMMONER,
        },
        {
            "full_name": "IRTMS Traffic Operator",
            "email": "trafficoperator@irtms.local",
            "password": "TrafficOperator@123",
            "role": ROLE_TRAFFIC_OPERATOR,
        },
        {
            "full_name": "IRTMS System Operator",
            "email": "systemoperator@irtms.local",
            "password": "SystemOperator@123",
            "role": ROLE_SYSTEM_OPERATOR,
        },
        {
            "full_name": "IRTMS Commissioner",
            "email": "commissioner@irtms.local",
            "password": "Commissioner@123",
            "role": ROLE_COMMISSIONER,
        },
    ]

    from app.core.security import hash_password

    created = 0

    for item in demo_users:
        existing = (
            db.query(User)
            .filter(
                User.email == item["email"]
            )
            .first()
        )

        if existing:
            continue

        user = User(
            full_name=item["full_name"],
            email=item["email"],
            password_hash=hash_password(
                item["password"]
            ),
            role=item["role"],
            is_active=True,
        )

        db.add(user)
        created += 1

    db.commit()

    return created


def main() -> None:
    db = SessionLocal()

    try:
        traffic_created = seed_traffic_records(db)
        users_created = seed_demo_users(db)

        print(
            "IRTMS seed completed successfully."
        )
        print(
            f"Traffic records created: "
            f"{traffic_created}"
        )
        print(
            f"Demo users created: "
            f"{users_created}"
        )

        print("\nDemo login accounts:")

        print(
            "Commoner:          "
            "commoner@irtms.local / Commoner@123"
        )

        print(
            "Traffic Operator:  "
            "trafficoperator@irtms.local / "
            "TrafficOperator@123"
        )

        print(
            "System Operator:   "
            "systemoperator@irtms.local / "
            "SystemOperator@123"
        )

        print(
            "Commissioner:      "
            "commissioner@irtms.local / "
            "Commissioner@123"
        )

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()