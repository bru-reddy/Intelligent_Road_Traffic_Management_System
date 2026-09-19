from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.traffic import TrafficRecord


VALID_STATUSES = {
    "active",
    "resolved",
}

VALID_SEVERITIES = {
    "low",
    "medium",
    "high",
    "critical",
    "severe",
}

VALID_CONGESTION_LEVELS = {
    "low",
    "medium",
    "moderate",
    "high",
    "critical",
    "severe",
}


class AlertService:
    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _normalize(value: Optional[str]) -> str:
        return str(value or "").strip().lower()

    @staticmethod
    def _normalize_congestion_level(
        value: Optional[str],
    ) -> Optional[str]:
        level = AlertService._normalize(value)

        if not level:
            return None

        if level == "moderate":
            return "medium"

        if level == "severe":
            return "critical"

        if level in {
            "low",
            "medium",
            "high",
            "critical",
        }:
            return level

        return None

    @staticmethod
    def _normalize_severity(
        value: Optional[str],
    ) -> Optional[str]:
        severity = AlertService._normalize(value)

        if severity == "severe":
            return "critical"

        if severity in {
            "low",
            "medium",
            "high",
            "critical",
        }:
            return severity

        return None

    @staticmethod
    def _severity_from_congestion(
        congestion_level: Optional[str],
    ) -> Optional[str]:
        level = AlertService._normalize_congestion_level(
            congestion_level
        )

        if level == "critical":
            return "critical"

        if level == "high":
            return "high"

        if level == "medium":
            return "medium"

        if level == "low":
            return "low"

        return None

    @staticmethod
    def _congestion_percentage(
        current_speed_kmph: Optional[float],
        free_flow_speed_kmph: Optional[float],
    ) -> Optional[float]:
        if current_speed_kmph is None:
            return None

        if free_flow_speed_kmph is None:
            return None

        if free_flow_speed_kmph <= 0:
            return None

        percentage = (
            1.0
            - (
                float(current_speed_kmph)
                / float(free_flow_speed_kmph)
            )
        ) * 100.0

        return round(
            max(0.0, min(100.0, percentage)),
            2,
        )

    @staticmethod
    def _congestion_level_from_speeds(
        current_speed_kmph: Optional[float],
        free_flow_speed_kmph: Optional[float],
    ) -> Optional[str]:
        percentage = AlertService._congestion_percentage(
            current_speed_kmph,
            free_flow_speed_kmph,
        )

        if percentage is None:
            return None

        if percentage >= 60:
            return "critical"

        if percentage >= 40:
            return "high"

        if percentage >= 20:
            return "medium"

        return "low"

    @staticmethod
    def _message(
        road_name: str,
        congestion_level: str,
        area: Optional[str] = None,
    ) -> str:
        road = str(
            road_name or "Unknown road"
        ).strip()

        level = AlertService._normalize_congestion_level(
            congestion_level
        ) or "medium"

        location = (
            f"{area.strip()} - {road}"
            if area and area.strip()
            else road
        )

        if level == "critical":
            return (
                f"Critical traffic congestion detected "
                f"on {location}."
            )

        if level == "high":
            return (
                f"High traffic congestion detected "
                f"on {location}."
            )

        if level == "medium":
            return (
                f"Medium traffic congestion detected "
                f"on {location}."
            )

        return (
            f"Traffic congestion detected on {location}."
        )

    @staticmethod
    def _priority(
        severity: Optional[str],
    ) -> int:
        return {
            "low": 1,
            "medium": 2,
            "high": 3,
            "critical": 4,
            "severe": 4,
        }.get(
            AlertService._normalize(severity),
            0,
        )

    @staticmethod
    def _safe_float(
        value: Any,
    ) -> Optional[float]:
        if value is None:
            return None

        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _safe_datetime(
        value: Any,
    ) -> datetime:
        if isinstance(value, datetime):
            return value

        return datetime.now(timezone.utc)

    @staticmethod
    def serialize_alert(
        alert: Alert,
    ) -> Dict[str, Any]:
        detected_at = getattr(
            alert,
            "detected_at",
            None,
        )

        resolved_at = getattr(
            alert,
            "resolved_at",
            None,
        )

        current_speed = AlertService._safe_float(
            getattr(
                alert,
                "current_speed_kmph",
                None,
            )
        )

        free_flow_speed = AlertService._safe_float(
            getattr(
                alert,
                "free_flow_speed_kmph",
                None,
            )
        )

        congestion_percentage = (
            AlertService._congestion_percentage(
                current_speed,
                free_flow_speed,
            )
        )

        latitude = AlertService._safe_float(
            getattr(
                alert,
                "latitude",
                None,
            )
        )

        longitude = AlertService._safe_float(
            getattr(
                alert,
                "longitude",
                None,
            )
        )

        alert_type = getattr(
            alert,
            "alert_type",
            None,
        ) or "traffic_congestion"

        return {
            "id": alert.id,
            "alert_type": alert_type,
            "type": alert_type,
            "area": getattr(
                alert,
                "area",
                None,
            ),
            "state": getattr(
                alert,
                "state",
                None,
            ),
            "road_name": alert.road_name,
            "road": alert.road_name,
            "congestion_level": getattr(
                alert,
                "congestion_level",
                None,
            ),
            "current_speed_kmph": current_speed,
            "free_flow_speed_kmph": free_flow_speed,
            "congestion_percentage": (
                congestion_percentage
            ),
            "severity": alert.severity,
            "message": alert.message,
            "description": alert.message,
            "status": alert.status,
            "latitude": latitude,
            "longitude": longitude,
            "lat": latitude,
            "lng": longitude,
            "detected_at": (
                detected_at.isoformat()
                if detected_at
                else None
            ),
            "created_at": (
                detected_at.isoformat()
                if detected_at
                else None
            ),
            "resolved_at": (
                resolved_at.isoformat()
                if resolved_at
                else None
            ),
        }

    def create_alert(
        self,
        road_name: str,
        severity: str,
        message: str,
        area: Optional[str] = None,
        state: Optional[str] = None,
        congestion_level: Optional[str] = None,
        current_speed_kmph: Optional[float] = None,
        free_flow_speed_kmph: Optional[float] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        alert_type: str = "traffic_congestion",
    ) -> Dict[str, Any]:
        road_name = str(
            road_name or ""
        ).strip()

        if not road_name:
            raise ValueError(
                "Road name is required."
            )

        normalized_severity = (
            self._normalize_severity(severity)
        )

        if normalized_severity is None:
            raise ValueError(
                "Invalid alert severity. "
                "Use low, medium, high, or critical."
            )

        normalized_congestion = (
            self._normalize_congestion_level(
                congestion_level
            )
        )

        current_speed = self._safe_float(
            current_speed_kmph
        )

        free_flow_speed = self._safe_float(
            free_flow_speed_kmph
        )

        if current_speed is not None and current_speed < 0:
            raise ValueError(
                "Current speed cannot be negative."
            )

        if free_flow_speed is not None and free_flow_speed <= 0:
            raise ValueError(
                "Free-flow speed must be greater than zero."
            )

        if normalized_congestion is None:
            normalized_congestion = (
                self._congestion_level_from_speeds(
                    current_speed,
                    free_flow_speed,
                )
            )

        if normalized_congestion is None:
            raise ValueError(
                "A valid congestion level or both "
                "current speed and free-flow speed are required."
            )

        derived_severity = (
            self._severity_from_congestion(
                normalized_congestion
            )
        )

        if derived_severity is not None:
            if self._priority(derived_severity) > self._priority(
                normalized_severity
            ):
                normalized_severity = derived_severity

        latitude_value = self._safe_float(latitude)
        longitude_value = self._safe_float(longitude)

        if (
            latitude_value is not None
            and not -90 <= latitude_value <= 90
        ):
            raise ValueError(
                "Latitude must be between -90 and 90."
            )

        if (
            longitude_value is not None
            and not -180 <= longitude_value <= 180
        ):
            raise ValueError(
                "Longitude must be between -180 and 180."
            )

        description = str(
            message or ""
        ).strip()

        if not description:
            description = self._message(
                road_name,
                normalized_congestion,
                area,
            )

        alert = Alert(
            alert_type=(
                str(alert_type or "traffic_congestion")
                .strip()
                or "traffic_congestion"
            ),
            area=(
                str(area).strip()
                if area
                else None
            ),
            state=(
                str(state).strip()
                if state
                else None
            ),
            road_name=road_name,
            congestion_level=normalized_congestion,
            current_speed_kmph=current_speed,
            free_flow_speed_kmph=free_flow_speed,
            severity=normalized_severity,
            latitude=latitude_value,
            longitude=longitude_value,
            message=description,
            status="active",
            detected_at=datetime.now(timezone.utc),
        )

        try:
            self.db.add(alert)
            self.db.commit()
            self.db.refresh(alert)
        except Exception:
            self.db.rollback()
            raise

        return self.serialize_alert(alert)

    def get_alerts(
        self,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        state: Optional[str] = None,
        area: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        normalized_status = None

        if status is not None:
            normalized_status = self._normalize(
                status
            )

            if normalized_status not in VALID_STATUSES:
                raise ValueError(
                    "Invalid alert status. "
                    "Use 'active' or 'resolved'."
                )

        normalized_severity = None

        if severity is not None:
            normalized_severity = self._normalize(
                severity
            )

            if normalized_severity not in VALID_SEVERITIES:
                raise ValueError(
                    "Invalid alert severity. "
                    "Use low, medium, high, critical, "
                    "or severe."
                )

        query = self.db.query(Alert)

        if normalized_status is not None:
            query = query.filter(
                Alert.status == normalized_status
            )

        if normalized_severity is not None:
            query = query.filter(
                Alert.severity == normalized_severity
            )

        if state:
            query = query.filter(
                Alert.state == state
            )

        if area and str(area).strip().lower() not in {
            "hyderabad",
            "telangana",
        }:
            query = query.filter(
                Alert.area == area
            )

        alerts = (
            query
            .order_by(
                Alert.detected_at.desc()
            )
            .all()
        )

        return [
            self.serialize_alert(alert)
            for alert in alerts
        ]

    def get_active_alerts(
        self,
        state: Optional[str] = None,
        area: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        return self.get_alerts(
            status="active",
            state=state,
            area=area,
        )

    def get_summary(
        self,
        state: Optional[str] = None,
        area: Optional[str] = None,
    ) -> Dict[str, int]:
        query = self.db.query(Alert).filter(
            Alert.status == "active"
        )

        if state:
            query = query.filter(
                Alert.state == state
            )

        if area and str(area).strip().lower() not in {
            "hyderabad",
            "telangana",
        }:
            query = query.filter(
                Alert.area == area
            )

        active_alerts = query.all()

        summary = {
            "active_count": 0,
            "critical_count": 0,
            "high_count": 0,
            "medium_count": 0,
            "low_count": 0,
        }

        for alert in active_alerts:
            summary["active_count"] += 1

            severity = self._normalize(
                alert.severity
            )

            if severity == "severe":
                severity = "critical"

            key = f"{severity}_count"

            if key in summary:
                summary[key] += 1

        return summary

    def generate_alerts(
        self,
        traffic_records: Optional[
            List[TrafficRecord]
        ] = None,
    ) -> List[Dict[str, Any]]:
        if traffic_records is None:
            traffic_records = (
                self.db.query(TrafficRecord)
                .order_by(
                    TrafficRecord.recorded_at.desc()
                )
                .limit(100)
                .all()
            )

        if not traffic_records:
            return []

        created_alerts: List[Alert] = []
        changed_alerts: List[Alert] = []

        try:
            for record in traffic_records:
                road_name = str(
                    getattr(
                        record,
                        "road_name",
                        "",
                    )
                    or ""
                ).strip()

                if not road_name:
                    continue

                current_speed = self._safe_float(
                    getattr(
                        record,
                        "current_speed_kmph",
                        None,
                    )
                )

                if current_speed is None:
                    current_speed = self._safe_float(
                        getattr(
                            record,
                            "avg_speed_kmph",
                            None,
                        )
                    )

                free_flow_speed = self._safe_float(
                    getattr(
                        record,
                        "free_flow_speed_kmph",
                        None,
                    )
                )

                congestion_level = (
                    self._normalize_congestion_level(
                        getattr(
                            record,
                            "congestion_level",
                            None,
                        )
                    )
                )

                if congestion_level is None:
                    congestion_level = (
                        self._congestion_level_from_speeds(
                            current_speed,
                            free_flow_speed,
                        )
                    )

                severity = (
                    self._severity_from_congestion(
                        congestion_level
                    )
                )

                if severity is None:
                    continue

                existing_alert = (
                    self.db.query(Alert)
                    .filter(
                        Alert.road_name == road_name,
                        Alert.status == "active",
                    )
                    .order_by(
                        Alert.detected_at.desc()
                    )
                    .first()
                )

                record_latitude = self._safe_float(
                    getattr(
                        record,
                        "latitude",
                        None,
                    )
                )

                record_longitude = self._safe_float(
                    getattr(
                        record,
                        "longitude",
                        None,
                    )
                )

                if existing_alert:
                    old_priority = self._priority(
                        existing_alert.severity
                    )

                    new_priority = self._priority(
                        severity
                    )

                    if new_priority > old_priority:
                        existing_alert.severity = severity
                        existing_alert.message = (
                            self._message(
                                road_name,
                                congestion_level,
                            )
                        )

                        if hasattr(
                            existing_alert,
                            "congestion_level",
                        ):
                            existing_alert.congestion_level = (
                                congestion_level
                            )

                        if hasattr(
                            existing_alert,
                            "current_speed_kmph",
                        ):
                            existing_alert.current_speed_kmph = (
                                current_speed
                            )

                        if hasattr(
                            existing_alert,
                            "free_flow_speed_kmph",
                        ):
                            existing_alert.free_flow_speed_kmph = (
                                free_flow_speed
                            )

                        if record_latitude is not None:
                            existing_alert.latitude = (
                                record_latitude
                            )

                        if record_longitude is not None:
                            existing_alert.longitude = (
                                record_longitude
                            )

                        if getattr(
                            record,
                            "recorded_at",
                            None,
                        ):
                            existing_alert.detected_at = (
                                record.recorded_at
                            )

                        changed_alerts.append(
                            existing_alert
                        )

                    continue

                detected_at = self._safe_datetime(
                    getattr(
                        record,
                        "recorded_at",
                        None,
                    )
                )

                alert = Alert(
                    alert_type="traffic_congestion",
                    state=getattr(
                        record,
                        "state",
                        None,
                    ),
                    area=getattr(
                        record,
                        "area",
                        None,
                    ),
                    road_name=road_name,
                    congestion_level=congestion_level,
                    current_speed_kmph=current_speed,
                    free_flow_speed_kmph=free_flow_speed,
                    severity=severity,
                    status="active",
                    latitude=record_latitude,
                    longitude=record_longitude,
                    message=self._message(
                        road_name,
                        congestion_level,
                    ),
                    detected_at=detected_at,
                )

                self.db.add(alert)
                created_alerts.append(alert)

            if created_alerts or changed_alerts:
                self.db.commit()

                for alert in (
                    created_alerts + changed_alerts
                ):
                    self.db.refresh(alert)

        except Exception:
            self.db.rollback()
            raise

        return [
            self.serialize_alert(alert)
            for alert in (
                created_alerts + changed_alerts
            )
        ]

    def resolve_alert(
        self,
        alert_id: int,
    ) -> Optional[Dict[str, Any]]:
        alert = (
            self.db.query(Alert)
            .filter(
                Alert.id == alert_id
            )
            .first()
        )

        if alert is None:
            return None

        try:
            alert.status = "resolved"
            alert.resolved_at = (
                datetime.now(timezone.utc)
            )

            self.db.commit()
            self.db.refresh(alert)

        except Exception:
            self.db.rollback()
            raise

        return self.serialize_alert(alert)


def list_alerts(
    db: Session,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    state: Optional[str] = None,
    area: Optional[str] = None,
):
    return AlertService(db).get_alerts(
        status=status,
        severity=severity,
        state=state,
        area=area,
    )


def get_active_alerts(
    db: Session,
    state: Optional[str] = None,
    area: Optional[str] = None,
):
    return AlertService(
        db
    ).get_active_alerts(
        state=state,
        area=area,
    )


def get_alert_summary(
    db: Session,
    state: Optional[str] = None,
    area: Optional[str] = None,
):
    return AlertService(
        db
    ).get_summary(
        state=state,
        area=area,
    )


def create_alerts_from_traffic(
    db: Session,
    traffic_records: Optional[
        List[TrafficRecord]
    ] = None,
):
    return AlertService(
        db
    ).generate_alerts(
        traffic_records
    )


def resolve(
    db: Session,
    alert_id: int,
):
    return AlertService(
        db
    ).resolve_alert(
        alert_id
    )