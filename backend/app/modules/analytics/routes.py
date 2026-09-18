from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.analytics.service import AnalyticsService


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


@router.get("/heatmap")
def get_heatmap(
    limit: int = Query(
        default=500,
        ge=1,
        le=2000,
        description="Maximum number of traffic points.",
    ),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:

    service = AnalyticsService(db)

    try:
        return service.get_heatmap(limit=limit)

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve traffic heatmap data.",
        ) from exc


@router.get("/road-performance")
def get_road_performance(
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:

    service = AnalyticsService(db)

    try:
        return service.get_road_performance()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve road performance data.",
        ) from exc


@router.get("/trends")
def get_trends(
    hours: int = Query(
        default=24,
        ge=1,
        le=168,
        description="Number of recent hours to analyze.",
    ),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:

    service = AnalyticsService(db)

    try:
        return service.get_trends(hours=hours)

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve traffic trends.",
        ) from exc


@router.get("/summary")
def get_analytics_summary(
    db: Session = Depends(get_db),
) -> Dict[str, Any]:

    service = AnalyticsService(db)

    try:
        road_performance = (
            service.get_road_performance()
        )

        heatmap = service.get_heatmap(
            limit=2000
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to generate analytics summary.",
        ) from exc

    total_roads = len(road_performance)

    total_records = 0
    total_vehicles = 0.0
    total_speed = 0.0
    speed_count = 0

    congestion_counts = {
        "low": 0,
        "medium": 0,
        "high": 0,
        "critical": 0,
    }

    for road in road_performance:
        if not isinstance(road, dict):
            continue

        total_records += int(
            road.get(
                "observation_count",
                0,
            )
            or 0
        )

        total_vehicles += float(
            road.get(
                "average_vehicle_count",
                0,
            )
            or 0
        )

        average_speed = road.get(
            "average_speed_kmph"
        )

        if average_speed is not None:
            try:
                total_speed += float(
                    average_speed
                )
                speed_count += 1
            except (TypeError, ValueError):
                pass

    for point in heatmap:
        if not isinstance(point, dict):
            continue

        congestion = str(
            point.get(
                "congestion_level",
                "",
            )
            or ""
        ).strip().lower()

        if congestion == "severe":
            congestion = "critical"

        if congestion in congestion_counts:
            congestion_counts[congestion] += 1

    average_speed = (
        round(
            total_speed / speed_count,
            2,
        )
        if speed_count
        else None
    )

    return {
        "total_roads": total_roads,
        "total_records": total_records,
        "total_vehicle_count": int(
            total_vehicles
        ),
        "average_speed_kmph": average_speed,
        "congestion": congestion_counts,
    }