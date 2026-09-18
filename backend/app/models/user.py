from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.core.database import Base


ROLE_COMMONER = "commoner"
ROLE_TRAFFIC_OPERATOR = "traffic_operator"
ROLE_SYSTEM_OPERATOR = "system_operator"
ROLE_COMMISSIONER = "commissioner"

ALL_ROLES = (
    ROLE_COMMONER,
    ROLE_TRAFFIC_OPERATOR,
    ROLE_SYSTEM_OPERATOR,
    ROLE_COMMISSIONER,
)


class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    full_name = Column(
        String(120),
        nullable=False,
    )

    email = Column(
        String(180),
        unique=True,
        index=True,
        nullable=False,
    )

    password_hash = Column(
        String(255),
        nullable=False,
    )

    role = Column(
        String(40),
        nullable=False,
        default=ROLE_COMMONER,
        server_default=ROLE_COMMONER,
        index=True,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        index=True,
    )

    last_login_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    def __repr__(self) -> str:
        return (
            f"<User("
            f"id={self.id!r}, "
            f"email={self.email!r}, "
            f"role={self.role!r}, "
            f"is_active={self.is_active!r}"
            f")>"
        )