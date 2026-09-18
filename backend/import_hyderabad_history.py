from __future__ import annotations

import csv
import sys
from datetime import datetime, timezone
from pathlib import Path

from app.core.database import SessionLocal
from app.models.traffic import TrafficRecord


SOURCE_NAME = "TomTom Traffic Index - Hyderabad 2025"
ROAD_NAME = "Hyderabad City Aggregate"

LATITUDE = 17.3850
LONGITUDE = 78.4867

FREE_FLOW_SPEED_KMPH = 40.0


def congestion_from_speed(speed: float) -> str:
    if speed < 0:
        raise ValueError("Average speed cannot be negative.")

    ratio = speed / FREE_FLOW_SPEED_KMPH

    if ratio >= 0.75:
        return "low"
    if ratio >= 0.50:
        return "medium"
    if ratio >= 0.25:
        return "high"

    return "severe"


def parse_record(
    row: dict[str, str],
    row_number: int,
) -> TrafficRecord:

    required_columns = {
        "year",
        "hour",
        "average_speed_kmph",
        "travel_time_minutes_10km",
    }

    missing = [
        column
        for column in required_columns
        if column not in row or row[column] is None
    ]

    if missing:
        raise ValueError(
            f"Row {row_number}: missing columns: "
            f"{', '.join(sorted(missing))}"
        )

    try:
        year = int(row["year"])
        hour = int(row["hour"])
        speed = float(row["average_speed_kmph"])
        travel_time = float(row["travel_time_minutes_10km"])
    except (TypeError, ValueError) as exc:
        raise ValueError(
            f"Row {row_number}: invalid numeric value."
        ) from exc

    if year < 2000 or year > 2100:
        raise ValueError(
            f"Row {row_number}: invalid year: {year}"
        )

    if hour < 0 or hour > 23:
        raise ValueError(
            f"Row {row_number}: hour must be between 0 and 23."
        )

    if speed < 0:
        raise ValueError(
            f"Row {row_number}: speed cannot be negative."
        )

    if travel_time <= 0:
        raise ValueError(
            f"Row {row_number}: travel time must be greater than zero."
        )

    vehicle_proxy = max(
        0,
        round(
            (travel_time / 15.0 - 1.0) * 100
        ),
    )

    recorded_at = datetime(
        year,
        1,
        1,
        hour,
        0,
        0,
        tzinfo=timezone.utc,
    )

    return TrafficRecord(
        road_name=ROAD_NAME,
        latitude=LATITUDE,
        longitude=LONGITUDE,
        vehicle_count=vehicle_proxy,
        avg_speed_kmph=speed,
        free_flow_speed_kmph=FREE_FLOW_SPEED_KMPH,
        congestion_level=congestion_from_speed(speed),
        data_source=(
            f"{SOURCE_NAME}; "
            "aggregate; vehicle_count_proxy"
        ),
        recorded_at=recorded_at,
    )


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(
            "Usage: "
            "python import_hyderabad_history.py <csv-path>"
        )

    csv_path = (
        Path(sys.argv[1])
        .expanduser()
        .resolve()
    )

    if not csv_path.is_file():
        raise SystemExit(
            f"CSV file not found: {csv_path}"
        )

    db = SessionLocal()

    try:
        with csv_path.open(
            "r",
            encoding="utf-8-sig",
            newline="",
        ) as source:

            reader = csv.DictReader(source)

            if not reader.fieldnames:
                raise SystemExit(
                    "CSV does not contain a header row."
                )

            records = []

            for row_number, row in enumerate(
                reader,
                start=2,
            ):
                records.append(
                    parse_record(
                        row,
                        row_number,
                    )
                )

        if not records:
            raise SystemExit(
                "CSV contains no historical rows."
            )

        removed = (
            db.query(TrafficRecord)
            .filter(
                TrafficRecord.data_source.like(
                    f"{SOURCE_NAME}%"
                )
            )
            .delete(
                synchronize_session=False
            )
        )

        db.add_all(records)
        db.commit()

        print(
            f"REMOVED_PREVIOUS_ROWS {removed}"
        )
        print(
            f"IMPORTED_HISTORICAL_ROWS {len(records)}"
        )
        print(
            f"DATA_SOURCE {SOURCE_NAME}"
        )
        print(
            f"TRAINING_ROAD {ROAD_NAME}"
        )

    except SystemExit:
        db.rollback()
        raise

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()