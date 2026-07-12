from datetime import date
from decimal import Decimal

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.transaction import Transaction

def test_list_uncategorised_transactions_route_filters_uncategorised_outgoing(client, db_session):
    transactions = [
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 1),
            description="Uncategorised out",
            raw_description="Uncategorised out",
            amount=Decimal("10.00"),
            direction="out",
            source="manual",
            account=None,
            category=None,
            currency="EUR",
        ),
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 2),
            description="Categorised out",
            raw_description="Categorised out",
            amount=Decimal("20.00"),
            direction="out",
            source="manual",
            account=None,
            category="Groceries",
            currency="EUR",
        ),
        Transaction(
            user_id=LOCAL_DEFAULT_USER_ID,
            date=date(2026, 5, 3),
            description="Uncategorised in",
            raw_description="Uncategorised in",
            amount=Decimal("100.00"),
            direction="in",
            source="manual",
            account=None,
            category=None,
            currency="EUR",
        ),
    ]

    db_session.add_all(transactions)
    db_session.commit()

    response = client.get("/api/transactions/uncategorised?direction=out&limit=10")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["description"] == "Uncategorised out"
    assert data[0]["direction"] == "out"
    assert data[0]["category"] is None
