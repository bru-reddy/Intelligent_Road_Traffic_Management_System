"""
Traffic prediction API routes for the
Intelligent Road Traffic Management System (IRTMS).
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.traffic_prediction.service import (
    TrafficPredictionService,
)


router = APIRouter(
    prefix="/prediction",
    tags=["Traffic Prediction"],
)


class PredictionRequest(BaseModel):
    road_name: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    vehicle_count: Optional[int] = Field(
        default=None,
        ge=0,
    )

    current_speed_kmph: Optional[float] = Field(
        default=None,
        ge=0,
    )

    free_flow_speed_kmph: Optional[float] = Field(
        default=None,
        gt=0,
    )

    hour: Optional[int] = Field(
        default=None,
        ge=0,
        le=23,
    )

    day_of_week: Optional[str] = Field(
        default=None,
        max_length=20,
    )

    @field_validator("road_name")
    @classmethod
    def validate_road_name(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        if value is None:
            return None

        value = value.strip()

        return value or None

    @field_validator("day_of_week")
    @classmethod
    def validate_day_of_week(
        cls,
        value: Optional[str],
    ) -> Optional[str]:
        if value is None:
            return None

        value = value.strip()

        return value or None


@router.post("/predict")
def predict_traffic(
    payload: PredictionRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:

    if (
        payload.vehicle_count is None
        and payload.current_speed_kmph is None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Provide vehicle count or current speed "
                "before requesting a prediction."
            ),
        )

    service = TrafficPredictionService(db)

    try:
        return service.predict(
            road_name=payload.road_name,
            vehicle_count=payload.vehicle_count,
            current_speed_kmph=payload.current_speed_kmph,
            free_flow_speed_kmph=payload.free_flow_speed_kmph,
            hour=payload.hour,
            day_of_week=payload.day_of_week,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Traffic prediction failed.",
        ) from exc


@router.post("/retrain")
def retrain_prediction_model(
    db: Session = Depends(get_db),
) -> Dict[str, Any]:

    service = TrafficPredictionService(db)

    try:
        return service.train()

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Prediction model training failed.",
        ) from exc


@router.get("/peak-hours")
def get_peak_hours(
    db: Session = Depends(get_db),
) -> Dict[str, Any]:

    service = TrafficPredictionService(db)

    try:
        return service.get_peak_hours()

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to calculate peak traffic hours.",
        ) from exc


@router.get("/report")
def get_prediction_report(
    db: Session = Depends(get_db),
) -> Dict[str, Any]:

    service = TrafficPredictionService(db)

    try:
        service.train()
        return service.get_report()

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to retrieve prediction model status.",
        ) from exc