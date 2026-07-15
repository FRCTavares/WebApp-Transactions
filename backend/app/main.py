import os
import secrets
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.auth.current_user import (
    USER_EMAIL_HEADER,
    get_allowed_user_emails,
    is_supabase_auth_enabled,
    normalise_user_email,
)
from app.auth.local_network import (
    is_local_network_client,
    is_local_network_only_enabled,
)
from app.config import get_cors_origins, validate_production_config
from app.database import initialise_database
from app.middleware.upload_request import UploadRequestMiddleware
from app.models import (
    CashflowRule,
    DescriptionRule,
    ImportBatch,
    InvestmentEvent,
    InvestmentFundingMonth,
    MarketPrice,
    MarketPriceHistory,
    OwedItem,
    OwedPayment,
    OwedPaymentAllocation,
    Transaction,
    TransactionCategory,
    WealthAccount,
    WealthSnapshot,
)
from app.routers.admin import router as admin_router
from app.routers.cashflow_rules import router as cashflow_rules_router
from app.routers.description_rules import router as description_rules_router
from app.routers.export import router as export_router
from app.routers.imports import router as imports_router
from app.routers.investment_events import router as investment_events_router
from app.routers.investment_funding_months import router as investment_funding_months_router
from app.routers.legacy_excel_imports import router as legacy_excel_imports_router
from app.routers.market_prices import router as market_prices_router
from app.routers.me import router as me_router
from app.routers.owed import router as owed_router
from app.routers.summary import router as summary_router
from app.routers.transactions import router as transactions_router
from app.routers.transaction_categories import router as transaction_categories_router
from app.routers.wealth import router as wealth_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    validate_production_config()
    initialise_database()
    yield


app = FastAPI(title="F - Transactions API", lifespan=lifespan)

cors_origins = get_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(UploadRequestMiddleware)

ACCESS_TOKEN_HEADER = "X-App-Access-Token"



@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=()"
    )

    return response



@app.middleware("http")
async def require_local_network_client(request: Request, call_next):
    if not is_local_network_only_enabled():
        return await call_next(request)

    if request.method == "OPTIONS":
        return await call_next(request)

    if request.url.path == "/api/health":
        return await call_next(request)

    client_host = request.client.host if request.client else None

    if not is_local_network_client(client_host):
        return JSONResponse(
            status_code=403,
            content={"detail": "Client is not allowed by local network guard"},
        )

    return await call_next(request)


@app.middleware("http")
async def require_app_access_token(request: Request, call_next):
    if is_supabase_auth_enabled():
        return await call_next(request)

    expected_token = os.getenv("APP_ACCESS_TOKEN", "").strip()

    if not expected_token:
        return await call_next(request)

    if not request.url.path.startswith("/api/"):
        return await call_next(request)

    if request.method == "OPTIONS":
        return await call_next(request)

    if request.url.path == "/api/health":
        return await call_next(request)

    provided_token = request.headers.get(ACCESS_TOKEN_HEADER, "")

    if not secrets.compare_digest(provided_token, expected_token):
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or missing app access token"},
        )

    allowed_emails = get_allowed_user_emails()

    if allowed_emails:
        provided_email = normalise_user_email(
            request.headers.get(USER_EMAIL_HEADER, "")
        )

        if not provided_email:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing user email"},
            )

        if provided_email not in allowed_emails:
            return JSONResponse(
                status_code=403,
                content={"detail": "User email is not allowed"},
            )

    return await call_next(request)


app.include_router(admin_router)
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


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
