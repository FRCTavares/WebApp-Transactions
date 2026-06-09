from datetime import date
from decimal import Decimal

from app.models.transaction import Transaction


def create_transaction(
    db_session,
    *,
    transaction_date,
    description,
    raw_description,
    amount,
    direction="out",
    source="manual",
    category=None,
):
    transaction = Transaction(
        date=transaction_date,
        description=description,
        raw_description=raw_description,
        amount=Decimal(amount),
        direction=direction,
        source=source,
        account="Test account",
        category=category,
        currency="EUR",
    )

    db_session.add(transaction)
    db_session.commit()
    db_session.refresh(transaction)

    return transaction


def test_list_transactions_filters_by_date_range(client, db_session):
    create_transaction(
        db_session,
        transaction_date=date(2026, 5, 1),
        description="Inside start",
        raw_description="Inside start",
        amount="10.00",
    )
    create_transaction(
        db_session,
        transaction_date=date(2026, 5, 15),
        description="Inside middle",
        raw_description="Inside middle",
        amount="20.00",
    )
    create_transaction(
        db_session,
        transaction_date=date(2026, 6, 1),
        description="Outside",
        raw_description="Outside",
        amount="30.00",
    )

    response = client.get(
        "/api/transactions?date_from=2026-05-01&date_to=2026-05-31"
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 2
    assert {transaction["description"] for transaction in data} == {
        "Inside start",
        "Inside middle",
    }


def test_list_transactions_filters_by_search_text(client, db_session):
    create_transaction(
        db_session,
        transaction_date=date(2026, 5, 1),
        description="Coffee shop",
        raw_description="CARD PAYMENT COFFEE SHOP",
        amount="3.50",
    )
    create_transaction(
        db_session,
        transaction_date=date(2026, 5, 2),
        description="Groceries",
        raw_description="SUPERMARKET PAYMENT",
        amount="25.00",
    )

    response = client.get("/api/transactions?search=coffee")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["description"] == "Coffee shop"


def test_list_transactions_combines_filters(client, db_session):
    matching_transaction = create_transaction(
        db_session,
        transaction_date=date(2026, 5, 10),
        description="Matched transaction",
        raw_description="SPECIAL MATCH",
        amount="12.00",
        direction="out",
        source="revolut",
        category="Food",
    )
    create_transaction(
        db_session,
        transaction_date=date(2026, 5, 10),
        description="Wrong source",
        raw_description="SPECIAL MATCH",
        amount="12.00",
        direction="out",
        source="manual",
        category="Food",
    )
    create_transaction(
        db_session,
        transaction_date=date(2026, 5, 10),
        description="Wrong direction",
        raw_description="SPECIAL MATCH",
        amount="12.00",
        direction="in",
        source="revolut",
        category="Food",
    )

    response = client.get(
        "/api/transactions?"
        "direction=out&"
        "source=revolut&"
        "category=Food&"
        "date_from=2026-05-01&"
        "date_to=2026-05-31&"
        "search=special"
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["id"] == matching_transaction.id
