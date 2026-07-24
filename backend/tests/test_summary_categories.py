from datetime import date
from decimal import Decimal

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.models.transaction import Transaction
from app.repositories.summary_repository import SummaryRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.summary_service import SummaryService


LOCAL_CURRENT_USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)

def test_get_category_summary_groups_by_category_direction_and_month(db_session):
    transactions = [
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 1),
            description="Auchan",
            raw_description="Auchan",
            amount=Decimal("10.00"),
            direction="out",
            source="manual",
            account=None,
            category="Groceries",
            currency="EUR",
        ),
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 2),
            description="Auchan",
            raw_description="Auchan",
            amount=Decimal("15.50"),
            direction="out",
            source="manual",
            account=None,
            category="Groceries",
            currency="EUR",
        ),
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 3),
            description="Salary",
            raw_description="Salary",
            amount=Decimal("1000.00"),
            direction="in",
            source="manual",
            account=None,
            category="Income",
            currency="EUR",
        ),
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 6, 1),
            description="Metro",
            raw_description="Metro",
            amount=Decimal("2.00"),
            direction="out",
            source="manual",
            account=None,
            category="Transport",
            currency="EUR",
        ),
    ]

    db_session.add_all(transactions)
    db_session.commit()

    repository = TransactionRepository(db_session)

    rows = repository.get_category_summary(
        year=2026,
        month=5,
        direction="out",
        user_id=LOCAL_DEFAULT_USER_ID,
    )

    assert len(rows) == 1

    category, _subcategory, gross_total, owed_total, personal_total, count = rows[0]

    assert category == "Groceries"
    assert gross_total == Decimal("25.50")
    assert owed_total == Decimal("0")
    assert personal_total == Decimal("25.50")
    assert count == 2

def test_summary_service_defaults_out_category_summary_to_expenses(db_session):
    transactions = [
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 1),
            description="Groceries",
            raw_description="Groceries",
            amount=Decimal("10.00"),
            direction="out",
            source="manual",
            account=None,
            category="Groceries",
            currency="EUR",
            cashflow_type="expense",
        ),
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 2),
            description="Investment",
            raw_description="Investment",
            amount=Decimal("1000.00"),
            direction="out",
            source="manual",
            account=None,
            category="Investment",
            currency="EUR",
            cashflow_type="transfer",
        ),
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 3),
            description="Own-account transfer",
            raw_description="Own-account transfer",
            amount=Decimal("1450.00"),
            direction="out",
            source="manual",
            account=None,
            category="Transfers",
            currency="EUR",
            cashflow_type="transfer",
        ),
    ]

    db_session.add_all(transactions)
    db_session.commit()

    service = SummaryService(
        repository=SummaryRepository(db_session),
        transaction_repository=TransactionRepository(db_session),
    )

    response = service.get_category_summary(
        year=2026,
        month=5,
        direction="out",
        current_user=LOCAL_CURRENT_USER,
    )

    assert len(response.items) == 1
    assert response.items[0].category == "Groceries"
    assert response.items[0].total == Decimal("10.00")

def test_summary_service_defaults_in_category_summary_to_income(db_session):
    transactions = [
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 1),
            description="Salary",
            raw_description="Salary",
            amount=Decimal("100.00"),
            direction="in",
            source="manual",
            account=None,
            category="Salary",
            currency="EUR",
            cashflow_type="income",
        ),
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 2),
            description="Refund",
            raw_description="Refund",
            amount=Decimal("1000.00"),
            direction="in",
            source="manual",
            account=None,
            category="Refund",
            currency="EUR",
            cashflow_type="expense",
        ),
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 3),
            description="Savings transfer",
            raw_description="Savings transfer",
            amount=Decimal("550.00"),
            direction="in",
            source="manual",
            account=None,
            category="Transfer",
            currency="EUR",
            cashflow_type="transfer",
        ),
    ]

    db_session.add_all(transactions)
    db_session.commit()

    service = SummaryService(
        repository=SummaryRepository(db_session),
        transaction_repository=TransactionRepository(db_session),
    )

    response = service.get_category_summary(
        year=2026,
        month=5,
        direction="in",
        current_user=LOCAL_CURRENT_USER,
    )

    assert len(response.items) == 1
    assert response.items[0].category == "Salary"
    assert response.items[0].total == Decimal("100.00")

def test_summary_service_respects_explicit_cashflow_type_for_category_summary(db_session):
    transactions = [
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 1),
            description="Groceries",
            raw_description="Groceries",
            amount=Decimal("10.00"),
            direction="out",
            source="manual",
            account=None,
            category="Groceries",
            currency="EUR",
            cashflow_type="expense",
        ),
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 2),
            description="Investment",
            raw_description="Investment",
            amount=Decimal("1000.00"),
            direction="out",
            source="manual",
            account=None,
            category="Investment",
            currency="EUR",
            cashflow_type="transfer",
        ),
    ]

    db_session.add_all(transactions)
    db_session.commit()

    service = SummaryService(
        repository=SummaryRepository(db_session),
        transaction_repository=TransactionRepository(db_session),
    )

    response = service.get_category_summary(
        year=2026,
        month=5,
        direction="out",
        cashflow_type="transfer",
        current_user=LOCAL_CURRENT_USER,
    )

    assert len(response.items) == 1
    assert response.items[0].category == "Investment"
    assert response.items[0].total == Decimal("1000.00")


def test_category_summary_excludes_reconciled_investment_funding(
    db_session,
):
    groceries = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 5, 1),
        description="Groceries",
        raw_description="Groceries",
        amount=Decimal("25.00"),
        direction="out",
        source="manual",
        category="Groceries",
        currency="EUR",
        cashflow_type="expense",
    )
    funding = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 5, 2),
        description="Trading 212 funding",
        raw_description="Trading 212 funding",
        amount=Decimal("100.00"),
        direction="out",
        source="manual",
        category="Investments",
        currency="EUR",
        cashflow_type="expense",
    )
    db_session.add_all([groceries, funding])
    db_session.flush()

    db_session.add(
        InvestmentEvent(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 2),
            source="trading212",
            event_type="deposit",
            description="Trading 212 deposit",
            raw_description="Trading 212 deposit",
            amount=Decimal("100.00"),
            currency="EUR",
            funding_source="activobank",
            funding_match_status="manual",
            transaction_id=funding.id,
            matched_transaction_id=funding.id,
        )
    )
    db_session.commit()

    service = SummaryService(
        repository=SummaryRepository(db_session),
        transaction_repository=TransactionRepository(db_session),
    )

    response = service.get_category_summary(
        year=2026,
        month=5,
        direction="out",
        current_user=LOCAL_CURRENT_USER,
    )

    assert len(response.items) == 1
    assert response.items[0].category == "Groceries"
    assert response.items[0].total == Decimal("25.00")


def test_income_category_summary_excludes_linked_withdrawal(
    db_session,
):
    salary = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 5, 1),
        description="Salary",
        raw_description="Salary",
        amount=Decimal("1000.00"),
        direction="in",
        source="manual",
        category="Salary",
        currency="EUR",
        cashflow_type="income",
    )
    withdrawal = Transaction(
        user_id=LOCAL_DEFAULT_USER_ID,
        date=date(2026, 5, 2),
        description="Trading 212 withdrawal",
        raw_description="Trading 212 withdrawal",
        amount=Decimal("40.00"),
        direction="in",
        source="manual",
        category="Investment withdrawal",
        currency="EUR",
        cashflow_type="income",
    )
    db_session.add_all([salary, withdrawal])
    db_session.flush()

    db_session.add(
        InvestmentEvent(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 2),
            source="trading212",
            event_type="withdrawal",
            description="Trading 212 withdrawal",
            raw_description="Trading 212 withdrawal",
            amount=Decimal("40.00"),
            currency="EUR",
            funding_source="activobank",
            funding_match_status="manual",
            transaction_id=withdrawal.id,
            matched_transaction_id=withdrawal.id,
        )
    )
    db_session.commit()

    service = SummaryService(
        repository=SummaryRepository(db_session),
        transaction_repository=TransactionRepository(db_session),
    )

    response = service.get_category_summary(
        year=2026,
        month=5,
        direction="in",
        current_user=LOCAL_CURRENT_USER,
    )

    assert len(response.items) == 1
    assert response.items[0].category == "Salary"
    assert response.items[0].total == Decimal("1000.00")
