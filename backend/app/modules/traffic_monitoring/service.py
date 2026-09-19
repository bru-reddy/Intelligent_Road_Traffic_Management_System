from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.traffic import TrafficRecord
from app.modules.traffic_monitoring.providers.tomtom import TomTomProvider


DEFAULT_MONITORING_ROADS = [
    {
        "road_name": "Outer Ring Road",
        "latitude": 17.3850,
        "longitude": 78.4867,
    },
    {
        "road_name": "Gachibowli Main Road",
        "latitude": 17.4401,
        "longitude": 78.3489,
    },
    {
        "road_name": "Hitech City Road",
        "latitude": 17.4435,
        "longitude": 78.3772,
    },
    {
        "road_name": "LB Nagar Junction",
        "latitude": 17.3527,
        "longitude": 78.5510,
    },
    {
        "road_name": "Secunderabad S.D. Road",
        "latitude": 17.4399,
        "longitude": 78.4983,
    },
]


class TrafficMonitoringService:
    def __init__(self, db: Session):
        self.db = db
        self.tomtom = TomTomProvider()

    @staticmethod
    def _validate_coordinates(
        latitude: float,
        longitude: float,
    ) -> None:
        latitude = float(latitude)
        longitude = float(longitude)

        if not -90 <= latitude <= 90:
            raise ValueError("Latitude must be between -90 and 90.")

        if not -180 <= longitude <= 180:
            raise ValueError("Longitude must be between -180 and 180.")

    @staticmethod
    def _clean_road_name(road_name: Any) -> str:
        value = str(road_name or "").strip()

        if not value:
            raise ValueError("Road name cannot be empty.")

        return value

    @staticmethod
    def _safe_float(value: Any) -> Optional[float]:
        if value is None:
            return None

        try:
            result = float(value)
        except (TypeError, ValueError):
            return None

        return result

    @staticmethod
    def calculate_congestion(
        avg_speed_kmph: float,
        free_flow_speed_kmph: float,
    ) -> str:
        avg_speed = float(avg_speed_kmph)
        free_flow_speed = float(free_flow_speed_kmph)

        if free_flow_speed <= 0:
            return "unknown"

        ratio = avg_speed / free_flow_speed

        if ratio >= 0.75:
            return "low"

        if ratio >= 0.50:
            return "medium"

        if ratio >= 0.25:
            return "high"

        return "severe"

    @staticmethod
    def serialize_record(
        record: TrafficRecord,
    ) -> Dict[str, Any]:
        return {
            "id": record.id,
            "road_name": record.road_name,
            "latitude": record.latitude,
            "longitude": record.longitude,
            "vehicle_count": record.vehicle_count,
            "avg_speed_kmph": record.avg_speed_kmph,
            "free_flow_speed_kmph": record.free_flow_speed_kmph,
            "current_speed": record.avg_speed_kmph,
            "free_flow_speed": record.free_flow_speed_kmph,
            "congestion_level": record.congestion_level,
            "data_source": record.data_source,
            "recorded_at": (
                record.recorded_at.isoformat()
                if record.recorded_at
                else None
            ),
            "updated_at": (
                record.updated_at.isoformat()
                if getattr(record, "updated_at", None)
                else None
            ),
        }

    def get_live_traffic(
        self,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        limit = max(1, min(int(limit), 500))

        records = (
            self.db.query(TrafficRecord)
            .order_by(TrafficRecord.recorded_at.desc())
            .limit(limit)
            .all()
        )

        return [
            self.serialize_record(record)
            for record in records
        ]

    @staticmethod
    def _normalize_tomtom_observation(
        observation: Dict[str, Any],
        fallback_road: Dict[str, Any],
    ) -> Dict[str, Any]:
        road_name = (
            observation.get("road_name")
            or fallback_road.get("road_name")
            or "Unknown Road"
        )

        latitude = TrafficMonitoringService._safe_float(
            observation.get("latitude")
        )

        longitude = TrafficMonitoringService._safe_float(
            observation.get("longitude")
        )

        if latitude is None:
            latitude = TrafficMonitoringService._safe_float(
                fallback_road.get("latitude")
            )

        if longitude is None:
            longitude = TrafficMonitoringService._safe_float(
                fallback_road.get("longitude")
            )

        if latitude is None or longitude is None:
            raise ValueError(
                f"Invalid coordinates for {road_name}."
            )

        TrafficMonitoringService._validate_coordinates(
            latitude,
            longitude,
        )

        current_speed = observation.get("current_speed")

        if current_speed is None:
            current_speed = observation.get("currentSpeed")

        if current_speed is None:
            current_speed = observation.get("avg_speed_kmph")

        free_flow_speed = observation.get("free_flow_speed")

        if free_flow_speed is None:
            free_flow_speed = observation.get("freeFlowSpeed")

        if free_flow_speed is None:
            free_flow_speed = observation.get(
                "free_flow_speed_kmph"
            )

        current_speed = TrafficMonitoringService._safe_float(
            current_speed
        )

        free_flow_speed = TrafficMonitoringService._safe_float(
            free_flow_speed
        )

        if current_speed is None:
            raise ValueError(
                f"TomTom did not provide a valid current speed "
                f"for {road_name}."
            )

        if current_speed < 0:
            raise ValueError(
                f"Invalid current speed for {road_name}."
            )

        if free_flow_speed is None or free_flow_speed <= 0:
            free_flow_speed = current_speed

        congestion_level = observation.get("congestion_level")

        if not congestion_level:
            congestion_level = (
                TrafficMonitoringService.calculate_congestion(
                    current_speed,
                    free_flow_speed,
                )
            )

        vehicle_count = observation.get("vehicle_count")

        if vehicle_count is None:
            vehicle_count = observation.get("vehicleCount", 0)

        try:
            vehicle_count = max(
                0,
                int(vehicle_count or 0),
            )
        except (TypeError, ValueError):
            vehicle_count = 0

        return {
            "road_name": str(road_name).strip(),
            "latitude": latitude,
            "longitude": longitude,
            "vehicle_count": vehicle_count,
            "avg_speed_kmph": round(current_speed, 2),
            "free_flow_speed_kmph": round(
                free_flow_speed,
                2,
            ),
            "current_speed": round(
                current_speed,
                2,
            ),
            "free_flow_speed": round(
                free_flow_speed,
                2,
            ),
            "travel_time": observation.get("travel_time"),
            "confidence": observation.get("confidence"),
            "congestion_level": str(
                congestion_level
            ).lower(),
            "road_closed": bool(
                observation.get(
                    "road_closed",
                    observation.get(
                        "roadClosed",
                        False,
                    ),
                )
            ),
            "coordinates": observation.get(
                "coordinates",
                [],
            ),
            "data_source": "tomtom",
            "recorded_at": datetime.now(
                timezone.utc
            ).isoformat(),
        }

    def _get_monitoring_roads(
        self,
        roads: Optional[List[Dict[str, Any]]],
    ) -> List[Dict[str, Any]]:
        resolved = roads if roads else DEFAULT_MONITORING_ROADS

        valid_roads: List[Dict[str, Any]] = []

        for road in resolved:
            if not isinstance(road, dict):
                continue

            road_name = str(
                road.get("road_name", "")
            ).strip()

            latitude = self._safe_float(
                road.get("latitude")
            )

            longitude = self._safe_float(
                road.get("longitude")
            )

            if not road_name:
                continue

            if latitude is None or longitude is None:
                continue

            try:
                self._validate_coordinates(
                    latitude,
                    longitude,
                )
            except ValueError:
                continue

            valid_roads.append(
                {
                    "road_name": road_name,
                    "latitude": latitude,
                    "longitude": longitude,
                }
            )

        if not valid_roads:
            return [
                dict(road)
                for road in DEFAULT_MONITORING_ROADS
            ]

        return valid_roads

    def get_live_traffic_tomtom(
        self,
        roads: Optional[List[Dict[str, Any]]] = None,
        state: Optional[str] = None,
        area: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        # A selected monitoring area is represented by the road segment
        # closest to its coordinates. TomTom's Flow Segment Data API
        # supports exactly this point-based lookup.
        if latitude is not None and longitude is not None:
            selected_name = (
                str(area or "Selected monitoring area").strip()
                or "Selected monitoring area"
            )

            monitoring_roads = [
                {
                    "road_name": selected_name,
                    "latitude": float(latitude),
                    "longitude": float(longitude),
                }
            ]
        else:
            monitoring_roads = self._get_monitoring_roads(roads)

        results: List[Dict[str, Any]] = []

        for road in monitoring_roads:
            try:
                live = self.tomtom.get_live_traffic(
                    road_name=road["road_name"],
                    latitude=road["latitude"],
                    longitude=road["longitude"],
                )

                if not isinstance(live, dict):
                    raise ValueError(
                        "TomTom returned an invalid response."
                    )

                normalized = self._normalize_tomtom_observation(
                    live,
                    road,
                )

                if state:
                    normalized["state"] = str(state).strip()

                if area:
                    normalized["area"] = str(area).strip()

                results.append(normalized)

            except Exception as exc:
                print(
                    f"TomTom traffic failed for "
                    f"{road['road_name']}: {exc}"
                )

                # The seeded Hyderabad observations remain available
                # as a transparent demo fallback. They are used only
                # for the default Hyderabad monitoring scope or when
                # the selected road exactly matches a seeded road.
                normalized_state = (
                    str(state or "").strip().lower()
                )
                normalized_area = (
                    str(area or "").strip().lower()
                )

                use_hyderabad_demo = (
                    not normalized_state
                    or normalized_state == "telangana"
                ) and (
                    not normalized_area
                    or normalized_area in {
                        "hyderabad",
                        "telangana",
                    }
                )

                if use_hyderabad_demo:
                    fallback = (
                        self.db.query(TrafficRecord)
                        .filter(
                            TrafficRecord.data_source == "demo-live"
                        )
                        .order_by(
                            TrafficRecord.recorded_at.desc()
                        )
                        .all()
                    )

                    fallback_by_road = {
                        record.road_name.strip().lower(): record
                        for record in fallback
                    }

                    demo_record = fallback_by_road.get(
                        road["road_name"].strip().lower()
                    )

                    if demo_record is not None:
                        demo = self.serialize_record(
                            demo_record
                        )
                        demo["state"] = "Telangana"
                        demo["area"] = (
                            "Hyderabad"
                            if normalized_area != "telangana"
                            else "Telangana"
                        )
                        results.append(demo)
                        continue

                    # Hyderabad is the seeded demo scope. For that
                    # scope, preserve the five configured monitoring
                    # points rather than returning an empty dashboard.
                    if normalized_area == "hyderabad":
                        for record in fallback:
                            demo = self.serialize_record(record)
                            demo["state"] = "Telangana"
                            demo["area"] = "Hyderabad"
                            if not any(
                                point.get("id") == demo.get("id")
                                for point in results
                            ):
                                results.append(demo)

        return results

    def ingest_traffic(
        self,
        road_name: str,
        latitude: float,
        longitude: float,
        vehicle_count: int,
        avg_speed_kmph: float,
        free_flow_speed_kmph: float,
        data_source: str = "manual",
    ) -> Dict[str, Any]:
        road_name = self._clean_road_name(road_name)

        self._validate_coordinates(
            latitude,
            longitude,
        )

        try:
            vehicle_count = max(
                0,
                int(vehicle_count),
            )
        except (TypeError, ValueError) as exc:
            raise ValueError(
                "Vehicle count must be a valid integer."
            ) from exc

        try:
            avg_speed_kmph = float(avg_speed_kmph)
            free_flow_speed_kmph = float(
                free_flow_speed_kmph
            )
        except (TypeError, ValueError) as exc:
            raise ValueError(
                "Speed values must be valid numbers."
            ) from exc

        if avg_speed_kmph < 0:
            raise ValueError(
                "Average speed cannot be negative."
            )

        if free_flow_speed_kmph < 0:
            raise ValueError(
                "Free-flow speed cannot be negative."
            )

        data_source = str(
            data_source or "manual"
        ).strip()

        if not data_source:
            data_source = "manual"

        congestion_level = self.calculate_congestion(
            avg_speed_kmph,
            free_flow_speed_kmph,
        )

        record = TrafficRecord(
            road_name=road_name,
            latitude=float(latitude),
            longitude=float(longitude),
            vehicle_count=vehicle_count,
            avg_speed_kmph=avg_speed_kmph,
            free_flow_speed_kmph=free_flow_speed_kmph,
            congestion_level=congestion_level,
            data_source=data_source,
            recorded_at=datetime.now(timezone.utc),
        )

        try:
            self.db.add(record)
            self.db.commit()
            self.db.refresh(record)
        except Exception:
            self.db.rollback()
            raise

        return self.serialize_record(record)

    def store_tomtom_observations(
        self,
        observations: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        stored: List[TrafficRecord] = []

        for observation in observations:
            if not isinstance(observation, dict):
                continue

            current_speed = self._safe_float(
                observation.get(
                    "avg_speed_kmph",
                    observation.get("current_speed"),
                )
            )

            if current_speed is None:
                continue

            if current_speed < 0:
                continue

            free_flow_speed = self._safe_float(
                observation.get(
                    "free_flow_speed_kmph",
                    observation.get("free_flow_speed"),
                )
            )

            if free_flow_speed is None or free_flow_speed <= 0:
                free_flow_speed = current_speed

            road_name = self._clean_road_name(
                observation.get(
                    "road_name",
                    "Unknown Road",
                )
            )

            latitude = self._safe_float(
                observation.get("latitude")
            )

            longitude = self._safe_float(
                observation.get("longitude")
            )

            if latitude is None or longitude is None:
                continue

            try:
                self._validate_coordinates(
                    latitude,
                    longitude,
                )
            except ValueError:
                continue

            try:
                vehicle_count = max(
                    0,
                    int(
                        observation.get(
                            "vehicle_count",
                            0,
                        )
                        or 0
                    ),
                )
            except (TypeError, ValueError):
                vehicle_count = 0

            congestion_level = observation.get(
                "congestion_level"
            )

            if not congestion_level:
                congestion_level = self.calculate_congestion(
                    current_speed,
                    free_flow_speed,
                )

            record = TrafficRecord(
                road_name=road_name,
                latitude=latitude,
                longitude=longitude,
                vehicle_count=vehicle_count,
                avg_speed_kmph=current_speed,
                free_flow_speed_kmph=free_flow_speed,
                congestion_level=str(
                    congestion_level
                ).lower(),
                data_source="tomtom",
                recorded_at=datetime.now(
                    timezone.utc
                ),
            )

            self.db.add(record)
            stored.append(record)

        if stored:
            try:
                self.db.commit()

                for record in stored:
                    self.db.refresh(record)

            except Exception:
                self.db.rollback()
                raise

        return [
            self.serialize_record(record)
            for record in stored
        ]

    def get_road_utilization(
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
            average_speed = float(
                row.average_speed_kmph or 0
            )

            free_flow_speed = float(
                row.average_free_flow_speed_kmph or 0
            )

            utilization = 0.0

            if free_flow_speed > 0:
                utilization = max(
                    0.0,
                    min(
                        100.0,
                        (
                            1
                            - (
                                average_speed
                                / free_flow_speed
                            )
                        )
                        * 100,
                    ),
                )

            results.append(
                {
                    "road_name": row.road_name,
                    "average_vehicle_count": round(
                        float(
                            row.average_vehicle_count or 0
                        ),
                        2,
                    ),
                    "average_speed_kmph": round(
                        average_speed,
                        2,
                    ),
                    "average_free_flow_speed_kmph": round(
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
                    "congestion_level": (
                        self.calculate_congestion(
                            average_speed,
                            free_flow_speed,
                        )
                        if free_flow_speed > 0
                        else "unknown"
                    ),
                }
            )

        return results
