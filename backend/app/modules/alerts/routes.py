from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.modules.alerts.service import AlertService


router = APIRouter(
    prefix="/alerts",
    tags=["Traffic Alerts"],
)


OPERATIONAL_ROLES = (
    "traffic_operator",
    "system_operator",
    "commissioner",
)


class CreateAlertRequest(BaseModel):
    area: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    state: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    road_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
    )

    congestion_level: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    current_speed_kmph: Optional[float] = Field(
        default=None,
        ge=0,
    )

    free_flow_speed_kmph: Optional[float] = Field(
        default=None,
        gt=0,
    )

    severity: str = Field(
        ...,
        min_length=1,
        max_length=50,
    )

    description: Optional[str] = Field(
        default=None,
        max_length=2000,
    )

    latitude: Optional[float] = Field(
        default=None,
        ge=-90,
        le=90,
    )

    longitude: Optional[float] = Field(
        default=None,
        ge=-180,
        le=180,
    )

    alert_type: str = Field(
        default="traffic_congestion",
        max_length=100,
    )


@router.get("")
@router.get("/")
def get_alerts(
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
    ),
    severity: Optional[str] = Query(
        default=None,
    ),
    state: Optional[str] = Query(
        default=None,
        min_length=2,
        max_length=100,
    ),
    area: Optional[str] = Query(
        default=None,
        min_length=2,
        max_length=255,
    ),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """
    Return traffic alerts.

    Optional filters:
    - status=active
    - status=resolved
    - severity=low
    - severity=medium
    - severity=high
    - severity=critical
    """

    service = AlertService(db)

    try:
        return service.get_alerts(
            status=status_filter,
            severity=severity,
            state=state,
            area=area,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to retrieve traffic alerts.",
        )


@router.get("/active")
def get_active_alerts(
    state: Optional[str] = Query(default=None, min_length=2, max_length=100),
    area: Optional[str] = Query(default=None, min_length=2, max_length=255),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """
    Return only currently active traffic alerts.
    """

    service = AlertService(db)

    try:
        return service.get_active_alerts(
            state=state,
            area=area,
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to retrieve active traffic alerts.",
        )


@router.get("/summary")
def get_alert_summary(
    state: Optional[str] = Query(default=None, min_length=2, max_length=100),
    area: Optional[str] = Query(default=None, min_length=2, max_length=255),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """
    Return the current traffic-alert summary.
    """

    service = AlertService(db)

    try:
        return service.get_summary(
            state=state,
            area=area,
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to retrieve alert summary.",
        )


@router.post("")
@router.post("/")
def create_alert(
    payload: CreateAlertRequest,
    db: Session = Depends(get_db),
    _user=Depends(
        require_roles(*OPERATIONAL_ROLES)
    ),
):
    """
    Create and publish a traffic alert.

    Traffic Operators, System Operators, and Commissioners
    are authorized to create operational traffic alerts.

    The alert is persisted in the database and therefore
    becomes visible to every authenticated account that
    retrieves the shared alert list.
    """

    service = AlertService(db)

    try:
        alert = service.create_alert(
            road_name=payload.road_name,
            severity=payload.severity,
            message=payload.description or "",
            area=payload.area,
            state=payload.state,
            congestion_level=payload.congestion_level,
            current_speed_kmph=payload.current_speed_kmph,
            free_flow_speed_kmph=payload.free_flow_speed_kmph,
            latitude=payload.latitude,
            longitude=payload.longitude,
            alert_type=payload.alert_type,
        )

        return {
            "message": "Traffic alert published successfully.",
            "alert": alert,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to publish traffic alert.",
        )


@router.post("/generate")
def generate_alerts(
    db: Session = Depends(get_db),
    _user=Depends(
        require_roles(*OPERATIONAL_ROLES)
    ),
):
    """
    Generate or update traffic alerts from
    available traffic records.

    Restricted to operational roles.
    """

    service = AlertService(db)

    try:
        alerts = service.generate_alerts()

        return {
            "message": "Traffic alerts generated successfully.",
            "count": len(alerts),
            "alerts": alerts,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to generate traffic alerts.",
        )


@router.patch("/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    _user=Depends(
        require_roles(*OPERATIONAL_ROLES)
    ),
):
    """
    Resolve an active traffic alert.

    Restricted to operational roles.
    """

    if alert_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alert ID must be a positive integer.",
        )

    service = AlertService(db)

    try:
        alert = service.resolve_alert(
            alert_id
        )

        if alert is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Traffic alert not found.",
            )

        return {
            "message": "Traffic alert resolved successfully.",
            "alert": alert,
        }

    except HTTPException:
        raise

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to resolve traffic alert.",
        )