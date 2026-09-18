from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, initialize_database

from app.models.alert import Alert  # noqa: F401
from app.models.routes import RouteAnalysis  # noqa: F401
from app.models.traffic import TrafficRecord  # noqa: F401
from app.models.user import User  # noqa: F401

from app.modules.alerts.routes import router as alerts_router
from app.modules.analytics.routes import router as analytics_router
from app.modules.route_analysis.routes import (
    router as route_analysis_router,
)
from app.modules.traffic_monitoring.routes import (
    router as traffic_monitoring_router,
)
from app.modules.traffic_prediction.routes import (
    router as traffic_prediction_router,
)
from app.modules.user_management.routes import (
    auth_router,
    users_router,
)
from app.modules.workflow.routes import (
    router as workflow_router,
)


logger = logging.getLogger("irtms")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Intelligent Road Traffic Monitoring System (IRTMS) "
        "for real-time traffic monitoring, traffic prediction, "
        "route analysis, alerts, analytics, and role-based "
        "traffic management."
    ),
    docs_url="/docs" if settings.ENABLE_API_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_API_DOCS else None,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=list(
        dict.fromkeys(
            settings.CORS_ORIGINS + [settings.FRONTEND_URL]
        )
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


initialize_database()


API_PREFIX = settings.API_PREFIX


# Authentication:
# /auth/... -> /api/auth/...
app.include_router(
    auth_router,
    prefix=API_PREFIX,
)


# User management:
# /users/... -> /api/auth/users/...
app.include_router(
    users_router,
    prefix=f"{API_PREFIX}/auth",
)


# Traffic:
# /traffic/... -> /api/traffic/...
app.include_router(
    traffic_monitoring_router,
    prefix=API_PREFIX,
)


# Prediction:
# /prediction/... -> /api/prediction/...
app.include_router(
    traffic_prediction_router,
    prefix=API_PREFIX,
)


# Route analysis:
# /routes/... -> /api/routes/...
app.include_router(
    route_analysis_router,
    prefix=API_PREFIX,
)


# Alerts:
# /alerts/... -> /api/alerts/...
app.include_router(
    alerts_router,
    prefix=API_PREFIX,
)


# Analytics:
# /analytics/... -> /api/analytics/...
app.include_router(
    analytics_router,
    prefix=API_PREFIX,
)


# Workflow:
# /workflow/... -> /api/workflow/...
app.include_router(
    workflow_router,
    prefix=API_PREFIX,
)


@app.get(
    "/",
    tags=["System"],
    summary="IRTMS API information",
)
def root() -> dict[str, Any]:
    return {
        "name": settings.APP_NAME,
        "service": "IRTMS Backend API",
        "version": settings.APP_VERSION,
        "status": "running",
        "api_prefix": API_PREFIX,
    }


@app.get(
    "/health",
    tags=["System"],
    summary="Backend health check",
)
def health() -> dict[str, Any]:
    database_status = "healthy"

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        database_status = "unhealthy"
        logger.exception(
            "Database health check failed."
        )

    return {
        "status": (
            "healthy"
            if database_status == "healthy"
            else "degraded"
        ),
        "service": "IRTMS backend",
        "version": settings.APP_VERSION,
        "database": database_status,
    }
