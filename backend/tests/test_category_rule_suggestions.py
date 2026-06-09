from datetime import date
from decimal import Decimal

from app.models.transaction import Transaction


def test_category_rule_suggestions_group_uncategorised_transactions(client, db_session):
    transactions = [
        Transaction(
            date=date(2026, 5, 1),
            description="CONTINENTE",
            raw_description="CONTINENTE",
            amount=Decimal("10.00"),
            direction="out",
            source="trading212",
            account=None,
            category=None,
            subcategory=None,
            currency="EUR",
        ),
        Transaction(
            date=date(2026, 5, 2),
            description="CONTINENTE",
            raw_description="CONTINENTE",
            amount=Decimal("15.50"),
            direction="out",
            source="trading212",
            account=None,
            category=None,
            subcategory=None,
            currency="EUR",
        ),
        Transaction(
            date=date(2026, 5, 3),
            description="CONTINENTE",
            raw_description="CONTINENTE",
            amount=Decimal("20.00"),
            direction="out",
            source="trading212",
            account=None,
            category="Groceries",
            subcategory="Supermarket",
            currency="EUR",
        ),
        Transaction(
            date=date(2026, 5, 4),
            description="Salary",
            raw_description="Salary",
            amount=Decimal("1000.00"),
            direction="in",
            source="manual",
            account=None,
            category=None,
            subcategory=None,
            currency="EUR",
        ),
    ]

    db_session.add_all(transactions)
    db_session.commit()

    response = client.get("/api/category-rules/suggestions?direction=out&limit=10")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["description"] == "CONTINENTE"
    assert data[0]["source"] == "trading212"
    assert data[0]["direction"] == "out"
    assert data[0]["count"] == 2
    assert data[0]["total"] == "25.50"
