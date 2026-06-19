from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.cashflow_rule import CashflowRule
from app.models.category_rule import CategoryRule
from app.models.description_rule import DescriptionRule
from app.models.import_batch import ImportBatch
from app.models.investment_event import InvestmentEvent
from app.models.owed_item import OwedItem
from app.models.owed_payment import OwedPayment, OwedPaymentAllocation
from app.models.transaction import Transaction
from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot


UserScopedModel = TypeVar(
    "UserScopedModel",
    CashflowRule,
    CategoryRule,
    DescriptionRule,
    ImportBatch,
    InvestmentEvent,
    OwedItem,
    OwedPayment,
    OwedPaymentAllocation,
    Transaction,
    WealthAccount,
    WealthSnapshot,
)


class ExportRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_for_user(
        self,
        model: type[UserScopedModel],
        user_id: str,
    ) -> list[UserScopedModel]:
        statement = (
            select(model)
            .where(model.user_id == user_id)
            .order_by(model.id.asc())
        )

        return list(self.db.scalars(statement).all())

    def export_user_data(self, user_id: str) -> dict[str, list[object]]:
        return {
            "transactions": self.list_for_user(Transaction, user_id),
            "owed_items": self.list_for_user(OwedItem, user_id),
            "owed_payments": self.list_for_user(OwedPayment, user_id),
            "owed_payment_allocations": self.list_for_user(
                OwedPaymentAllocation,
                user_id,
            ),
            "wealth_accounts": self.list_for_user(WealthAccount, user_id),
            "wealth_snapshots": self.list_for_user(WealthSnapshot, user_id),
            "investment_events": self.list_for_user(InvestmentEvent, user_id),
            "import_batches": self.list_for_user(ImportBatch, user_id),
            "category_rules": self.list_for_user(CategoryRule, user_id),
            "cashflow_rules": self.list_for_user(CashflowRule, user_id),
            "description_rules": self.list_for_user(DescriptionRule, user_id),
        }
