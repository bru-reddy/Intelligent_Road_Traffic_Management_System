from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.routes import RouteQuery

from .schemas import (
    LocationSearchResponse,
    RouteRequest,
    RouteResponse,
)

from .service import (
    calculate_real_routes,
    search_locations,
)


router = APIRouter(
    prefix="/routes",
    tags=["Route Analysis"],
)


@router.get(
    "/search",
    response_model=LocationSearchResponse,
)
async def search_route_locations(
    q: str = Query(
        ...,
        min_length=1,
        max_length=150,
    ),
    latitude: float | None = Query(
        default=None,
        ge=-90,
        le=90,
    ),
    longitude: float | None = Query(
        default=None,
        ge=-180,
        le=180,
    ),
    state: str | None = Query(
        default=None,
        min_length=2,
        max_length=100,
    ),
):
    results = await search_locations(
        query=q,
        latitude=latitude,
        longitude=longitude,
        limit=8,
        state=state,
    )

    return LocationSearchResponse(
        query=q,
        results=results,
    )


@router.post(
    "/recommend",
    response_model=RouteResponse,
)
async def recommend_route(
    payload: RouteRequest,
    db: Session = Depends(get_db),
):
    routes = await calculate_real_routes(
        source_latitude=payload.source_latitude,
        source_longitude=payload.source_longitude,
        destination_latitude=payload.destination_latitude,
        destination_longitude=payload.destination_longitude,
        max_alternatives=payload.max_alternatives,
    )

    if not routes:
        return RouteResponse(
            source=payload.source,
            destination=payload.destination,
            best_route=None,
            alternatives=[],
            time_saved_minutes=0.0,
            source_coordinates=[
                payload.source_latitude,
                payload.source_longitude,
            ],
            destination_coordinates=[
                payload.destination_latitude,
                payload.destination_longitude,
            ],
        )

    best = routes[0]
    alternatives = routes[1:]

    time_saved = 0.0

    if alternatives:
        time_saved = round(
            alternatives[0].estimated_time_minutes
            - best.estimated_time_minutes,
            1,
        )

    db.add(
        RouteQuery(
            source=payload.source,
            destination=payload.destination,
            recommended_route=best.name,
            estimated_time_minutes=(
                best.estimated_time_minutes
            ),
            congestion_impact_minutes=(
                best.traffic_delay_minutes
            ),
        )
    )

    db.commit()

    return RouteResponse(
        source=payload.source,
        destination=payload.destination,
        best_route=best,
        alternatives=alternatives,
        time_saved_minutes=time_saved,
        source_coordinates=[
            payload.source_latitude,
            payload.source_longitude,
        ],
        destination_coordinates=[
            payload.destination_latitude,
            payload.destination_longitude,
        ],
    )


@router.post(
    "/analyze",
    response_model=RouteResponse,
)
async def analyze_route(
    payload: RouteRequest,
    db: Session = Depends(get_db),
):
    routes = await calculate_real_routes(
        source_latitude=payload.source_latitude,
        source_longitude=payload.source_longitude,
        destination_latitude=payload.destination_latitude,
        destination_longitude=payload.destination_longitude,
        max_alternatives=payload.max_alternatives,
    )

    if not routes:
        return RouteResponse(
            source=payload.source,
            destination=payload.destination,
            best_route=None,
            alternatives=[],
            time_saved_minutes=0.0,
            source_coordinates=[
                payload.source_latitude,
                payload.source_longitude,
            ],
            destination_coordinates=[
                payload.destination_latitude,
                payload.destination_longitude,
            ],
        )

    best = routes[0]
    alternatives = routes[1:]

    time_saved = 0.0

    if alternatives:
        time_saved = round(
            alternatives[0].estimated_time_minutes
            - best.estimated_time_minutes,
            1,
        )

    db.add(
        RouteQuery(
            source=payload.source,
            destination=payload.destination,
            recommended_route=best.name,
            estimated_time_minutes=(
                best.estimated_time_minutes
            ),
            congestion_impact_minutes=(
                best.traffic_delay_minutes
            ),
        )
    )

    db.commit()

    return RouteResponse(
        source=payload.source,
        destination=payload.destination,
        best_route=best,
        alternatives=alternatives,
        time_saved_minutes=time_saved,
        source_coordinates=[
            payload.source_latitude,
            payload.source_longitude,
        ],
        destination_coordinates=[
            payload.destination_latitude,
            payload.destination_longitude,
        ],
    )