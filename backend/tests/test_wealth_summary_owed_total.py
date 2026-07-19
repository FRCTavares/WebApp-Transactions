from datetime import date
from decimal import Decimal

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.models.market_price import MarketPrice
from app.models.owed_item import OwedItem
from app.models.wealth_account import WealthAccount
from app.models.wealth_snapshot import WealthSnapshot
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.market_price_repository import MarketPriceRepository
from app.repositories.owed_repository import OwedRepository
from app.repositories.wealth_repository import WealthRepository
from app.services.investment_event_service import InvestmentEventService
from app.services.wealth_service import WealthService


LOCAL_CURRENT_USER = CurrentUser(id=LOCAL_DEFAULT_USER_ID)


def test_wealth_summary_includes_active_owed_remaining_total(db_session):
    account = WealthAccount(
        user_id=LOCAL_DEFAULT_USER_ID,
        name="Savings",
        account_type="savings_account",
        currency="EUR",
        is_active=True,
    )
    db_session.add(account)
    db_session.flush()

    db_session.add(
        WealthSnapshot(
            user_id=LOCAL_DEFAULT_USER_ID,
            snapshot_date=date(2026, 6, 1),
            account_id=account.id,
            balance=Decimal("1000.00"),
            currency="EUR",
            balance_eur=Decimal("1000.00"),
            fx_rate_to_eur=Decimal("1.00000000"),
        )
    )
    db_session.add(
        OwedItem(
            user_id=LOCAL_DEFAULT_USER_ID,
            person="Mother",
            amount_total=Decimal("200.00"),
            amount_paid=Decimal("50.00"),
            amount_remaining=Decimal("150.00"),
            reason="Shared expenses",
            status="partially_paid",
        )
    )
    db_session.add(
        OwedItem(
            user_id=LOCAL_DEFAULT_USER_ID,
            person="Friend",
            amount_total=Decimal("30.00"),
            amount_paid=Decimal("30.00"),
            amount_remaining=Decimal("0.00"),
            reason="Paid back",
            status="paid",
        )
    )
    db_session.add(
        OwedItem(
            user_id=LOCAL_DEFAULT_USER_ID,
            person="Cancelled",
            amount_total=Decimal("40.00"),
            amount_paid=Decimal("0.00"),
            amount_remaining=Decimal("40.00"),
            reason="Cancelled item",
            status="cancelled",
        )
    )
    db_session.commit()

    service = WealthService(
        WealthRepository(db_session),
        OwedRepository(db_session),
    )

    summary = service.get_summary(current_user=LOCAL_CURRENT_USER)

    assert summary.money_owed_to_me_eur == Decimal("150.00")
    assert summary.current_total_wealth_eur == Decimal("1150.00")


def test_wealth_summary_derives_investments_without_counting_investment_snapshots(
    db_session,
):
    savings_account = WealthAccount(
        user_id=LOCAL_DEFAULT_USER_ID,
        name="Savings",
        account_type="savings_account",
        currency="EUR",
        is_active=True,
    )
    investment_account = WealthAccount(
        user_id=LOCAL_DEFAULT_USER_ID,
        name="Trading 212 CSPX",
        account_type="brokerage",
        currency="EUR",
        institution="Trading 212",
        is_active=True,
        value_source="investment",
        value_reference="CSPX",
    )
    db_session.add_all([savings_account, investment_account])
    db_session.flush()

    db_session.add_all(
        [
            WealthSnapshot(
                user_id=LOCAL_DEFAULT_USER_ID,
                snapshot_date=date(2026, 6, 1),
                account_id=savings_account.id,
                balance=Decimal("1000.00"),
                currency="EUR",
                balance_eur=Decimal("1000.00"),
                fx_rate_to_eur=Decimal("1.00000000"),
            ),
            WealthSnapshot(
                user_id=LOCAL_DEFAULT_USER_ID,
                snapshot_date=date(2026, 6, 1),
                account_id=investment_account.id,
                balance=Decimal("9999.00"),
                currency="EUR",
                balance_eur=Decimal("9999.00"),
                fx_rate_to_eur=Decimal("1.00000000"),
            ),
            InvestmentEvent(
                user_id=LOCAL_DEFAULT_USER_ID,
                date=date(2026, 6, 1),
                source="trading212",
                account="Trading 212",
                event_type="market_buy",
                description="Buy CSPX",
                raw_description="Buy CSPX",
                instrument_name="iShares Core S&P 500",
                ticker="CSPX",
                isin="IE00B5BMR087",
                quantity=Decimal("2"),
                price=Decimal("100"),
                amount=Decimal("200"),
                currency="EUR",
                fx_rate_to_eur=Decimal("1"),
            ),
            MarketPrice(
                ticker="CSPX",
                isin="IE00B5BMR087",
                price=Decimal("120"),
                currency="EUR",
                source="manual",
            ),
        ]
    )
    db_session.commit()

    investment_service = InvestmentEventService(
        repository=InvestmentEventRepository(db_session),
        market_price_repository=MarketPriceRepository(db_session),
    )
    service = WealthService(
        WealthRepository(db_session),
        OwedRepository(db_session),
        investment_event_service=investment_service,
    )

    summary = service.get_summary(current_user=LOCAL_CURRENT_USER)

    assert summary.investment_value_eur == Decimal("240.00")
    assert summary.current_total_wealth_eur == Decimal("1240.00")
    assert summary.account_count == 1
