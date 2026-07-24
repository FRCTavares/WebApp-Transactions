from datetime import date
from decimal import Decimal

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.models.transaction import Transaction


SUMMARY_URL = "/api/summary?year=2026&month=5"


def add_transaction(
    db_session,
    *,
    amount: str,
    direction: str,
    cashflow_type: str,
    user_id: str = LOCAL_DEFAULT_USER_ID,
    description: str = "Transaction",
    category: str | None = None,
) -> Transaction:
    transaction = Transaction(
        user_id=user_id,
        date=date(2026, 5, 10),
        description=description,
        raw_description=description,
        amount=Decimal(amount),
        direction=direction,
        cashflow_type=cashflow_type,
        source="manual",
        account="ActivoBank",
        category=category,
        currency="EUR",
    )
    db_session.add(transaction)
    db_session.flush()
    return transaction


def add_event(
    db_session,
    *,
    event_type: str,
    amount: str,
    currency: str = "EUR",
    user_id: str = LOCAL_DEFAULT_USER_ID,
    funding_source: str | None = None,
    funding_match_status: str | None = None,
    transaction_id: int | None = None,
    matched_transaction_id: int | None = None,
    fx_rate_to_eur: str | None = None,
    fx_rate_source: str | None = None,
) -> InvestmentEvent:
    event = InvestmentEvent(
        user_id=user_id,
        date=date(2026, 5, 10),
        source="trading212",
        account="Trading 212",
        event_type=event_type,
        description=event_type,
        raw_description=event_type,
        amount=Decimal(amount),
        currency=currency,
        original_amount=Decimal(amount),
        original_currency=currency,
        funding_source=funding_source,
        funding_match_status=funding_match_status,
        transaction_id=transaction_id,
        matched_transaction_id=matched_transaction_id,
        fx_rate_to_eur=(
            Decimal(fx_rate_to_eur)
            if fx_rate_to_eur is not None
            else None
        ),
        fx_rate_source=fx_rate_source,
    )
    db_session.add(event)
    db_session.flush()
    return event


def read_summary(client) -> dict[str, object]:
    response = client.get(SUMMARY_URL)
    assert response.status_code == 200
    return response.json()


def test_linked_deposit_is_counted_once_and_excluded_from_spending(
    client,
    db_session,
):
    add_transaction(
        db_session,
        amount="1000.00",
        direction="in",
        cashflow_type="income",
        description="Salary",
        category="Salary",
    )
    add_transaction(
        db_session,
        amount="100.00",
        direction="out",
        cashflow_type="expense",
        description="Groceries",
        category="Groceries",
    )
    funding_transaction = add_transaction(
        db_session,
        amount="100.00",
        direction="out",
        cashflow_type="expense",
        description="Trading 212 funding",
        category="Investments",
    )
    add_event(
        db_session,
        event_type="deposit",
        amount="100.00",
        funding_source="activobank",
        funding_match_status="manual",
        transaction_id=funding_transaction.id,
        matched_transaction_id=funding_transaction.id,
    )
    add_event(
        db_session,
        event_type="market_buy",
        amount="100.00",
    )
    db_session.commit()

    summary = read_summary(client)

    assert summary["money_in"] == "1000.00"
    assert summary["money_out"] == "100.00"
    assert summary["personal_money_out"] == "100.00"
    assert summary["net_invested_cash"] == "100.00"
    assert summary["available_net"] == "800.00"
    assert summary["investment_cashflow_status"] == "available"
    assert summary["investment_reconciliation_status"] == "complete"
    assert summary["investment_goal_eur"] == "100.00"
    assert summary["investment_goal_remaining"] == "0.00"
    assert summary["investment_goal_over"] == "0.00"
    assert summary["investment_goal_status"] == "reached"
    assert summary["top_expense_categories"] == [
        {
            "category": "Groceries",
            "total": "100.00",
        }
    ]


def test_deposits_less_withdrawals_define_net_invested_cash(
    client,
    db_session,
):
    add_event(db_session, event_type="deposit", amount="150.00")
    add_event(db_session, event_type="withdrawal", amount="40.00")

    for event_type in (
        "market_buy",
        "market_sell",
        "dividend",
        "interest",
        "fee",
        "fx_conversion",
    ):
        add_event(
            db_session,
            event_type=event_type,
            amount="999.00",
        )

    db_session.commit()

    summary = read_summary(client)

    assert summary["net_invested_cash"] == "110.00"
    assert summary["available_net"] == "-110.00"
    assert summary["investment_reconciliation_status"] == "not_applicable"
    assert summary["investment_goal_remaining"] == "0.00"
    assert summary["investment_goal_over"] == "10.00"
    assert summary["investment_goal_status"] == "exceeded"


def test_custom_goal_reports_in_progress_state(client, db_session):
    response = client.put(
        "/api/preferences",
        json={
            "locale": "en-GB",
            "currency": "EUR",
            "time_zone": "Europe/Lisbon",
            "date_format": "medium",
            "language": "en",
            "monthly_investment_goal_eur": "250.00",
        },
    )
    assert response.status_code == 200

    add_event(db_session, event_type="deposit", amount="100.00")
    db_session.commit()

    summary = read_summary(client)

    assert summary["investment_goal_eur"] == "250.00"
    assert summary["net_invested_cash"] == "100.00"
    assert summary["investment_goal_remaining"] == "150.00"
    assert summary["investment_goal_over"] == "0.00"
    assert summary["investment_goal_status"] == "in_progress"


def test_unresolved_non_eur_cashflow_makes_available_net_unavailable(
    client,
    db_session,
):
    add_event(
        db_session,
        event_type="deposit",
        amount="100.00",
        currency="USD",
        funding_source="activobank",
        funding_match_status="unmatched",
        fx_rate_source="pending",
    )
    db_session.commit()

    summary = read_summary(client)

    assert summary["net_invested_cash"] is None
    assert summary["available_net"] is None
    assert summary["investment_cashflow_status"] == "unavailable"
    assert summary["investment_reconciliation_status"] == "partial"
    assert summary["investment_goal_remaining"] is None
    assert summary["investment_goal_over"] is None
    assert summary["investment_goal_status"] == "unavailable"


def test_resolved_fx_is_decimal_and_other_users_are_excluded(
    client,
    db_session,
):
    add_transaction(
        db_session,
        amount="200.00",
        direction="in",
        cashflow_type="income",
        description="Salary",
    )
    other_user_transaction = add_transaction(
        db_session,
        amount="90.00",
        direction="out",
        cashflow_type="transfer",
        user_id="other-user",
        description="Other user funding",
    )
    add_event(
        db_session,
        event_type="deposit",
        amount="100.00",
        currency="USD",
        funding_source="activobank",
        funding_match_status="manual",
        transaction_id=other_user_transaction.id,
        matched_transaction_id=other_user_transaction.id,
        fx_rate_to_eur="0.90",
        fx_rate_source="manual",
    )
    add_event(
        db_session,
        event_type="deposit",
        amount="999.00",
        user_id="other-user",
    )
    db_session.commit()

    summary = read_summary(client)

    assert summary["money_in"] == "200.00"
    assert summary["net_invested_cash"] == "90.00"
    assert summary["available_net"] == "110.00"
    assert summary["investment_reconciliation_status"] == "partial"
    assert summary["investment_goal_remaining"] == "10.00"


def test_linked_withdrawal_income_is_not_counted_twice(
    client,
    db_session,
):
    withdrawal_transaction = add_transaction(
        db_session,
        amount="40.00",
        direction="in",
        cashflow_type="income",
        description="Trading 212 withdrawal",
        category="Investment withdrawal",
    )
    add_event(
        db_session,
        event_type="withdrawal",
        amount="40.00",
        funding_source="activobank",
        funding_match_status="manual",
        transaction_id=withdrawal_transaction.id,
        matched_transaction_id=withdrawal_transaction.id,
    )
    db_session.commit()

    summary = read_summary(client)

    assert summary["money_in"] == "0.00"
    assert summary["net_invested_cash"] == "-40.00"
    assert summary["available_net"] == "40.00"
    assert summary["investment_reconciliation_status"] == "complete"
