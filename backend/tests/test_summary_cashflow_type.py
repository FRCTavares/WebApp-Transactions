from datetime import date
from decimal import Decimal

from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import TransactionCreate
from app.services.summary_service import SummaryService
from app.repositories.summary_repository import SummaryRepository


def test_summary_counts_income_and_expense_but_excludes_non_personal_cashflows(db_session):
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
    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 4),
            description="Mother reimbursement",
            raw_description="TRF MOTHER",
            amount=Decimal("65.00"),
            direction="in",
            cashflow_type="reimbursement",
            source="activobank",
            currency="EUR",
            category="Refund",
        )
    )
    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 5),
            description="Psychologist appointment",
            raw_description="SOFIA PAYMENT",
            amount=Decimal("65.00"),
            direction="out",
            cashflow_type="reimbursed_expense",
            source="activobank",
            currency="EUR",
            category="Health",
        )
    )

    summary = service.get_monthly_summary(year=2026, month=5)

    assert summary.money_in == Decimal("1000.00")
    assert summary.money_out == Decimal("50.00")
    assert summary.net == Decimal("950.00")
    assert len(summary.top_expense_categories) == 1
    assert summary.top_expense_categories[0].category == "Groceries"
    assert summary.top_expense_categories[0].total == Decimal("50.00")


def test_summary_subtracts_owed_expenses_from_personal_money_out(db_session):
    transaction_repository = TransactionRepository(db_session)
    summary_repository = SummaryRepository(db_session)
    service = SummaryService(
        repository=summary_repository,
        transaction_repository=transaction_repository,
    )

    grocery_transaction = transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 1),
            description="Groceries",
            raw_description="Groceries",
            amount=Decimal("50.00"),
            direction="out",
            cashflow_type="expense",
            source="manual",
            currency="EUR",
            category="Groceries",
        )
    )
    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 2),
            description="Coffee",
            raw_description="Coffee",
            amount=Decimal("5.00"),
            direction="out",
            cashflow_type="expense",
            source="manual",
            currency="EUR",
            category="Food",
        )
    )
    transaction_repository.create(
        TransactionCreate(
            date=date(2026, 5, 3),
            description="Salary",
            raw_description="Salary",
            amount=Decimal("100.00"),
            direction="in",
            cashflow_type="income",
            source="manual",
            currency="EUR",
            category="Salary",
        )
    )

    from app.models.owed_item import OwedItem

    owed_item = OwedItem(
        person="Mother",
        amount_total=Decimal("30.00"),
        amount_paid=Decimal("0.00"),
        amount_remaining=Decimal("30.00"),
        reason="Shared groceries",
        status="open",
        linked_transaction_id=grocery_transaction.id,
        source="manual",
    )
    db_session.add(owed_item)
    db_session.commit()

    summary = service.get_monthly_summary(year=2026, month=5)

    assert summary.money_in == Decimal("100.00")
    assert summary.money_out == Decimal("55.00")
    assert summary.owed_expense_amount == Decimal("30.00")
    assert summary.personal_money_out == Decimal("25.00")
    assert summary.net == Decimal("45.00")
    assert summary.personal_net == Decimal("75.00")
