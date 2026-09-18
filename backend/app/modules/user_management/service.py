
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_COMMONER,
    ROLE_COMMISSIONER,
    ROLE_SYSTEM_OPERATOR,
    ROLE_TRAFFIC_OPERATOR,
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.user import User


# ============================================================================
# IRTMS ROLES
# ============================================================================

VALID_ROLES = {
    ROLE_COMMONER,
    ROLE_TRAFFIC_OPERATOR,
    ROLE_SYSTEM_OPERATOR,
    ROLE_COMMISSIONER,
}


# Legacy role aliases accepted when migrating/reading old data.
ROLE_ALIASES = {
    "operator": ROLE_SYSTEM_OPERATOR,
    "system operator": ROLE_SYSTEM_OPERATOR,
    "traffic operator": ROLE_TRAFFIC_OPERATOR,
    "commoner": ROLE_COMMONER,
    "commissioner": ROLE_COMMISSIONER,
}


# ============================================================================
# NORMALIZATION HELPERS
# ============================================================================

def normalize_email(email: str) -> str:
    """
    Normalize an email address for consistent database lookups.
    """

    if not email or not email.strip():
        raise ValueError("Email address is required.")

    return email.strip().lower()


def normalize_role(role: str | None) -> str:
    """
    Convert a role into the canonical IRTMS role identifier.

    Legacy:
        operator

    becomes:
        system_operator
    """

    if role is None:
        return ROLE_COMMONER

    normalized = role.strip().lower()

    normalized = ROLE_ALIASES.get(
        normalized,
        normalized,
    )

    if normalized not in VALID_ROLES:
        raise ValueError(
            "Invalid role selected."
        )

    return normalized


def validate_full_name(full_name: str) -> str:
    """
    Validate and normalize a user's full name.
    """

    if not full_name:
        raise ValueError(
            "Full name is required."
        )

    normalized = " ".join(
        full_name.strip().split()
    )

    if len(normalized) < 2:
        raise ValueError(
            "Full name must contain at least 2 characters."
        )

    if len(normalized) > 120:
        raise ValueError(
            "Full name cannot exceed 120 characters."
        )

    return normalized


def validate_password(password: str) -> str:
    """
    Validate a password before hashing.
    """

    if not password:
        raise ValueError(
            "Password is required."
        )

    if len(password) < 8:
        raise ValueError(
            "Password must contain at least 8 characters."
        )

    if len(password) > 128:
        raise ValueError(
            "Password cannot exceed 128 characters."
        )

    return password


# ============================================================================
# USER REGISTRATION
# ============================================================================

def register(
    db: Session,
    full_name: str,
    email: str,
    password: str,
    role: str = ROLE_COMMONER,
) -> User:
    """
    Register a normal IRTMS account.

    Public registration is intentionally restricted.

    Allowed public role:
        Commoner

    Privileged roles:
        Traffic Operator
        System Operator
        Commissioner

    cannot be self-assigned through this function.

    The administrative routes will use controlled role-management operations
    for privileged accounts.
    """

    normalized_name = validate_full_name(full_name)
    normalized_email = normalize_email(email)
    normalized_password = validate_password(password)
    requested_role = normalize_role(role)

    # ------------------------------------------------------------------------
    # Prevent privilege escalation during public registration.
    # ------------------------------------------------------------------------

    if requested_role != ROLE_COMMONER:
        raise ValueError(
            "Privileged roles cannot be self-assigned during public "
            "registration. Please use the authorized account-management "
            "process."
        )

    # ------------------------------------------------------------------------
    # Duplicate account check.
    # ------------------------------------------------------------------------

    existing_user = (
        db.query(User)
        .filter(
            User.email == normalized_email,
        )
        .first()
    )

    if existing_user is not None:
        raise ValueError(
            "Email is already registered."
        )

    # ------------------------------------------------------------------------
    # Create account.
    # ------------------------------------------------------------------------

    user = User(
        full_name=normalized_name,
        email=normalized_email,
        password_hash=hash_password(normalized_password),
        role=ROLE_COMMONER,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)

    except IntegrityError:
        db.rollback()

        # This also handles a race where another request registered the same
        # email between our duplicate check and INSERT.
        raise ValueError(
            "Email is already registered."
        )

    return user


# ============================================================================
# COMMISSIONER REGISTRATION
# ============================================================================

def register_commissioner(
    db: Session,
    full_name: str,
    email: str,
    password: str,
    registration_code: str,
) -> User:
    """
    Create a Commissioner account through the dedicated commissioner
    registration flow.

    The registration code is checked against the backend environment rather
    than accepting a Commissioner role from an ordinary public registration
    request.

    The actual API route is responsible for deciding whether this endpoint
    should be publicly available or protected by an existing Commissioner.
    """

    normalized_name = validate_full_name(full_name)
    normalized_email = normalize_email(email)
    normalized_password = validate_password(password)

    if not registration_code or not registration_code.strip():
        raise ValueError(
            "Commissioner registration code is required."
        )

    # ------------------------------------------------------------------------
    # Registration code
    # ------------------------------------------------------------------------

    from app.core.config import settings

    configured_code = getattr(
        settings,
        "COMMISSIONER_REGISTRATION_CODE",
        "",
    )

    configured_code = (
        configured_code.strip()
        if configured_code
        else ""
    )

    if not configured_code:
        raise ValueError(
            "Commissioner registration is not configured. "
            "Set COMMISSIONER_REGISTRATION_CODE in the backend environment."
        )

    if registration_code.strip() != configured_code:
        raise ValueError(
            "Invalid commissioner registration code."
        )

    # ------------------------------------------------------------------------
    # Prevent duplicate account.
    # ------------------------------------------------------------------------

    existing_user = (
        db.query(User)
        .filter(
            User.email == normalized_email,
        )
        .first()
    )

    if existing_user is not None:
        raise ValueError(
            "Email is already registered."
        )

    # ------------------------------------------------------------------------
    # Create Commissioner.
    # ------------------------------------------------------------------------

    user = User(
        full_name=normalized_name,
        email=normalized_email,
        password_hash=hash_password(normalized_password),
        role=ROLE_COMMISSIONER,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)

    except IntegrityError:
        db.rollback()

        raise ValueError(
            "Email is already registered."
        )

    return user


# ============================================================================
# AUTHENTICATION
# ============================================================================

def authenticate(
    db: Session,
    email: str,
    password: str,
) -> dict | None:
    """
    Authenticate an IRTMS user.

    Returns:
        {
            "access_token": "...",
            "token_type": "bearer",
            "user": User
        }

    Returns None for invalid credentials.

    Raises:
        ValueError for deactivated accounts.
    """

    normalized_email = normalize_email(email)

    if not password:
        return None

    user = (
        db.query(User)
        .filter(
            User.email == normalized_email,
        )
        .first()
    )

    if user is None:
        return None

    # ------------------------------------------------------------------------
    # Account status
    # ------------------------------------------------------------------------

    if not bool(user.is_active):
        raise ValueError(
            "This account has been deactivated. "
            "Please contact the Municipal Traffic Commissioner."
        )

    # ------------------------------------------------------------------------
    # Password
    # ------------------------------------------------------------------------

    if not verify_password(
        password,
        user.password_hash,
    ):
        return None

    # ------------------------------------------------------------------------
    # Legacy role normalization
    # ------------------------------------------------------------------------
    #
    # Existing accounts may still contain:
    #
    #     operator
    #
    # Normalize it to:
    #
    #     system_operator
    #
    # This is also persisted so that old values don't remain indefinitely.
    # ------------------------------------------------------------------------

    normalized_role = normalize_role(
        getattr(user, "role", None)
    )

    if user.role != normalized_role:
        user.role = normalized_role

    # ------------------------------------------------------------------------
    # Login timestamp
    # ------------------------------------------------------------------------

    now = datetime.now(timezone.utc)

    user.last_login_at = now
    user.updated_at = now

    try:
        db.commit()
        db.refresh(user)

    except Exception:
        db.rollback()
        raise

    # ------------------------------------------------------------------------
    # JWT
    # ------------------------------------------------------------------------

    access_token = create_access_token(
        subject=user.email,
        role=user.role,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


# ============================================================================
# USER QUERIES
# ============================================================================

def list_users(
    db: Session,
) -> list[User]:
    """
    Return all registered users.

    Authorization must be enforced by the calling route.
    """

    return (
        db.query(User)
        .order_by(
            User.id.asc()
        )
        .all()
    )


def get_user(
    db: Session,
    user_id: int,
) -> User | None:
    """
    Return a single user by ID.
    """

    return (
        db.query(User)
        .filter(
            User.id == user_id,
        )
        .first()
    )


def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:
    """
    Return a user by normalized email address.
    """

    normalized_email = normalize_email(email)

    return (
        db.query(User)
        .filter(
            User.email == normalized_email,
        )
        .first()
    )


# ============================================================================
# ROLE MANAGEMENT
# ============================================================================

def change_role(
    db: Session,
    user_id: int,
    role: str,
) -> User | None:
    """
    Change a user's role.

    Authorization must be enforced by the calling API route.

    The function itself only validates that the requested role is a valid
    canonical IRTMS role.
    """

    normalized_role = normalize_role(role)

    user = get_user(
        db,
        user_id,
    )

    if user is None:
        return None

    # ------------------------------------------------------------------------
    # Do not allow removal of the last active Commissioner.
    # ------------------------------------------------------------------------

    if (
        user.role == ROLE_COMMISSIONER
        and normalized_role != ROLE_COMMISSIONER
    ):
        commissioner_count = (
            db.query(User)
            .filter(
                User.role == ROLE_COMMISSIONER,
                User.is_active.is_(True),
            )
            .count()
        )

        if commissioner_count <= 1:
            raise ValueError(
                "The last active Commissioner cannot be removed. "
                "Create or activate another Commissioner first."
            )

    user.role = normalized_role
    user.updated_at = datetime.now(timezone.utc)

    try:
        db.commit()
        db.refresh(user)

    except Exception:
        db.rollback()
        raise

    return user


# ============================================================================
# ACCOUNT STATUS MANAGEMENT
# ============================================================================

def set_user_active_status(
    db: Session,
    user_id: int,
    is_active: bool,
) -> User | None:
    """
    Activate or deactivate a user account.

    Authorization must be enforced by the calling route.
    """

    user = get_user(
        db,
        user_id,
    )

    if user is None:
        return None

    requested_status = bool(is_active)

    # ------------------------------------------------------------------------
    # Prevent deactivating the final active Commissioner.
    # ------------------------------------------------------------------------

    if (
        user.role == ROLE_COMMISSIONER
        and user.is_active
        and not requested_status
    ):
        active_commissioners = (
            db.query(User)
            .filter(
                User.role == ROLE_COMMISSIONER,
                User.is_active.is_(True),
            )
            .count()
        )

        if active_commissioners <= 1:
            raise ValueError(
                "The last active Commissioner cannot be deactivated."
            )

    user.is_active = requested_status
    user.updated_at = datetime.now(timezone.utc)

    try:
        db.commit()
        db.refresh(user)

    except Exception:
        db.rollback()
        raise

    return user


# ============================================================================
# USER DELETION
# ============================================================================

def delete_user(
    db: Session,
    user_id: int,
) -> bool:
    """
    Permanently delete a user.

    Authorization must be enforced by the calling route.

    The final Commissioner cannot be deleted.
    """

    user = get_user(
        db,
        user_id,
    )

    if user is None:
        return False

    # ------------------------------------------------------------------------
    # Protect the final Commissioner.
    # ------------------------------------------------------------------------

    if user.role == ROLE_COMMISSIONER:
        commissioner_count = (
            db.query(User)
            .filter(
                User.role == ROLE_COMMISSIONER,
                User.is_active.is_(True),
            )
            .count()
        )

        if commissioner_count <= 1:
            raise ValueError(
                "The last active Commissioner cannot be deleted."
            )

    try:
        db.delete(user)
        db.commit()

    except Exception:
        db.rollback()
        raise

    return True
