
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    ROLE_COMMISSIONER,
    get_current_user,
    require_commissioner,
)
from app.schemas.auth import (
    CommissionerRegisterRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.modules.user_management.service import (
    authenticate,
    change_role,
    delete_user,
    get_user,
    list_users,
    register,
    register_commissioner,
    set_user_active_status,
)


# ============================================================================
# AUTHENTICATION ROUTER
# ============================================================================

auth_router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# ============================================================================
# COMMISSIONER USER-MANAGEMENT ROUTER
# ============================================================================

users_router = APIRouter(
    prefix="/users",
    tags=["Commissioner User Management"],
)


# ============================================================================
# REQUEST SCHEMAS
# ============================================================================

class RoleUpdateRequest(BaseModel):
    """
    Request to change an existing user's role.

    Only a Commissioner can submit this request.
    """

    role: str = Field(
        ...,
        min_length=1,
        max_length=40,
    )


class AccountStatusRequest(BaseModel):
    """
    Request to activate or deactivate a user account.
    """

    is_active: bool


# ============================================================================
# PUBLIC REGISTRATION
# ============================================================================

@auth_router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Register a standard IRTMS user.

    Public registration creates a Commoner account.

    Traffic Operator, System Operator, and Commissioner accounts cannot be
    self-created through the normal registration endpoint.
    """

    try:
        user = register(
            db=db,
            full_name=request.full_name,
            email=str(request.email),
            password=request.password,
            role=request.role,
        )

        return user

    except ValueError as exc:
        message = str(exc)

        if "already registered" in message.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=message,
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )


# ============================================================================
# COMMISSIONER REGISTRATION
# ============================================================================

@auth_router.post(
    "/register/commissioner",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
def register_commissioner_user(
    request: CommissionerRegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Register a Commissioner through the dedicated Commissioner registration
    flow.

    The backend validates the registration code. A client cannot simply set
    role="commissioner" on the normal registration endpoint.
    """

    try:
        user = register_commissioner(
            db=db,
            full_name=request.full_name,
            email=str(request.email),
            password=request.password,
            registration_code=request.registration_code,
        )

        return user

    except ValueError as exc:
        message = str(exc)

        if "already registered" in message.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=message,
            )

        # Do not expose unnecessary details about the registration-code
        # mechanism.
        if "registration code" in message.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Commissioner registration is not authorized.",
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )


# ============================================================================
# LOGIN
# ============================================================================

@auth_router.post(
    "/login",
    response_model=TokenResponse,
)
def login_user(
    request: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Authenticate an IRTMS user and return a JWT.
    """

    try:
        result = authenticate(
            db=db,
            email=str(request.email),
            password=request.password,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    return result


# ============================================================================
# CURRENT USER
# ============================================================================

@auth_router.get(
    "/me",
    response_model=UserOut,
)
def get_me(
    current_user=Depends(get_current_user),
):
    """
    Return the authenticated user's current database-authoritative profile.
    """

    return current_user


@auth_router.get(
    "/profile",
    response_model=UserOut,
)
def get_profile(
    current_user=Depends(get_current_user),
):
    """
    Backward-compatible profile endpoint.

    Returns the same database-authoritative authenticated user.
    """

    return current_user


# ============================================================================
# COMMISSIONER: LIST USERS
# ============================================================================

@users_router.get(
    "",
    response_model=list[UserOut],
)
def users(
    db: Session = Depends(get_db),
    commissioner=Depends(require_commissioner),
):
    """
    Return all registered IRTMS users.

    Commissioner only.
    """

    return list_users(db)


# ============================================================================
# COMMISSIONER: GET USER
# ============================================================================

@users_router.get(
    "/{user_id}",
    response_model=UserOut,
)
def user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    commissioner=Depends(require_commissioner),
):
    """
    Return one user's account information.

    Commissioner only.
    """

    user = get_user(
        db=db,
        user_id=user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return user


# ============================================================================
# COMMISSIONER: CHANGE ROLE
# ============================================================================

@users_router.put(
    "/{user_id}/role",
    response_model=UserOut,
)
def update_user_role(
    user_id: int,
    request: RoleUpdateRequest,
    db: Session = Depends(get_db),
    commissioner=Depends(require_commissioner),
):
    """
    Change an existing user's role.

    Commissioner only.

    A Commissioner cannot change their own role.
    """

    if user_id == commissioner.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The Commissioner cannot change their own role.",
        )

    try:
        user = change_role(
            db=db,
            user_id=user_id,
            role=request.role,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return user


# ============================================================================
# COMMISSIONER: ACCOUNT STATUS
# ============================================================================

@users_router.patch(
    "/{user_id}/status",
    response_model=UserOut,
)
def update_account_status(
    user_id: int,
    request: AccountStatusRequest,
    db: Session = Depends(get_db),
    commissioner=Depends(require_commissioner),
):
    """
    Activate or deactivate a user account.

    Commissioner only.

    A Commissioner cannot deactivate their own account.
    """

    if (
        user_id == commissioner.id
        and not request.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The Commissioner cannot deactivate their own account.",
        )

    try:
        user = set_user_active_status(
            db=db,
            user_id=user_id,
            is_active=request.is_active,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return user


# ============================================================================
# COMMISSIONER: DELETE USER
# ============================================================================

@users_router.delete(
    "/{user_id}",
)
def remove_user(
    user_id: int,
    db: Session = Depends(get_db),
    commissioner=Depends(require_commissioner),
):
    """
    Permanently delete a user account.

    Commissioner only.

    A Commissioner cannot delete their own account.
    The service also prevents deletion of the final active Commissioner.
    """

    if user_id == commissioner.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The Commissioner cannot delete their own account.",
        )

    try:
        deleted = delete_user(
            db=db,
            user_id=user_id,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return {
        "success": True,
        "message": "User account deleted successfully.",
    }
