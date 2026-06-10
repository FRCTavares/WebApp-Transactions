from datetime import date
from decimal import Decimal

from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import TransactionCreate
from app.services.summary_service import SummaryService
from app.repositories.summary_repository import SummaryRepository


def test_summary_counts_income_and_expense_but_excludes_internal_transfer(db_session):
    transaction_repository = TransactionRepository(db_session)
    summary_repository = SummaryRepository(db_session)
    service = SummaryService(
        repository=summary_repository,
        transaction_repository=transaction_repository,
    )

    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 1),
            description="Salary",
            raw_description="Salary",
            amount=Decimal("1000.00"),
            direction="in",
            source="manual",
            currency="EUR",
        )
    )
    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 2),
            description="Groceries",
            raw_description="Groceries",
            amount=Decimal("50.00"),
            direction="out",
            source="manual",
            currency="EUR",
            category="Groceries",
        )
    )
    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 3),
            description="ActivoBank to Revolut",
            raw_description="TRF P/ REVOLUT",
            amount=Decimal("200.00"),
            direction="out",
            cashflow_type="internal_transfer",
            source="activobank",
            currency="EUR",
            category="Transfers",
        )
    )

    summary = service.get_monthly_summary(year=2026, month=5)

    assert summary.money_in == Decimal("1000.00")
    assert summary.money_out == Decimal("50.00")
    assert summary.net == Decimal("950.00")
    assert len(summary.top_expense_categories) == 1
    assert summary.top_expense_categories[0].category == "Groceries"
    assert summary.top_expense_categories[0].total == Decimal("50.00")
