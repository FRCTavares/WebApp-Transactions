from datetime import date
from decimal import Decimal

from app.models.transaction import Transaction
from app.repositories.transaction_repository import TransactionRepository


def test_get_category_summary_groups_by_category_subcategory_direction_and_month(db_session):
    transactions = [
        Transaction(
            date=date(2026, 5, 1),
            description="Auchan",
            raw_description="Auchan",
            amount=Decimal("10.00"),
            direction="out",
            source="manual",
            account=None,
            category="Groceries",
            subcategory="Supermarket",
            currency="EUR",
        ),
        Transaction(
            date=date(2026, 5, 2),
            description="Auchan",
            raw_description="Auchan",
            amount=Decimal("15.50"),
            direction="out",
            source="manual",
            account=None,
            category="Groceries",
            subcategory="Supermarket",
            currency="EUR",
        ),
        Transaction(
            date=date(2026, 5, 3),
            description="Salary",
            raw_description="Salary",
            amount=Decimal("1000.00"),
            direction="in",
            source="manual",
            account=None,
            category="Income",
            subcategory=None,
            currency="EUR",
        ),
        Transaction(
            date=date(2026, 6, 1),
            description="Metro",
            raw_description="Metro",
            amount=Decimal("2.00"),
            direction="out",
            source="manual",
            account=None,
            category="Transport",
            subcategory="Public transport",
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
    )

    assert len(rows) == 1

    category, subcategory, total, count = rows[0]

    assert category == "Groceries"
    assert subcategory == "Supermarket"
    assert total == Decimal("25.50")
    assert count == 2
