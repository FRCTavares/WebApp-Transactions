from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.auth.local_network import (
    is_local_network_client,
    is_local_network_only_enabled,
)
from app.config import (
    get_api_docs_enabled,
    get_cors_origins,
    validate_e2e_config,
    validate_production_config,
    is_production,
)
from sqlalchemy.exc import OperationalError, TimeoutError as SqlAlchemyTimeoutError
from app.database import initialise_database
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.upload_request import UploadRequestMiddleware
from app.routers.admin import router as admin_router
from app.routers.cashflow_rules import router as cashflow_rules_router
from app.routers.description_rules import router as description_rules_router
from app.routers.export import router as export_router
from app.routers.health import router as health_router
from app.routers.imports import router as imports_router
from app.routers.investment_events import router as investment_events_router
from app.routers.investment_funding_months import (
    router as investment_funding_months_router,
)
from app.routers.legacy_excel_imports import router as legacy_excel_imports_router
from app.routers.market_prices import router as market_prices_router
from app.routers.me import router as me_router
from app.routers.owed import router as owed_router
from app.routers.summary import router as summary_router
from app.routers.transactions import router as transactions_router
from app.routers.transaction_categories import router as transaction_categories_router
from app.routers.wealth import router as wealth_router
from app.routers.user_preferences import router as user_preferences_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    validate_production_config()
    validate_e2e_config()
    initialise_database()
    yield


api_docs_enabled = get_api_docs_enabled()

app = FastAPI(
    title="F - Transactions API",
    lifespan=lifespan,
    docs_url="/docs" if api_docs_enabled else None,
    redoc_url="/redoc" if api_docs_enabled else None,
    openapi_url="/openapi.json" if api_docs_enabled else None,
)

cors_origins = get_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(UploadRequestMiddleware)

PUBLIC_HEALTH_PATHS = {"/api/health", "/api/ready"}


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; base-uri 'none'; form-action 'none'; "
        "frame-ancestors 'none'"
    )
    if is_production():
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )

    return response


def is_database_timeout(error: Exception) -> bool:
    if isinstance(error, SqlAlchemyTimeoutError):
        return True
    message = str(error).lower()
    return isinstance(error, OperationalError) and any(
        marker in message
        for marker in ("timeout", "timed out", "statement timeout", "lock timeout")
    )


@app.exception_handler(OperationalError)
@app.exception_handler(SqlAlchemyTimeoutError)
async def handle_database_timeout(request: Request, error: Exception):
    del request
    if not is_database_timeout(error):
        return JSONResponse(
            status_code=500, content={"detail": "Database operation failed"}
        )
    return JSONResponse(
        status_code=503,
        content={"detail": "Database operation timed out. Try again later."},
        headers={"Retry-After": "1"},
    )


@app.middleware("http")
async def require_local_network_client(request: Request, call_next):
    if not is_local_network_only_enabled():
        return await call_next(request)

    if request.method == "OPTIONS":
        return await call_next(request)

    if request.url.path in PUBLIC_HEALTH_PATHS:
        return await call_next(request)

    client_host = request.client.host if request.client else None

    if not is_local_network_client(client_host):
        return JSONResponse(
            status_code=403,
            content={"detail": "Client is not allowed by local network guard"},
        )

    return await call_next(request)


app.add_middleware(RequestLoggingMiddleware)

app.include_router(admin_router)
app.include_router(health_router)
app.include_router(transactions_router)
app.include_router(transaction_categories_router)
app.include_router(owed_router)
app.include_router(summary_router)
app.include_router(imports_router)
app.include_router(investment_events_router)
app.include_router(investment_funding_months_router)
app.include_router(legacy_excel_imports_router)
app.include_router(market_prices_router)
app.include_router(me_router)
app.include_router(cashflow_rules_router)
app.include_router(description_rules_router)
app.include_router(export_router)
app.include_router(wealth_router)
app.include_router(user_preferences_router)
