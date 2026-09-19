from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
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


_OSM_ROAD_CACHE: Dict[str, tuple[float, List[Dict[str, Any]]]] = {}
_OSM_ROAD_CACHE_TTL_SECONDS = 1800


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
            "state": getattr(record, "state", None),
            "area": getattr(record, "area", None),
            "latitude": record.latitude,
            "longitude": record.longitude,
            "vehicle_count": record.vehicle_count,
            "avg_speed_kmph": record.avg_speed_kmph,
            "free_flow_speed_kmph": record.free_flow_speed_kmph,
            "current_speed": record.avg_speed_kmph,
            "free_flow_speed": record.free_flow_speed_kmph,
            "congestion_level": record.congestion_level,
            "data_source": record.data_source,
            "data_source_label": (
                "Simulated demo traffic"
                if record.data_source == "simulation-fallback"
                else record.data_source
            ),
            "is_simulated": record.data_source == "simulation-fallback",
            "vehicle_count_estimated": (
                record.data_source == "simulation-fallback"
            ),
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

    @staticmethod
    def _get_osm_road_points(
        latitude: float,
        longitude: float,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Resolve real nearby OpenStreetMap road segments for a selected city.
        These coordinates are used only to place clearly-labelled simulated
        traffic observations on actual roads when TomTom is unavailable.
        """

        import math
        import time
        import requests

        cache_key = f"{float(latitude):.4f}|{float(longitude):.4f}"
        cached = TrafficMonitoringService._OSM_ROAD_CACHE.get(cache_key)
        now = time.time()

        if cached and now - cached[0] < _OSM_ROAD_CACHE_TTL_SECONDS:
            return [dict(item) for item in cached[1]]

        # Keep the lookup deliberately small and focused on named roads.
        # This prevents the monitoring request from waiting on a huge
        # Overpass response for dense cities.
        overpass_query = f"""
[out:json][timeout:5];
way["highway"]["name"~".+"]
  ["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"]
  (around:4000,{float(latitude)},{float(longitude)});
out center tags;
"""

        # One fast primary endpoint is preferable to serially waiting on
        # multiple public Overpass servers. A second endpoint is used only
        # when the first one fails.
        endpoints = [
            ("https://overpass-api.de/api/interpreter", 4),
            ("https://overpass.kumi.systems/api/interpreter", 3),
        ]

        candidates: List[Dict[str, Any]] = []

        for endpoint, timeout_seconds in endpoints:
            try:
                response = requests.post(
                    endpoint,
                    data=overpass_query,
                    headers={
                        "User-Agent": "IRTMS/1.0 (traffic monitoring demo)",
                        "Accept": "application/json",
                    },
                    timeout=timeout_seconds,
                )
                response.raise_for_status()
                payload = response.json()
                elements = payload.get("elements", [])

                for element in elements:
                    center = element.get("center") or {}
                    road_lat = center.get("lat")
                    road_lon = center.get("lon")

                    if road_lat is None or road_lon is None:
                        continue

                    try:
                        road_lat = float(road_lat)
                        road_lon = float(road_lon)
                    except (TypeError, ValueError):
                        continue

                    tags = element.get("tags") or {}
                    road_name = str(tags.get("name") or "").strip()

                    if not road_name:
                        road_name = str(
                            tags.get("ref")
                            or tags.get("highway")
                            or "Unnamed road"
                        ).strip()

                    # Approximate local distance so we can select roads
                    # distributed around the selected city rather than
                    # returning five copies of the same nearby segment.
                    lat_distance = (road_lat - float(latitude)) * 111.0
                    lon_distance = (
                        (road_lon - float(longitude))
                        * 111.0
                        * max(
                            0.15,
                            math.cos(math.radians(float(latitude))),
                        )
                    )
                    distance_km = math.sqrt(
                        lat_distance**2 + lon_distance**2
                    )

                    candidates.append(
                        {
                            "road_name": road_name,
                            "latitude": road_lat,
                            "longitude": road_lon,
                            "distance_km": distance_km,
                            "highway": str(tags.get("highway") or ""),
                        }
                    )

                if candidates:
                    break
            except Exception as exc:
                print(f"OSM road lookup failed at {endpoint}: {exc}")

        # Prefer distinct named roads and keep points geographically spread.
        candidates.sort(
            key=lambda item: (
                item["distance_km"],
                item["road_name"].lower(),
            )
        )

        selected: List[Dict[str, Any]] = []
        seen_names = set()

        for candidate in candidates:
            name_key = candidate["road_name"].strip().lower()

            if name_key in seen_names:
                continue

            # Avoid clustering all five markers on nearly the same point.
            too_close = any(
                abs(candidate["latitude"] - item["latitude"]) < 0.0015
                and abs(candidate["longitude"] - item["longitude"]) < 0.0015
                for item in selected
            )

            if too_close:
                continue

            selected.append(candidate)
            seen_names.add(name_key)

            if len(selected) >= limit:
                break

        if selected:
            TrafficMonitoringService._OSM_ROAD_CACHE[cache_key] = (
                time.time(),
                [dict(item) for item in selected],
            )

        return selected

    @staticmethod
    def _build_simulated_traffic(
        latitude: float,
        longitude: float,
        state: Optional[str],
        area: Optional[str],
    ) -> List[Dict[str, Any]]:
        """
        Provide clearly-labelled simulated observations when the live
        provider is unavailable.

        The important geographic distinction is that simulated traffic is
        attached to real nearby OpenStreetMap road coordinates whenever
        possible. It is still synthetic traffic data and must never be
        presented as a real-world measurement.
        """
        import hashlib
        import math
        import time

        state_name = str(state or "India").strip()
        area_name = str(area or "Selected monitoring area").strip()

        seed_text = f"{state_name}|{area_name}|{latitude:.5f}|{longitude:.5f}"
        seed = int(
            hashlib.sha256(seed_text.encode("utf-8")).hexdigest()[:8],
            16,
        )

        minute_phase = int(time.time() // 60)
        points: List[Dict[str, Any]] = []

        road_points = TrafficMonitoringService._get_osm_road_points(
            latitude=latitude,
            longitude=longitude,
            limit=5,
        )

        # If OSM is temporarily unavailable, retain a geographic fallback
        # around the selected location rather than failing the dashboard.
        used_osm_roads = bool(road_points)

        if not road_points:
            offsets = [
                (-0.008, -0.010),
                (0.006, -0.004),
                (-0.004, 0.008),
                (0.010, 0.006),
                (-0.009, 0.012),
            ]

            corridor_names = [
                "Central Corridor",
                "Main Road Corridor",
                "Market Corridor",
                "Ring Road Corridor",
                "Highway Connector",
            ]

            road_points = [
                {
                    "road_name": f"{area_name} — {corridor_names[index]}",
                    "latitude": float(latitude) + lat_offset,
                    "longitude": float(longitude) + lon_offset,
                }
                for index, (lat_offset, lon_offset) in enumerate(offsets)
            ]

        for index, road in enumerate(road_points[:5]):
            phase = (
                seed % 360
            ) / 57.2958 + (minute_phase + index * 7) * 0.035

            free_flow = 55.0 + ((seed + index * 13) % 16)
            speed_ratio = 0.42 + (
                0.30 * ((math.sin(phase) + 1.0) / 2.0)
            )
            current_speed = max(
                18.0,
                min(
                    free_flow,
                    free_flow * speed_ratio,
                ),
            )

            congestion = TrafficMonitoringService.calculate_congestion(
                current_speed,
                free_flow,
            )

            vehicle_count = int(
                250
                + (1.0 - speed_ratio) * 1100
                + ((seed + index * 97) % 180)
            )

            points.append(
                {
                    "id": f"sim-{seed}-{index}",
                    "road_name": str(
                        road.get("road_name")
                        or f"{area_name} — Road {index + 1}"
                    ),
                    "state": state_name,
                    "area": area_name,
                    "latitude": round(float(road["latitude"]), 6),
                    "longitude": round(float(road["longitude"]), 6),
                    "vehicle_count": vehicle_count,
                    "vehicle_count_estimated": True,
                    "avg_speed_kmph": round(current_speed, 2),
                    "free_flow_speed_kmph": round(free_flow, 2),
                    "current_speed": round(current_speed, 2),
                    "free_flow_speed": round(free_flow, 2),
                    "congestion_level": congestion,
                    "road_status": (
                        "Critical traffic"
                        if congestion == "severe"
                        else "Heavy traffic"
                        if congestion == "high"
                        else "Moderate traffic"
                        if congestion == "medium"
                        else "Free flowing"
                    ),
                    "travel_time": None,
                    "confidence": None,
                    "road_closed": False,
                    "coordinates": [],
                    "data_source": "simulation-fallback",
                    "data_source_label": (
                        "Simulated demo traffic on OpenStreetMap road"
                        if used_osm_roads
                        else "Simulated demo traffic"
                    ),
                    "is_simulated": True,
                    "recorded_at": datetime.now(
                        timezone.utc
                    ).isoformat(),
                }
            )

        return points

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

        if not results and settings.TRAFFIC_SIMULATION_FALLBACK:
            selected = monitoring_roads[0]

            # Generate the fallback before touching the database. The
            # monitoring endpoint must remain useful even when the
            # provider is unavailable or PostgreSQL is temporarily slow.
            try:
                simulated = self._build_simulated_traffic(
                    latitude=selected["latitude"],
                    longitude=selected["longitude"],
                    state=state,
                    area=area,
                )
            except Exception as exc:
                print(f"Simulation traffic generation failed: {exc}")
                simulated = []

            if simulated:
                # Persistence is deliberately best-effort. A database
                # failure must never turn valid generated observations
                # into an empty HTTP response.
                try:
                    current_road_names = {
                        str(observation.get("road_name") or "").strip()
                        for observation in simulated
                    }

                    scope_state = str(state or "India").strip()
                    scope_area = str(
                        area or "Selected monitoring area"
                    ).strip()

                    stale_query = (
                        self.db.query(TrafficRecord)
                        .filter(
                            TrafficRecord.data_source == "simulation-fallback",
                            TrafficRecord.state == scope_state,
                            TrafficRecord.area == scope_area,
                        )
                    )

                    for stale_record in stale_query.all():
                        if stale_record.road_name not in current_road_names:
                            self.db.delete(stale_record)

                    for observation in simulated:
                        existing = (
                            self.db.query(TrafficRecord)
                            .filter(
                                TrafficRecord.data_source == "simulation-fallback",
                                TrafficRecord.state == observation.get("state"),
                                TrafficRecord.area == observation.get("area"),
                                TrafficRecord.road_name == observation.get("road_name"),
                            )
                            .first()
                        )

                        if existing is None:
                            self.db.add(
                                TrafficRecord(
                                    road_name=observation["road_name"],
                                    state=observation.get("state"),
                                    area=observation.get("area"),
                                    latitude=observation["latitude"],
                                    longitude=observation["longitude"],
                                    vehicle_count=observation["vehicle_count"],
                                    avg_speed_kmph=observation["avg_speed_kmph"],
                                    free_flow_speed_kmph=observation["free_flow_speed_kmph"],
                                    congestion_level=observation["congestion_level"],
                                    data_source="simulation-fallback",
                                    recorded_at=datetime.now(timezone.utc),
                                )
                            )
                        else:
                            existing.latitude = observation["latitude"]
                            existing.longitude = observation["longitude"]
                            existing.vehicle_count = observation["vehicle_count"]
                            existing.avg_speed_kmph = observation["avg_speed_kmph"]
                            existing.free_flow_speed_kmph = observation["free_flow_speed_kmph"]
                            existing.congestion_level = observation["congestion_level"]
                            existing.recorded_at = datetime.now(timezone.utc)

                    self.db.commit()
                except Exception as exc:
                    self.db.rollback()
                    print(f"Simulation traffic persistence failed: {exc}")

                # Return the generated observations directly. Never
                # re-query the database here: the UI needs the observations
                # from this request even if persistence/read-back is slow.
                results = simulated

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
        state: Optional[str] = None,
        area: Optional[str] = None,
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
            state=(
                str(state).strip()
                if state
                else None
            ),
            area=(
                str(area).strip()
                if area
                else None
            ),
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
                state=(
                    str(observation.get("state")).strip()
                    if observation.get("state")
                    else None
                ),
                area=(
                    str(observation.get("area")).strip()
                    if observation.get("area")
                    else None
                ),
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
        state: Optional[str] = None,
        area: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query = self.db.query(
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
            ).filter(
                TrafficRecord.road_name.isnot(None)
            )

        if state:
            query = query.filter(
                TrafficRecord.state == state
            )

        if area:
            query = query.filter(
                TrafficRecord.area == area
            )

        rows = (
            query
            .group_by(TrafficRecord.road_name)
            .order_by(TrafficRecord.road_name)
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
