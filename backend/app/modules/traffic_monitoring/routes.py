"""
Traffic monitoring API routes for the
Intelligent Road Traffic Management System (IRTMS).
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.traffic_monitoring.service import TrafficMonitoringService


router = APIRouter(
    prefix="/traffic",
    tags=["Traffic Monitoring"],
)


class TrafficIngestRequest(BaseModel):
    """Payload for manually ingesting a traffic observation."""

    road_name: str = Field(..., min_length=1, max_length=255)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    vehicle_count: int = Field(default=0, ge=0)
    avg_speed_kmph: float = Field(..., ge=0)
    free_flow_speed_kmph: float = Field(..., ge=0)
    data_source: str = Field(default="manual", min_length=1, max_length=100)

    @field_validator("road_name", "data_source")
    @classmethod
    def validate_text(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Value cannot be empty.")

        return value


class TomTomRoadRequest(BaseModel):
    """Payload identifying a road monitoring point."""

    road_name: str = Field(..., min_length=1, max_length=255)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

    @field_validator("road_name")
    @classmethod
    def validate_road_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Road name cannot be empty.")

        return value


@router.get("/live")
def get_live_traffic(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Return the latest stored traffic observations.

    This endpoint reads from the database and does not directly
    call TomTom.
    """

    service = TrafficMonitoringService(db)

    return service.get_live_traffic(limit=limit)


@router.get("/live-tomtom")
def get_live_tomtom_traffic(
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    state: str | None = Query(default=None, min_length=2, max_length=100),
    area: str | None = Query(default=None, min_length=2, max_length=255),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Fetch current traffic information from TomTom.

    The TomTom API key is accessed only by the backend and is
    never exposed to the frontend.
    """

    service = TrafficMonitoringService(db)

    try:
        return service.get_live_traffic_tomtom(
            state=state,
            area=area,
            latitude=latitude,
            longitude=longitude,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve live TomTom traffic data.",
        )


@router.post("/ingest", status_code=201)
def ingest_traffic(
    payload: TrafficIngestRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Insert a traffic observation into traffic_records.
    """

    service = TrafficMonitoringService(db)

    try:
        return service.ingest_traffic(
            road_name=payload.road_name,
            latitude=payload.latitude,
            longitude=payload.longitude,
            vehicle_count=payload.vehicle_count,
            avg_speed_kmph=payload.avg_speed_kmph,
            free_flow_speed_kmph=payload.free_flow_speed_kmph,
            data_source=payload.data_source,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.get("/road-utilization")
def get_road_utilization(
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Return aggregated road-utilization statistics.
    """

    service = TrafficMonitoringService(db)

    return service.get_road_utilization()