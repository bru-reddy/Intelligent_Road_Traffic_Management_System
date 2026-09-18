from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.traffic import TrafficRecord


class AnalyticsService:
    """
    Service layer for IRTMS traffic analytics.

    Provides:
    - Heatmap data
    - Road performance
    - Traffic trends
    - Congestion and utilization calculations
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_heatmap(
        self,
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        limit = self._normalize_limit(
            limit,
            minimum=1,
            maximum=2000,
        )

        records = (
            self.db.query(TrafficRecord)
            .filter(
                TrafficRecord.latitude.isnot(None),
                TrafficRecord.longitude.isnot(None),
            )
            .order_by(
                TrafficRecord.recorded_at.desc()
            )
            .limit(limit)
            .all()
        )

        heatmap: List[Dict[str, Any]] = []

        for record in records:
            latitude = self._safe_float(
                record.latitude
            )

            longitude = self._safe_float(
                record.longitude
            )

            if latitude is None or longitude is None:
                continue

            if not -90.0 <= latitude <= 90.0:
                continue

            if not -180.0 <= longitude <= 180.0:
                continue

            congestion_level = (
                self._normalize_congestion(
                    record.congestion_level
                )
            )

            heatmap.append(
                {
                    "latitude": latitude,
                    "longitude": longitude,
                    "road_name": (
                        record.road_name
                        or "Unknown road"
                    ),
                    "intensity": (
                        self._congestion_intensity(
                            congestion_level
                        )
                    ),
                    "congestion_level": (
                        congestion_level
                    ),
                    "vehicle_count": int(
                        record.vehicle_count or 0
                    ),
                    "avg_speed_kmph": (
                        self._safe_float(
                            record.avg_speed_kmph,
                            default=0.0,
                        )
                    ),
                    "free_flow_speed_kmph": (
                        self._safe_float(
                            record.free_flow_speed_kmph,
                            default=0.0,
                        )
                    ),
                    "recorded_at": (
                        record.recorded_at.isoformat()
                        if record.recorded_at
                        else None
                    ),
                    "data_source": (
                        record.data_source
                        or "unknown"
                    ),
                }
            )

        return heatmap

    def get_road_performance(
        self,
    ) -> List[Dict[str, Any]]:
        rows = (
            self.db.query(
                TrafficRecord.road_name,
                func.avg(
                    TrafficRecord.vehicle_count
                ).label(
                    "average_vehicle_count"
                ),
                func.avg(
                    TrafficRecord.avg_speed_kmph
                ).label(
                    "average_speed_kmph"
                ),
                func.avg(
                    TrafficRecord.free_flow_speed_kmph
                ).label(
                    "average_free_flow_speed_kmph"
                ),
                func.count(
                    TrafficRecord.id
                ).label(
                    "observation_count"
                ),
            )
            .filter(
                TrafficRecord.road_name.isnot(None)
            )
            .group_by(
                TrafficRecord.road_name
            )
            .order_by(
                TrafficRecord.road_name
            )
            .all()
        )

        results: List[Dict[str, Any]] = []

        for row in rows:
            average_vehicle_count = (
                self._safe_float(
                    row.average_vehicle_count,
                    default=0.0,
                )
                or 0.0
            )

            average_speed = (
                self._safe_float(
                    row.average_speed_kmph,
                    default=0.0,
                )
                or 0.0
            )

            free_flow_speed = (
                self._safe_float(
                    row.average_free_flow_speed_kmph,
                    default=0.0,
                )
                or 0.0
            )

            if free_flow_speed > 0:
                speed_ratio = (
                    average_speed
                    / free_flow_speed
                )

                utilization = max(
                    0.0,
                    min(
                        100.0,
                        (
                            1.0
                            - speed_ratio
                        )
                        * 100.0,
                    ),
                )
            else:
                speed_ratio = 0.0
                utilization = 0.0

            results.append(
                {
                    "road_name": (
                        row.road_name
                        or "Unknown road"
                    ),
                    "average_vehicle_count": round(
                        average_vehicle_count,
                        2,
                    ),
                    "average_speed_kmph": round(
                        average_speed,
                        2,
                    ),
                    "free_flow_speed_kmph": round(
                        free_flow_speed,
                        2,
                    ),
                    "utilization_percentage": round(
                        utilization,
                        2,
                    ),
                    "observation_count": int(
                        row.observation_count or 0
                    ),
                    "performance": (
                        self._performance_label(
                            speed_ratio
                        )
                    ),
                }
            )

        return results

    def get_trends(
        self,
        hours: int = 24,
    ) -> Dict[str, Any]:
        """
        Return hourly traffic trends.

        The service first checks the requested recent period.
        If no observations exist in that period, it falls back
        to the available historical traffic records so imported
        historical data remains visible in Analytics.
        """

        try:
            hours = int(hours)
        except (
            TypeError,
            ValueError,
        ) as exc:
            raise ValueError(
                "Hours must be a valid integer."
            ) from exc

        if hours < 1:
            raise ValueError(
                "Hours must be at least 1."
            )

        if hours > 8760:
            raise ValueError(
                "Hours cannot exceed 8760."
            )

        end_time = datetime.now(
            timezone.utc
        )

        start_time = (
            end_time
            - timedelta(hours=hours)
        )

        recent_records = (
            self.db.query(TrafficRecord)
            .filter(
                TrafficRecord.recorded_at.isnot(None),
                TrafficRecord.recorded_at >= start_time,
                TrafficRecord.recorded_at <= end_time,
            )
            .order_by(
                TrafficRecord.recorded_at.asc()
            )
            .all()
        )

        using_historical_fallback = False

        if recent_records:
            records = recent_records
        else:
            records = (
                self.db.query(TrafficRecord)
                .filter(
                    TrafficRecord.recorded_at.isnot(None)
                )
                .order_by(
                    TrafficRecord.recorded_at.asc()
                )
                .all()
            )

            using_historical_fallback = bool(
                records
            )

        grouped: Dict[
            str,
            Dict[str, List[float]],
        ] = defaultdict(
            lambda: {
                "vehicle_count": [],
                "speed": [],
                "congestion_values": [],
            }
        )

        for record in records:
            timestamp = record.recorded_at

            if timestamp is None:
                continue

            timestamp = self._normalize_datetime(
                timestamp
            )

            bucket = timestamp.replace(
                minute=0,
                second=0,
                microsecond=0,
            )

            bucket_key = bucket.isoformat()

            vehicle_count = (
                self._safe_float(
                    record.vehicle_count,
                    default=0.0,
                )
                or 0.0
            )

            speed = (
                self._safe_float(
                    record.avg_speed_kmph,
                    default=0.0,
                )
                or 0.0
            )

            congestion_value = (
                self._congestion_numeric(
                    record.congestion_level
                )
            )

            grouped[bucket_key][
                "vehicle_count"
            ].append(
                vehicle_count
            )

            grouped[bucket_key][
                "speed"
            ].append(
                speed
            )

            grouped[bucket_key][
                "congestion_values"
            ].append(
                congestion_value
            )

        trend_data: List[
            Dict[str, Any]
        ] = []

        for timestamp in sorted(
            grouped.keys()
        ):
            values = grouped[
                timestamp
            ]

            vehicle_counts = (
                values["vehicle_count"]
            )

            speeds = values["speed"]

            congestion_values = (
                values["congestion_values"]
            )

            trend_data.append(
                {
                    "timestamp": timestamp,
                    "average_vehicle_count": round(
                        sum(vehicle_counts)
                        / len(vehicle_counts),
                        2,
                    )
                    if vehicle_counts
                    else 0.0,
                    "average_speed_kmph": round(
                        sum(speeds)
                        / len(speeds),
                        2,
                    )
                    if speeds
                    else 0.0,
                    "congestion_index": round(
                        sum(congestion_values)
                        / len(congestion_values),
                        2,
                    )
                    if congestion_values
                    else 0.0,
                }
            )

        if trend_data:
            actual_start = (
                trend_data[0]["timestamp"]
            )

            actual_end = (
                trend_data[-1]["timestamp"]
            )
        else:
            actual_start = (
                start_time.isoformat()
            )

            actual_end = (
                end_time.isoformat()
            )

        return {
            "period_hours": hours,
            "start_time": actual_start,
            "end_time": actual_end,
            "observation_count": len(records),
            "historical_fallback": (
                using_historical_fallback
            ),
            "trends": trend_data,
        }

    @staticmethod
    def _normalize_congestion(
        congestion_level: Optional[str],
    ) -> str:
        value = str(
            congestion_level or ""
        ).strip().lower()

        aliases = {
            "normal": "low",
            "light": "low",
            "moderate": "medium",
            "heavy": "high",
            "critical": "severe",
        }

        value = aliases.get(
            value,
            value,
        )

        if value in {
            "low",
            "medium",
            "high",
            "severe",
        }:
            return value

        return "low"

    @staticmethod
    def _congestion_numeric(
        congestion_level: Optional[str],
    ) -> float:
        values = {
            "low": 1.0,
            "medium": 2.0,
            "high": 3.0,
            "severe": 4.0,
        }

        normalized = (
            AnalyticsService._normalize_congestion(
                congestion_level
            )
        )

        return values.get(
            normalized,
            1.0,
        )

    @staticmethod
    def _congestion_intensity(
        congestion_level: Optional[str],
    ) -> float:
        values = {
            "low": 0.25,
            "medium": 0.50,
            "high": 0.75,
            "severe": 1.0,
        }

        normalized = (
            AnalyticsService._normalize_congestion(
                congestion_level
            )
        )

        return values.get(
            normalized,
            0.25,
        )

    @staticmethod
    def _performance_label(
        speed_ratio: float,
    ) -> str:
        if speed_ratio >= 0.75:
            return "Good"

        if speed_ratio >= 0.50:
            return "Moderate"

        if speed_ratio >= 0.25:
            return "Poor"

        return "Critical"

    @staticmethod
    def _safe_float(
        value: Any,
        default: Optional[float] = None,
    ) -> Optional[float]:
        try:
            result = float(value)

            if not np_is_finite(result):
                return default

            return result

        except (
            TypeError,
            ValueError,
        ):
            return default

    @staticmethod
    def _normalize_limit(
        value: int,
        minimum: int,
        maximum: int,
    ) -> int:
        try:
            value = int(value)
        except (
            TypeError,
            ValueError,
        ) as exc:
            raise ValueError(
                "Limit must be a valid integer."
            ) from exc

        return max(
            minimum,
            min(
                value,
                maximum,
            ),
        )

    @staticmethod
    def _normalize_datetime(
        value: datetime,
    ) -> datetime:
        if value.tzinfo is None:
            return value.replace(
                tzinfo=timezone.utc
            )

        return value.astimezone(
            timezone.utc
        )


def np_is_finite(
    value: float,
) -> bool:
    return value == value and value not in (
        float("inf"),
        float("-inf"),
    )