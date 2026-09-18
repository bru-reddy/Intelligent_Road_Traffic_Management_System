from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String

from app.core.database import Base


class RouteQuery(Base):
    __tablename__ = "route_queries"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    source = Column(
        String(255),
        nullable=False,
    )

    destination = Column(
        String(255),
        nullable=False,
    )

    recommended_route = Column(
        String(255),
        nullable=True,
    )

    estimated_time_minutes = Column(
        Float,
        nullable=True,
    )

    congestion_impact_minutes = Column(
        Float,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


RouteAnalysis = RouteQuery