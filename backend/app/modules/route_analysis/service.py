from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.modules.route_analysis.schemas import (
    LocationResult,
    RouteOption,
)


TOMTOM_SEARCH_URL = (
    "https://api.tomtom.com/search/2/search"
)

TOMTOM_ROUTING_URL = (
    "https://api.tomtom.com/routing/1/calculateRoute"
)


def _get_tomtom_api_key() -> str:
    api_key = getattr(
        settings,
        "tomtom_api_key",
        None,
    )

    if not api_key:
        api_key = getattr(
            settings,
            "TOMTOM_API_KEY",
            None,
        )

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail=(
                "TomTom API key is not configured "
                "on the backend."
            ),
        )

    return str(api_key)


async def _tomtom_get(
    url: str,
    params: dict[str, Any],
) -> dict[str, Any]:
    try:
        timeout = httpx.Timeout(
            connect=10.0,
            read=20.0,
            write=10.0,
            pool=10.0,
        )

        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            trust_env=False,
        ) as client:
            response = await client.get(
                url,
                params=params,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "IRTMS/1.0",
                },
            )

    except httpx.ConnectTimeout as exc:
        raise HTTPException(
            status_code=504,
            detail="TomTom connection timed out.",
        ) from exc

    except httpx.ReadTimeout as exc:
        raise HTTPException(
            status_code=504,
            detail="TomTom response timed out.",
        ) from exc

    except httpx.ConnectError as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not connect to TomTom.",
        ) from exc

    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "TomTom network request failed: "
                f"{exc}"
            ),
        ) from exc

    if response.status_code >= 400:
        try:
            body = response.json()
        except Exception:
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

        raise HTTPException(
            status_code=502,
            detail=(
                "TomTom API returned HTTP "
                f"{response.status_code}: {message}"
            ),
        )

    try:
        data = response.json()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="TomTom returned invalid JSON.",
        ) from exc

    if not isinstance(data, dict):
        raise HTTPException(
            status_code=502,
            detail="TomTom returned an invalid response.",
        )

    return data


def _calculate_traffic_level(
    travel_time_seconds: int,
    traffic_delay_seconds: int,
) -> str:
    if travel_time_seconds <= 0:
        return "unknown"

    delay_ratio = (
        traffic_delay_seconds
        / travel_time_seconds
    )

    if delay_ratio >= 0.35:
        return "high"

    if delay_ratio >= 0.15:
        return "medium"

    return "low"


def _extract_geometry(
    route: dict[str, Any],
) -> list[list[float]]:
    points: list[list[float]] = []

    for leg in route.get("legs", []):
        if not isinstance(leg, dict):
            continue

        for point in leg.get("points", []):
            if not isinstance(point, dict):
                continue

            latitude = point.get("latitude")
            longitude = point.get("longitude")

            if latitude is None or longitude is None:
                continue

            try:
                lat = float(latitude)
                lon = float(longitude)
            except (TypeError, ValueError):
                continue

            if not -90 <= lat <= 90:
                continue

            if not -180 <= lon <= 180:
                continue

            points.append([lat, lon])

    return points


def _route_to_option(
    route: dict[str, Any],
    index: int,
) -> RouteOption:
    summary = route.get("summary") or {}

    if not isinstance(summary, dict):
        summary = {}

    distance_meters = int(
        float(
            summary.get(
                "lengthInMeters",
                0,
            )
            or 0
        )
    )

    travel_time_seconds = int(
        float(
            summary.get(
                "travelTimeInSeconds",
                0,
            )
            or 0
        )
    )

    traffic_delay_seconds = int(
        float(
            summary.get(
                "trafficDelayInSeconds",
                0,
            )
            or 0
        )
    )

    estimated_time_minutes = (
        travel_time_seconds / 60
    )

    base_time_seconds = max(
        travel_time_seconds
        - traffic_delay_seconds,
        0,
    )

    base_time_minutes = (
        base_time_seconds / 60
    )

    traffic_level = _calculate_traffic_level(
        travel_time_seconds,
        traffic_delay_seconds,
    )

    geometry = _extract_geometry(route)

    return RouteOption(
        name=(
            "Best Route"
            if index == 0
            else f"Alternative Route {index}"
        ),
        distance_km=round(
            distance_meters / 1000,
            2,
        ),
        estimated_time_minutes=round(
            estimated_time_minutes,
            1,
        ),
        traffic_delay_minutes=round(
            traffic_delay_seconds / 60,
            1,
        ),
        base_time_minutes=round(
            base_time_minutes,
            1,
        ),
        traffic_level=traffic_level,
        traffic_delay_seconds=traffic_delay_seconds,
        geometry=geometry,
    )


async def search_locations(
    query: str,
    latitude: float | None = None,
    longitude: float | None = None,
    limit: int = 8,
) -> list[LocationResult]:
    query = query.strip()

    if not query:
        return []

    api_key = _get_tomtom_api_key()

    limit = max(
        1,
        min(int(limit), 10),
    )

    params: dict[str, Any] = {
        "key": api_key,
        "limit": limit,
        "countrySet": "IN",
        "typeahead": "true",
        "language": "en-US",
        "ofs": 0,
    }

    if latitude is not None and longitude is not None:
        params["lat"] = latitude
        params["lon"] = longitude

    data = await _tomtom_get(
        f"{TOMTOM_SEARCH_URL}/"
        f"{query}.json",
        params,
    )

    results: list[LocationResult] = []

    for item in data.get("results", []):
        if not isinstance(item, dict):
            continue

        position = item.get("position") or {}
        address = item.get("address") or {}
        poi = item.get("poi") or {}

        latitude_value = position.get("lat")
        longitude_value = position.get("lon")

        if (
            latitude_value is None
            or longitude_value is None
        ):
            continue

        try:
            latitude_value = float(
                latitude_value
            )
            longitude_value = float(
                longitude_value
            )
        except (TypeError, ValueError):
            continue

        if not (
            -90 <= latitude_value <= 90
            and -180 <= longitude_value <= 180
        ):
            continue

        name = (
            poi.get("name")
            or address.get("municipality")
            or address.get("freeformAddress")
            or query
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
            or address.get("freeformAddress")
            or address.get("municipality")
            or address.get(
                "countrySubdivision"
            )
            or ""
        )

        results.append(
            LocationResult(
                id=str(
                    item.get(
                        "id",
                        (
                            f"{latitude_value},"
                            f"{longitude_value}"
                        ),
                    )
                ),
                name=str(name),
                address=str(
                    formatted_address
                ),
                latitude=latitude_value,
                longitude=longitude_value,
                type=item.get("type"),
            )
        )

    return results


async def calculate_real_routes(
    source_latitude: float,
    source_longitude: float,
    destination_latitude: float,
    destination_longitude: float,
    max_alternatives: int = 2,
) -> list[RouteOption]:
    try:
        source_latitude = float(
            source_latitude
        )
        source_longitude = float(
            source_longitude
        )
        destination_latitude = float(
            destination_latitude
        )
        destination_longitude = float(
            destination_longitude
        )
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail="Invalid route coordinates.",
        ) from exc

    if not (
        -90 <= source_latitude <= 90
        and -180 <= source_longitude <= 180
        and -90 <= destination_latitude <= 90
        and -180 <= destination_longitude <= 180
    ):
        raise HTTPException(
            status_code=422,
            detail="Route coordinates are out of range.",
        )

    if (
        source_latitude == destination_latitude
        and source_longitude
        == destination_longitude
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                "Source and destination cannot "
                "be the same location."
            ),
        )

    try:
        max_alternatives = int(
            max_alternatives
        )
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                "max_alternatives must be an integer."
            ),
        ) from exc

    max_alternatives = max(
        0,
        min(max_alternatives, 2),
    )

    api_key = _get_tomtom_api_key()

    locations = (
        f"{source_latitude},{source_longitude}:"
        f"{destination_latitude},"
        f"{destination_longitude}"
    )

    params = {
        "key": api_key,
        "traffic": "true",
        "routeType": "fastest",
        "travelMode": "car",
        "maxAlternatives": max_alternatives,
        "language": "en-US",
    }

    data = await _tomtom_get(
        f"{TOMTOM_ROUTING_URL}/"
        f"{locations}/json",
        params,
    )

    routes = data.get("routes", [])

    if not isinstance(routes, list):
        routes = []

    if not routes:
        raise HTTPException(
            status_code=404,
            detail=(
                "TomTom could not find a route "
                "between these locations."
            ),
        )

    options = []

    for index, route in enumerate(routes):
        if not isinstance(route, dict):
            continue

        try:
            options.append(
                _route_to_option(
                    route,
                    index,
                )
            )
        except (
            TypeError,
            ValueError,
            KeyError,
        ):
            continue

    options.sort(
        key=lambda route: (
            route.estimated_time_minutes,
            route.traffic_delay_minutes,
        )
    )

    for index, route in enumerate(options):
        route.name = (
            "Best Route"
            if index == 0
            else f"Alternative Route {index}"
        )

    return options


def evaluate_routes(
    candidate_routes: list[dict[str, Any]]
    | None,
) -> list[dict[str, Any]]:
    if not candidate_routes:
        return []

    evaluated = []

    for route in candidate_routes:
        if not isinstance(route, dict):
            continue

        try:
            distance = float(
                route.get(
                    "distance_km",
                    0,
                )
            )
        except (TypeError, ValueError):
            continue

        if distance <= 0:
            continue

        evaluated.append(
            {
                "name": route.get(
                    "name",
                    "Route",
                ),
                "distance_km": distance,
                "base_time_minutes": round(
                    (distance / 55) * 60,
                    1,
                ),
                "congestion_level": route.get(
                    "congestion_level",
                    route.get(
                        "traffic_level",
                        "low",
                    ),
                ),
            }
        )

    return evaluated