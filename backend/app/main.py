import os
import secrets

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.auth.current_user import (
    USER_EMAIL_HEADER,
    get_allowed_user_emails,
    normalise_user_email,
)
from app.database import Base, engine
from app.database_migrations import run_startup_migrations
from app.models import (
    CashflowRule,
    CategoryRule,
    DescriptionRule,
    ImportBatch,
    InvestmentEvent,
    MarketPrice,
    MarketPriceHistory,
    OwedItem,
    OwedPayment,
    OwedPaymentAllocation,
    Transaction,
    WealthAccount,
    WealthSnapshot,
)
from app.routers.cashflow_rules import router as cashflow_rules_router
from app.routers.category_rules import router as category_rules_router
from app.routers.description_rules import router as description_rules_router
from app.routers.imports import router as imports_router
from app.routers.investment_events import router as investment_events_router
from app.routers.legacy_excel_imports import router as legacy_excel_imports_router
from app.routers.market_prices import router as market_prices_router
from app.routers.owed import router as owed_router
from app.routers.summary import router as summary_router
from app.routers.transactions import router as transactions_router
from app.routers.wealth import router as wealth_router


Base.metadata.create_all(bind=engine)
run_startup_migrations(engine)

app = FastAPI(title="F - Transactions API")

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ACCESS_TOKEN_HEADER = "X-App-Access-Token"


@app.middleware("http")
async def require_app_access_token(request: Request, call_next):
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


app.include_router(transactions_router)
app.include_router(owed_router)
app.include_router(summary_router)
app.include_router(imports_router)
app.include_router(investment_events_router)
app.include_router(legacy_excel_imports_router)
app.include_router(market_prices_router)
app.include_router(cashflow_rules_router)
app.include_router(category_rules_router)
app.include_router(description_rules_router)
app.include_router(wealth_router)


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
