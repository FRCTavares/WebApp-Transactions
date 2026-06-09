from fastapi import FastAPI

from app.database import Base, engine
from app.models import CategoryRule, ImportBatch, OwedItem, Transaction
from app.routers.category_rules import router as category_rules_router
from app.routers.imports import router as imports_router
from app.routers.owed import router as owed_router
from app.routers.summary import router as summary_router
from app.routers.transactions import router as transactions_router


Base.metadata.create_all(bind=engine)

app = FastAPI(title="F - Transactions API")

app.include_router(transactions_router)
app.include_router(owed_router)
app.include_router(summary_router)
app.include_router(imports_router)
app.include_router(category_rules_router)


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
