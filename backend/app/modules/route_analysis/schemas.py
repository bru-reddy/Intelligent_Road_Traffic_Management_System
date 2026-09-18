from typing import List, Optional

from pydantic import BaseModel, Field


class LocationResult(BaseModel):
    id: str
    name: str
    address: str
    latitude: float
    longitude: float
    type: Optional[str] = None


class RouteRequest(BaseModel):
    source: str
    destination: str

    source_latitude: float = Field(
        ...,
        ge=-90,
        le=90,
    )

    source_longitude: float = Field(
        ...,
        ge=-180,
        le=180,
    )

    destination_latitude: float = Field(
        ...,
        ge=-90,
        le=90,
    )

    destination_longitude: float = Field(
        ...,
        ge=-180,
        le=180,
    )

    max_alternatives: int = Field(
        default=2,
        ge=0,
        le=2,
    )


class RouteOption(BaseModel):
    name: str

    distance_km: float

    estimated_time_minutes: float

    traffic_delay_minutes: float

    base_time_minutes: float

    traffic_level: str

    traffic_delay_seconds: int

    geometry: List[List[float]]


class RouteResponse(BaseModel):
    source: str
    destination: str

    best_route: Optional[RouteOption] = None

    alternatives: List[RouteOption] = Field(
        default_factory=list,
    )

    time_saved_minutes: float = 0.0

    source_coordinates: List[float]

    destination_coordinates: List[float]


class LocationSearchResponse(BaseModel):
    query: str

    results: List[LocationResult]