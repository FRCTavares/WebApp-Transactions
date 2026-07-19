from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.services.health_service import get_build_commit, is_database_ready


router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "version": get_build_commit()}


@router.get("/ready")
def readiness_check():
    if not is_database_ready():
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready"},
        )

    return {"status": "ready"}
