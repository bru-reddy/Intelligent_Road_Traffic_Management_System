from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from app.core.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    alert_type = Column(
        String(100),
        nullable=False,
        default="traffic_congestion",
    )

    area = Column(
        String(255),
        nullable=True,
    )

    state = Column(
        String(100),
        nullable=True,
        index=True,
    )

    road_name = Column(
        String(255),
        nullable=False,
        index=True,
    )

    congestion_level = Column(
        String(50),
        nullable=True,
        index=True,
    )

    current_speed_kmph = Column(
        Float,
        nullable=True,
    )

    free_flow_speed_kmph = Column(
        Float,
        nullable=True,
    )

    severity = Column(
        String(50),
        nullable=False,
        default="medium",
        index=True,
    )

    latitude = Column(
        Float,
        nullable=True,
    )

    longitude = Column(
        Float,
        nullable=True,
    )

    message = Column(
        Text,
        nullable=False,
    )

    status = Column(
        String(50),
        nullable=False,
        default="active",
        index=True,
    )

    detected_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    resolved_at = Column(
        DateTime,
        nullable=True,
    )