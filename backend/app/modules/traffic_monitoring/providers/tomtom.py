"""
TomTom traffic-data provider for IRTMS.

The TomTom API key remains backend-only.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from urllib.parse import quote

import requests

from app.core.config import settings


class TomTomProvider:
    TRAFFIC_FLOW_PATH = (
        "/traffic/services/4/"
        "flowSegmentData/relative0/10/json"
    )

    TRAFFIC_INCIDENTS_PATH = (
        "/traffic/services/5/"
        "incidentDetails/s3/{bbox}/10/{style}/json"
    )

    SEARCH_PATH = "/search/2/search/{query}.json"

    ROUTING_PATH = (
        "/routing/1/"
        "calculateRoute/{locations}/json"
    )

    def __init__(self) -> None:
        self.api_key = str(
            getattr(
                settings,
                "TOMTOM_API_KEY",
                "",
            )
            or ""
        ).strip()

        self.base_url = str(
            getattr(
                settings,
                "TOMTOM_BASE_URL",
                "https://api.tomtom.com",
            )
            or "https://api.tomtom.com"
        ).rstrip("/")

        try:
            self.timeout = min(
                float(
                    getattr(
                        settings,
                        "TOMTOM_TIMEOUT_SECONDS",
                        15,
                    )
                ),
                5.0,
            )
        except (TypeError, ValueError):
            self.timeout = 5.0

    def _check_api_key(self) -> None:
        if not self.api_key:
            raise ValueError(
                "TomTom API key is not configured "
                "on the backend."
            )

    @staticmethod
    def _validate_coordinates(
        latitude: float,
        longitude: float,
    ) -> None:
        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except (TypeError, ValueError) as exc:
            raise ValueError(
                "Latitude and longitude must be valid numbers."
            ) from exc

        if not -90 <= latitude <= 90:
            raise ValueError(
                "Latitude must be between -90 and 90."
            )

        if not -180 <= longitude <= 180:
            raise ValueError(
                "Longitude must be between -180 and 180."
            )

    @staticmethod
    def _safe_float(
        value: Any,
    ) -> Optional[float]:
        if value is None:
            return None

        try:
            result = float(value)

            if result != result:
                return None

            return result

        except (TypeError, ValueError):
            return None

    def _build_url(
        self,
        path: str,
    ) -> str:
        if path.startswith("http://") or path.startswith(
            "https://"
        ):
            return path

        return f"{self.base_url}{path}"

    def _get(
        self,
        url: str,
        params: Dict[str, Any],
    ) -> requests.Response:
        self._check_api_key()

        request_params = dict(params)
        request_params["key"] = self.api_key

        try:
            response = requests.get(
                url,
                params=request_params,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "IRTMS/1.0",
                },
                timeout=self.timeout,
            )

        except requests.Timeout as exc:
            raise ValueError(
                "TomTom service request timed out."
            ) from exc

        except requests.ConnectionError as exc:
            raise ValueError(
                "Unable to connect to TomTom."
            ) from exc

        except requests.RequestException as exc:
            raise ValueError(
                f"TomTom service request failed: {exc}"
            ) from exc

        if response.status_code >= 400:
            try:
                body = response.json()
            except ValueError:
                body = {}

            message = None

            if isinstance(
                body.get("detailedError"),
                dict,
            ):
                message = body["detailedError"].get(
                    "message"
                )

            message = (
                message
                or body.get("errorText")
                or body.get("message")
                or response.text[:500]
                or f"HTTP {response.status_code}"
            )

            raise ValueError(
                "TomTom API error "
                f"{response.status_code}: {message}"
            )

        return response

    @staticmethod
    def _calculate_congestion(
        current_speed: Optional[float],
        free_flow_speed: Optional[float],
    ) -> str:
        if (
            current_speed is None
            or free_flow_speed is None
            or free_flow_speed <= 0
        ):
            return "unknown"

        ratio = current_speed / free_flow_speed

        if ratio >= 0.75:
            return "low"

        if ratio >= 0.50:
            return "medium"

        if ratio >= 0.25:
            return "high"

        return "severe"

    def get_flow(
        self,
        latitude: float,
        longitude: float,
    ) -> Dict[str, Any]:
        self._validate_coordinates(
            latitude,
            longitude,
        )

        params = {
            "point": (
                f"{float(latitude)},"
                f"{float(longitude)}"
            ),
            "unit": "KMPH",
            "openLr": "false",
        }

        url = self._build_url(
            self.TRAFFIC_FLOW_PATH
        )

        response = self._get(
            url,
            params,
        )

        try:
            data = response.json()
        except ValueError as exc:
            raise ValueError(
                "TomTom returned invalid traffic JSON."
            ) from exc

        flow = data.get(
            "flowSegmentData",
            {},
        )

        if not isinstance(flow, dict):
            raise ValueError(
                "TomTom returned an invalid "
                "flow-segment response."
            )

        current_speed = self._safe_float(
            flow.get("currentSpeed")
        )

        free_flow_speed = self._safe_float(
            flow.get("freeFlowSpeed")
        )

        current_travel_time = flow.get(
            "currentTravelTime"
        )

        free_flow_travel_time = flow.get(
            "freeFlowTravelTime"
        )

        confidence = self._safe_float(
            flow.get("confidence")
        )

        coordinates = flow.get(
            "coordinates",
            {},
        )

        if isinstance(coordinates, dict):
            coordinate_list = coordinates.get(
                "coordinate",
                [],
            )
        else:
            coordinate_list = []

        return {
            "current_speed": current_speed,
            "free_flow_speed": free_flow_speed,
            "travel_time": current_travel_time,
            "free_flow_travel_time": (
                free_flow_travel_time
            ),
            "confidence": confidence,
            "coordinates": coordinate_list,
            "congestion_level": (
                self._calculate_congestion(
                    current_speed,
                    free_flow_speed,
                )
            ),
            "road_closed": False,
        }

    def search_location(
        self,
        query: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        query = str(
            query or ""
        ).strip()

        if not query:
            return []

        try:
            limit = int(limit)
        except (TypeError, ValueError):
            limit = 5

        limit = max(
            1,
            min(limit, 10),
        )

        encoded_query = quote(
            query,
            safe="",
        )

        url = self._build_url(
            self.SEARCH_PATH.format(
                query=encoded_query
            )
        )

        params = {
            "limit": limit,
            "typeahead": "true",
            "countrySet": "IN",
            "language": "en-US",
        }

        response = self._get(
            url,
            params,
        )

        try:
            data = response.json()
        except ValueError as exc:
            raise ValueError(
                "TomTom returned invalid search JSON."
            ) from exc

        results: List[Dict[str, Any]] = []

        raw_results = data.get(
            "results",
            [],
        )

        if not isinstance(raw_results, list):
            return results

        for item in raw_results:
            if not isinstance(item, dict):
                continue

            position = item.get(
                "position",
                {},
            )

            address = item.get(
                "address",
                {},
            )

            poi = item.get(
                "poi",
                {},
            )

            if not isinstance(position, dict):
                position = {}

            if not isinstance(address, dict):
                address = {}

            if not isinstance(poi, dict):
                poi = {}

            latitude = self._safe_float(
                position.get("lat")
            )

            longitude = self._safe_float(
                position.get("lon")
            )

            if (
                latitude is None
                or longitude is None
            ):
                continue

            name = (
                poi.get("name")
                or address.get(
                    "freeformAddress"
                )
                or address.get(
                    "municipality"
                )
                or item.get("id")
                or "Unknown location"
            )

            address_parts = []

            for value in (
                address.get("streetNumber"),
                address.get("streetName"),
                address.get("municipality"),
                address.get(
                    "countrySubdivision"
                ),
            ):
                if value:
                    value = str(value)

                    if value not in address_parts:
                        address_parts.append(value)

            formatted_address = (
                ", ".join(address_parts)
                or address.get(
                    "freeformAddress"
                )
                or address.get(
                    "municipality"
                )
                or ""
            )

            results.append(
                {
                    "id": str(
                        item.get(
                            "id",
                            f"{latitude},{longitude}",
                        )
                    ),
                    "type": item.get("type"),
                    "name": str(name),
                    "address": str(
                        formatted_address
                    ),
                    "latitude": latitude,
                    "longitude": longitude,
                }
            )

            if len(results) >= limit:
                break

        return results

    def calculate_route(
        self,
        source_latitude: float,
        source_longitude: float,
        destination_latitude: float,
        destination_longitude: float,
        alternatives: int = 2,
    ) -> Dict[str, Any]:
        self._validate_coordinates(
            source_latitude,
            source_longitude,
        )

        self._validate_coordinates(
            destination_latitude,
            destination_longitude,
        )

        try:
            alternatives = int(alternatives)
        except (TypeError, ValueError):
            alternatives = 2

        alternatives = max(
            0,
            min(alternatives, 2),
        )

        locations = (
            f"{float(source_latitude)},"
            f"{float(source_longitude)}:"
            f"{float(destination_latitude)},"
            f"{float(destination_longitude)}"
        )

        encoded_locations = quote(
            locations,
            safe=",",
        )

        url = self._build_url(
            self.ROUTING_PATH.format(
                locations=encoded_locations
            )
        )

        params = {
            "traffic": "true",
            "travelMode": "car",
            "routeType": "fastest",
            "maxAlternatives": alternatives,
            "sectionType": "traffic",
        }

        response = self._get(
            url,
            params,
        )

        try:
            data = response.json()
        except ValueError as exc:
            raise ValueError(
                "TomTom returned invalid route JSON."
            ) from exc

        if not isinstance(data, dict):
            raise ValueError(
                "TomTom returned an invalid route response."
            )

        return data

    def get_incidents(
        self,
        min_latitude: float,
        min_longitude: float,
        max_latitude: float,
        max_longitude: float,
    ) -> List[Dict[str, Any]]:
        self._validate_coordinates(
            min_latitude,
            min_longitude,
        )

        self._validate_coordinates(
            max_latitude,
            max_longitude,
        )

        if min_latitude > max_latitude:
            raise ValueError(
                "Minimum latitude cannot exceed "
                "maximum latitude."
            )

        if min_longitude > max_longitude:
            raise ValueError(
                "Minimum longitude cannot exceed "
                "maximum longitude."
            )

        bbox = (
            f"{min_latitude},{min_longitude},"
            f"{max_latitude},{max_longitude}"
        )

        url = self._build_url(
            self.TRAFFIC_INCIDENTS_PATH.format(
                bbox=bbox,
                style="s1",
            )
        )

        response = self._get(
            url,
            {},
        )

        try:
            data = response.json()
        except ValueError as exc:
            raise ValueError(
                "TomTom returned invalid incidents JSON."
            ) from exc

        if isinstance(data, list):
            return data

        if isinstance(data, dict):
            incidents = data.get(
                "incidents",
                [],
            )

            if isinstance(incidents, list):
                return incidents

        return []

    def get_live_traffic(
        self,
        road_name: str,
        latitude: float,
        longitude: float,
    ) -> Dict[str, Any]:
        road_name = str(
            road_name or ""
        ).strip()

        if not road_name:
            raise ValueError(
                "Road name cannot be empty."
            )

        self._validate_coordinates(
            latitude,
            longitude,
        )

        flow = self.get_flow(
            latitude=latitude,
            longitude=longitude,
        )

        current_speed = flow.get(
            "current_speed"
        )

        free_flow_speed = flow.get(
            "free_flow_speed"
        )

        return {
            "road_name": road_name,
            "latitude": float(latitude),
            "longitude": float(longitude),
            "current_speed": current_speed,
            "free_flow_speed": free_flow_speed,
            "avg_speed_kmph": current_speed,
            "free_flow_speed_kmph": (
                free_flow_speed
            ),
            "travel_time": flow.get(
                "travel_time"
            ),
            "free_flow_travel_time": flow.get(
                "free_flow_travel_time"
            ),
            "confidence": flow.get(
                "confidence"
            ),
            "congestion_level": flow.get(
                "congestion_level",
                "unknown",
            ),
            "road_closed": flow.get(
                "road_closed",
                False,
            ),
            "coordinates": flow.get(
                "coordinates",
                [],
            ),
            "data_source": "tomtom",
        }