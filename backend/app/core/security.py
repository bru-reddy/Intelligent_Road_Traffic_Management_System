from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User


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

ROLE_DISPLAY_NAMES = {
    ROLE_COMMONER: "Commoner",
    ROLE_TRAFFIC_OPERATOR: "Traffic Operator",
    ROLE_SYSTEM_OPERATOR: "System Operator",
    ROLE_COMMISSIONER: "Commissioner",
}


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
)


def hash_password(password: str) -> str:
    if not password:
        raise ValueError("Password cannot be empty.")

    return pwd_context.hash(password)


def verify_password(
    plain: str,
    hashed: str,
) -> bool:
    if not plain or not hashed:
        return False

    try:
        return pwd_context.verify(plain, hashed)
    except (ValueError, TypeError):
        return False


def _get_jwt_secret() -> str:
    secret = settings.jwt_secret_key.strip()

    if not secret:
        raise RuntimeError(
            "SECRET_KEY is not configured."
        )

    return secret


def _normalize_role(role: str | None) -> str | None:
    if role is None:
        return None

    normalized = str(role).strip().lower()

    aliases = {
        "operator": ROLE_SYSTEM_OPERATOR,
        "system operator": ROLE_SYSTEM_OPERATOR,
        "system_operator": ROLE_SYSTEM_OPERATOR,
        "traffic operator": ROLE_TRAFFIC_OPERATOR,
        "traffic_operator": ROLE_TRAFFIC_OPERATOR,
        "commoner": ROLE_COMMONER,
        "commissioner": ROLE_COMMISSIONER,
    }

    return aliases.get(
        normalized,
        normalized,
    )


def create_access_token(
    subject: str,
    role: str,
) -> str:
    normalized_role = _normalize_role(role)

    if not subject or not subject.strip():
        raise ValueError("JWT subject cannot be empty.")

    if normalized_role not in ALL_ROLES:
        raise ValueError(
            f"Invalid IRTMS role: {role}"
        )

    now = datetime.now(timezone.utc)

    expires_at = now + timedelta(
        minutes=settings.access_token_expire_minutes
    )

    payload = {
        "sub": subject.strip().lower(),
        "role": normalized_role,
        "iat": now,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        _get_jwt_secret(),
        algorithm=settings.jwt_algorithm,
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials.",
        headers={
            "WWW-Authenticate": "Bearer",
        },
    )

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(
            token,
            _get_jwt_secret(),
            algorithms=[settings.jwt_algorithm],
        )

        subject = payload.get("sub")

        if not subject or not isinstance(subject, str):
            raise credentials_exception

        email = subject.strip().lower()

        if not email:
            raise credentials_exception

    except HTTPException:
        raise

    except (JWTError, RuntimeError):
        raise credentials_exception

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if user is None:
        raise credentials_exception

    if not bool(user.is_active):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    database_role = _normalize_role(
        getattr(user, "role", None)
    )

    if database_role not in ALL_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The account has an invalid role.",
        )

    return user


def require_roles(*roles: str) -> Callable:
    if not roles:
        raise ValueError(
            "At least one role must be supplied."
        )

    normalized_roles = {
        _normalize_role(role)
        for role in roles
    }

    invalid_roles = normalized_roles - set(ALL_ROLES)

    if invalid_roles:
        raise ValueError(
            "Invalid IRTMS role(s): "
            + ", ".join(sorted(invalid_roles))
        )

    def dependency(
        user: User = Depends(get_current_user),
    ) -> User:
        current_role = _normalize_role(
            getattr(user, "role", None)
        )

        if current_role not in normalized_roles:
            required_names = [
                ROLE_DISPLAY_NAMES.get(
                    role,
                    role,
                )
                for role in sorted(normalized_roles)
            ]

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Insufficient permissions. "
                    "Required role: "
                    + ", ".join(required_names)
                ),
            )

        return user

    return dependency


def require_any_authenticated_user(
    user: User = Depends(get_current_user),
) -> User:
    return user


def require_traffic_operations(
    user: User = Depends(
        require_roles(
            ROLE_TRAFFIC_OPERATOR,
            ROLE_SYSTEM_OPERATOR,
            ROLE_COMMISSIONER,
        )
    ),
) -> User:
    return user


def require_system_operations(
    user: User = Depends(
        require_roles(
            ROLE_SYSTEM_OPERATOR,
            ROLE_COMMISSIONER,
        )
    ),
) -> User:
    return user


def require_commissioner(
    user: User = Depends(
        require_roles(
            ROLE_COMMISSIONER,
        )
    ),
) -> User:
    return user


def is_commoner(user: User) -> bool:
    return (
        _normalize_role(
            getattr(user, "role", None)
        )
        == ROLE_COMMONER
    )


def is_traffic_operator(user: User) -> bool:
    return (
        _normalize_role(
            getattr(user, "role", None)
        )
        == ROLE_TRAFFIC_OPERATOR
    )


def is_system_operator(user: User) -> bool:
    return (
        _normalize_role(
            getattr(user, "role", None)
        )
        == ROLE_SYSTEM_OPERATOR
    )


def is_operator(user: User) -> bool:
    return is_system_operator(user)


def is_commissioner(user: User) -> bool:
    return (
        _normalize_role(
            getattr(user, "role", None)
        )
        == ROLE_COMMISSIONER
    )


def can_manage_alerts(user: User) -> bool:
    return (
        _normalize_role(
            getattr(user, "role", None)
        )
        in {
            ROLE_TRAFFIC_OPERATOR,
            ROLE_SYSTEM_OPERATOR,
            ROLE_COMMISSIONER,
        }
    )


def can_submit_citizen_reports(user: User) -> bool:
    return (
        _normalize_role(
            getattr(user, "role", None)
        )
        in set(ALL_ROLES)
    )


def can_manage_users(user: User) -> bool:
    return is_commissioner(user)


def get_role_display_name(
    role: str | None,
) -> str:
    normalized = _normalize_role(role)

    return ROLE_DISPLAY_NAMES.get(
        normalized,
        "Unknown",
    )