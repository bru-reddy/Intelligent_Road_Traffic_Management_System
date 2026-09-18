
from __future__ import annotations

from typing import Callable

from fastapi import Depends

from app.core.security import (
    ROLE_COMMISSIONER,
    ROLE_COMMONER,
    ROLE_SYSTEM_OPERATOR,
    ROLE_TRAFFIC_OPERATOR,
    get_current_user,
    require_any_authenticated_user,
    require_commissioner,
    require_roles,
    require_system_operations,
    require_traffic_operations,
)
from app.models.user import User


# ============================================================================
# ROLE CONSTANTS
# ============================================================================
#
# Re-export the canonical roles here for compatibility with older
# user-management modules.
#
# New code should preferably import these directly from
# app.core.security.
# ============================================================================

COMMONER_ROLE = ROLE_COMMONER
TRAFFIC_OPERATOR_ROLE = ROLE_TRAFFIC_OPERATOR
SYSTEM_OPERATOR_ROLE = ROLE_SYSTEM_OPERATOR
COMMISSIONER_ROLE = ROLE_COMMISSIONER


# ============================================================================
# AUTHENTICATION COMPATIBILITY
# ============================================================================

# get_current_user is intentionally imported from app.core.security rather
# than implemented again here.
#
# This guarantees that all protected endpoints use the same authentication
# behavior:
#
#     JWT
#       ↓
#     validate token
#       ↓
#     extract email
#       ↓
#     database lookup
#       ↓
#     check is_active
#       ↓
#     database-authoritative role
#
# Existing modules that import get_current_user from this file will therefore
# continue to work.
# ============================================================================


# ============================================================================
# ROLE AUTHORIZATION COMPATIBILITY
# ============================================================================

def require_any_role(
    *roles: str,
) -> Callable:
    """
    Compatibility wrapper around the central security authorization system.

    Example:

        Depends(
            require_any_role(
                TRAFFIC_OPERATOR_ROLE,
                SYSTEM_OPERATOR_ROLE,
                COMMISSIONER_ROLE,
            )
        )
    """

    return require_roles(*roles)


# ============================================================================
# OPERATIONAL ACCESS
# ============================================================================

def require_operator(
    current_user: User = Depends(
        require_traffic_operations
    ),
) -> User:
    """
    Backward-compatible operational access dependency.

    Allowed roles:

        - Traffic Operator
        - System Operator
        - Commissioner

    The old implementation called the System Operator role "operator".
    That legacy name is intentionally no longer used as a canonical role.
    """

    return current_user


# ============================================================================
# SYSTEM-OPERATOR ACCESS
# ============================================================================

def require_system_operator(
    current_user: User = Depends(
        require_system_operations
    ),
) -> User:
    """
    System/application operations access.

    Allowed roles:

        - System Operator
        - Commissioner
    """

    return current_user


# ============================================================================
# TRAFFIC-OPERATOR ACCESS
# ============================================================================

def require_traffic_operator(
    current_user: User = Depends(
        require_traffic_operations
    ),
) -> User:
    """
    Operational traffic-management access.

    This compatibility dependency allows Traffic Operators, System Operators,
    and Commissioners because these roles are permitted to perform
    operational traffic actions in the current authorization model.
    """

    return current_user


# ============================================================================
# COMMISSIONER ACCESS
# ============================================================================

# Re-export the central Commissioner dependency.
#
# There is intentionally only ONE implementation.
#
# Any existing code doing:
#
#     from app.modules.user_management.dependencies import require_commissioner
#
# will continue to work.
# ============================================================================


# ============================================================================
# PUBLIC EXPORTS
# ============================================================================

__all__ = [
    "COMMONER_ROLE",
    "TRAFFIC_OPERATOR_ROLE",
    "SYSTEM_OPERATOR_ROLE",
    "COMMISSIONER_ROLE",
    "get_current_user",
    "require_any_authenticated_user",
    "require_any_role",
    "require_roles",
    "require_operator",
    "require_system_operator",
    "require_traffic_operator",
    "require_system_operations",
    "require_traffic_operations",
    "require_commissioner",
]
