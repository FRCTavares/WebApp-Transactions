from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.database_migrations import run_startup_migrations
from app.models import (
    CashflowRule,
    CategoryRule,
    DescriptionRule,
    ImportBatch,
    InvestmentEvent,
    OwedItem,
    Transaction,
)
from app.routers.cashflow_rules import router as cashflow_rules_router
from app.routers.category_rules import router as category_rules_router
from app.routers.description_rules import router as description_rules_router
from app.routers.imports import router as imports_router
from app.routers.owed import router as owed_router
from app.routers.summary import router as summary_router
from app.routers.transactions import router as transactions_router


Base.metadata.create_all(bind=engine)
run_startup_migrations(engine)

app = FastAPI(title="F - Transactions API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions_router)
app.include_router(owed_router)
app.include_router(summary_router)
app.include_router(imports_router)
app.include_router(cashflow_rules_router)
app.include_router(category_rules_router)
app.include_router(description_rules_router)


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
