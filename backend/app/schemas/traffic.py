from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class PredictionRequest(BaseModel):
    road_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )

    hour: int = Field(
        ...,
        ge=0,
        le=23,
    )

    day_of_week: str = Field(
        ...,
        min_length=1,
        max_length=20,
    )

    expected_vehicle_count: int = Field(
        ...,
        ge=0,
    )

    current_speed: Optional[float] = Field(
        default=None,
        ge=0,
    )

    free_flow_speed: Optional[float] = Field(
        default=None,
        gt=0,
    )

    @field_validator("road_name", "day_of_week")
    @classmethod
    def validate_text_fields(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("This field cannot be empty.")

        return value


class RouteRequest(BaseModel):
    origin: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )

    destination: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )

    @field_validator("origin", "destination")
    @classmethod
    def validate_location(cls, value: str) -> str:
        value = " ".join(value.split())

        if not value:
            raise ValueError("Location cannot be empty.")

        return value


class RouteAutocompleteResponse(BaseModel):
    name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None