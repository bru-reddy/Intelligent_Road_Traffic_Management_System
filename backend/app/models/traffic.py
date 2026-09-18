"""
Traffic record database model for the
Intelligent Road Traffic Management System (IRTMS).
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String

from app.core.database import Base


def utc_now():
    """Return the current UTC time."""
    return datetime.now(timezone.utc)


class TrafficRecord(Base):
    """
    Stores live and historical traffic observations.

    Records can originate from TomTom live traffic,
    imported historical datasets, or system-generated data.
    """

    __tablename__ = "traffic_records"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    road_name = Column(
        String(255),
        nullable=False,
        index=True,
    )

    latitude = Column(
        Float,
        nullable=False,
    )

    longitude = Column(
        Float,
        nullable=False,
    )

    vehicle_count = Column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    avg_speed_kmph = Column(
        Float,
        nullable=False,
        default=0.0,
        server_default="0",
    )

    free_flow_speed_kmph = Column(
        Float,
        nullable=False,
        default=0.0,
        server_default="0",
    )

    congestion_level = Column(
        String(50),
        nullable=False,
        default="low",
        server_default="low",
        index=True,
    )

    data_source = Column(
        String(100),
        nullable=False,
        default="system",
        server_default="system",
        index=True,
    )

    recorded_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        index=True,
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    def __repr__(self):
        return (
            f"<TrafficRecord("
            f"id={self.id}, "
            f"road_name={self.road_name!r}, "
            f"avg_speed_kmph={self.avg_speed_kmph}, "
            f"congestion_level={self.congestion_level!r}, "
            f"recorded_at={self.recorded_at}"
            f")>"
        )