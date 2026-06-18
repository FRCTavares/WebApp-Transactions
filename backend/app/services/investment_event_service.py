from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.investment_event import InvestmentEvent
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.market_price_history_repository import MarketPriceHistoryRepository
from app.repositories.market_price_repository import MarketPriceRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.investment_event import (
    InvestmentEventCreate,
    InvestmentEventUpdate,
    ManualFundingResolutionCreate,
)
from app.schemas.transaction import TransactionCreate


class InvestmentEventService:
    def __init__(
        self,
        repository: InvestmentEventRepository,
        transaction_repository: TransactionRepository | None = None,
        market_price_repository: MarketPriceRepository | None = None,
        market_price_history_repository: MarketPriceHistoryRepository | None = None,
    ) -> None:
        self.repository = repository
        self.transaction_repository = transaction_repository
        self.market_price_repository = market_price_repository
        self.market_price_history_repository = market_price_history_repository

    def create_event(
        self,
        event_data: InvestmentEventCreate,
        current_user: CurrentUser | None = None,
    ) -> InvestmentEvent:
        return self.repository.create(event_data)

    def list_events(
        self,
        source: str | None = None,
        event_type: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 100,
        offset: int = 0,
        current_user: CurrentUser | None = None,
    ) -> list[InvestmentEvent]:
        events = self.repository.list(
            source=source,
            event_type=event_type,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        )

        return [self._attach_matched_transaction(event) for event in events]

    def list_positions(
        self,
        source: str | None = None,
        current_user: CurrentUser | None = None,
    ) -> list[dict[str, object]]:
        events = self.repository.list_all(source=source)
        positions: dict[tuple[str, str | None, str | None, str | None], dict[str, object]] = {}

        for event in events:
            if event.event_type not in {"market_buy", "market_sell"}:
                continue

            if event.quantity is None or event.quantity <= 0:
                continue

            key = (
                event.source,
                event.account,
                event.ticker,
                event.isin,
            )

            if key not in positions:
                positions[key] = {
                    "source": event.source,
                    "account": event.account,
                    "instrument_name": event.instrument_name,
                    "ticker": event.ticker,
                    "isin": event.isin,
                    "quantity": Decimal("0"),
                    "cost_buckets": {},
                }

            position = positions[key]
            cost_buckets = position["cost_buckets"]

            if event.currency not in cost_buckets:
                cost_buckets[event.currency] = {
                    "quantity": Decimal("0"),
                    "total_cost": Decimal("0"),
                }

            bucket = cost_buckets[event.currency]

            if event.event_type == "market_buy":
                position["quantity"] = position["quantity"] + event.quantity
                bucket["quantity"] = bucket["quantity"] + event.quantity
                bucket["total_cost"] = bucket["total_cost"] + event.amount

                if position["instrument_name"] is None:
                    position["instrument_name"] = event.instrument_name

            if event.event_type == "market_sell":
                position["quantity"] = position["quantity"] - event.quantity
                bucket["quantity"] = bucket["quantity"] - event.quantity
                bucket["total_cost"] = bucket["total_cost"] - event.amount

        open_positions = []

        for position in positions.values():
            quantity = position["quantity"]

            if quantity <= 0:
                continue

            costs = []

            for currency, bucket in sorted(position["cost_buckets"].items()):
                bucket_quantity = bucket["quantity"]
                total_cost = bucket["total_cost"]

                if bucket_quantity <= 0 or total_cost <= 0:
                    continue

                costs.append(
                    {
                        "currency": currency,
                        "total_cost": total_cost.quantize(Decimal("0.01")),
                        "average_price": (total_cost / bucket_quantity).quantize(Decimal("0.00000001")),
                    }
                )

            if not costs:
                continue

            market_fields = self._get_market_fields(
                ticker=position["ticker"],
                isin=position["isin"],
                quantity=quantity,
                costs=costs,
            )

            open_positions.append(
                {
                    "source": position["source"],
                    "account": position["account"],
                    "instrument_name": position["instrument_name"],
                    "ticker": position["ticker"],
                    "isin": position["isin"],
                    "quantity": quantity.quantize(Decimal("0.00000001")),
                    "costs": costs,
                    **market_fields,
                }
            )

        return sorted(
            open_positions,
            key=lambda position: (
                str(position["ticker"] or ""),
                str(position["instrument_name"] or ""),
            ),
        )

    def get_monthly_change(
        self,
        year: int,
        month: int,
        current_user: CurrentUser | None = None,
    ) -> dict[str, Decimal | str]:
        start_date = date(year, month, 1)
        end_date = self._get_next_month_start(year, month)
        month_end = end_date.fromordinal(end_date.toordinal() - 1)

        start_value = self._get_portfolio_value_on(start_date, current_user)
        end_value = self._get_portfolio_value_on(month_end, current_user)
        net_invested = self._get_net_invested_between(
            start_date,
            end_date,
            current_user,
        )

        unrealised_monthly_change = None

        if start_value is not None and end_value is not None:
            unrealised_monthly_change = (
                end_value - start_value - net_invested
            ).quantize(Decimal("0.01"))

        return {
            "month": f"{year:04d}-{month:02d}",
            "start_value": start_value,
            "end_value": end_value,
            "net_invested": net_invested,
            "unrealised_monthly_change": unrealised_monthly_change,
        }

    def _get_portfolio_value_on(
        self,
        value_date: date,
        current_user: CurrentUser | None = None,
    ) -> Decimal | None:
        if self.market_price_history_repository is None:
            return None

        holdings = self._get_holdings_on(value_date, current_user)
        total_value = Decimal("0")
        has_unpriced_holding = False

        for holding in holdings.values():
            quantity = holding["quantity"]

            if quantity <= 0:
                continue

            price = self.market_price_history_repository.get_latest_on_or_before(
                price_date=value_date,
                ticker=holding["ticker"],
                isin=holding["isin"],
            )

            if price is None:
                has_unpriced_holding = True
                continue

            fx_rate_to_eur = self._get_latest_fx_rate_to_eur(
                price.currency,
                ticker=holding["ticker"],
                isin=holding["isin"],
            )

            if fx_rate_to_eur is None:
                has_unpriced_holding = True
                continue

            total_value += quantity * price.close_price * fx_rate_to_eur

        if has_unpriced_holding:
            return None

        return total_value.quantize(Decimal("0.01"))

    def _get_holdings_on(
        self,
        value_date: date,
        current_user: CurrentUser | None = None,
    ) -> dict[tuple[str, str | None, str | None, str | None], dict[str, object]]:
        holdings: dict[tuple[str, str | None, str | None, str | None], dict[str, object]] = {}

        for event in self.repository.list_until(value_date):
            if event.event_type not in {"market_buy", "market_sell"}:
                continue

            if event.quantity is None or event.quantity <= 0:
                continue

            key = (
                event.source,
                event.account,
                event.ticker,
                event.isin,
            )

            if key not in holdings:
                holdings[key] = {
                    "ticker": event.ticker,
                    "isin": event.isin,
                    "quantity": Decimal("0"),
                }

            if event.event_type == "market_buy":
                holdings[key]["quantity"] = holdings[key]["quantity"] + event.quantity

            if event.event_type == "market_sell":
                holdings[key]["quantity"] = holdings[key]["quantity"] - event.quantity

        return holdings

    def _get_net_invested_between(
        self,
        start_date: date,
        end_date: date,
        current_user: CurrentUser | None = None,
    ) -> Decimal:
        net_invested = Decimal("0")

        for event in self.repository.list_between(start_date, end_date):
            if event.event_type not in {"market_buy", "market_sell"}:
                continue

            amount_eur = self._get_event_amount_eur(event)

            if amount_eur is None:
                continue

            if event.event_type == "market_buy":
                net_invested += amount_eur

            if event.event_type == "market_sell":
                net_invested -= amount_eur

        return net_invested.quantize(Decimal("0.01"))

    def _get_user_id(self, current_user: CurrentUser | None) -> str:
        if current_user is None:
            return LOCAL_DEFAULT_USER_ID

        return current_user.id

    def _get_event_amount_eur(self, event: InvestmentEvent) -> Decimal | None:
        if event.currency == "EUR":
            return event.amount

        if event.fx_rate_to_eur is not None:
            return event.amount * event.fx_rate_to_eur

        return None

    def _get_next_month_start(self, year: int, month: int) -> date:
        if month == 12:
            return date(year + 1, 1, 1)

        return date(year, month + 1, 1)

    def _get_market_fields(
        self,
        ticker: str | None,
        isin: str | None,
        quantity: Decimal,
        costs: list[dict[str, Decimal | str]],
    ) -> dict[str, Decimal | str | None]:
        empty_fields = {
            "market_price": None,
            "market_price_currency": None,
            "market_value": None,
            "market_value_currency": None,
            "market_fx_rate_to_eur": None,
            "unrealised_gain": None,
            "unrealised_gain_percent": None,
        }

        if self.market_price_repository is None:
            return empty_fields

        market_price = self.market_price_repository.get_latest_by_ticker_or_isin(
            ticker=ticker,
            isin=isin,
        )

        if market_price is None:
            return empty_fields

        market_value_native = quantity * market_price.price
        market_fx_rate_to_eur = self._get_latest_fx_rate_to_eur(
            market_price.currency,
            ticker=ticker,
            isin=isin,
        )

        if market_price.currency == "EUR":
            market_value = market_value_native.quantize(Decimal("0.01"))
            market_value_currency = "EUR"
            market_fx_rate_to_eur = Decimal("1")
        elif market_fx_rate_to_eur is not None:
            market_value = (market_value_native * market_fx_rate_to_eur).quantize(Decimal("0.01"))
            market_value_currency = "EUR"
        else:
            market_value = None
            market_value_currency = None

        unrealised_gain = None
        unrealised_gain_percent = None

        if market_value is not None:
            total_cost_eur = self._get_total_cost_in_eur(
                costs=costs,
                ticker=ticker,
                isin=isin,
            )

            if total_cost_eur is not None and total_cost_eur > 0:
                unrealised_gain = (market_value - total_cost_eur).quantize(Decimal("0.01"))
                unrealised_gain_percent = (
                    unrealised_gain / total_cost_eur * Decimal("100")
                ).quantize(Decimal("0.01"))

        return {
            "market_price": market_price.price.quantize(Decimal("0.00000001")),
            "market_price_currency": market_price.currency,
            "market_value": market_value,
            "market_value_currency": market_value_currency,
            "market_fx_rate_to_eur": market_fx_rate_to_eur,
            "unrealised_gain": unrealised_gain,
            "unrealised_gain_percent": unrealised_gain_percent,
        }

    def _get_latest_fx_rate_to_eur(
        self,
        currency: str,
        ticker: str | None = None,
        isin: str | None = None,
        current_user: CurrentUser | None = None,
    ) -> Decimal | None:
        if currency == "EUR":
            return Decimal("1")

        events = sorted(
            self.repository.list_all(),
            key=lambda item: item.date,
            reverse=True,
        )

        for event in events:
            if (
                event.fx_rate_to_eur is not None
                and event.fx_rate_to_eur > 0
                and (
                    event.currency == currency
                    or event.original_currency == currency
                )
            ):
                return event.fx_rate_to_eur

        for event in events:
            if event.event_type not in {"market_buy", "market_sell"}:
                continue

            if ticker is not None and event.ticker != ticker:
                continue

            if isin is not None and event.isin != isin:
                continue

            if event.currency != "EUR":
                continue

            if (
                event.quantity is None
                or event.price is None
                or event.quantity <= 0
                or event.price <= 0
                or event.amount <= 0
            ):
                continue

            native_value = event.quantity * event.price

            if native_value <= 0:
                continue

            return (event.amount / native_value).quantize(Decimal("0.00000008"))

        return None

    def _get_total_cost_in_eur(
        self,
        costs: list[dict[str, Decimal | str]],
        ticker: str | None = None,
        isin: str | None = None,
        current_user: CurrentUser | None = None,
    ) -> Decimal | None:
        total_cost_eur = Decimal("0")

        for cost in costs:
            currency = str(cost["currency"])
            total_cost = cost["total_cost"]

            if not isinstance(total_cost, Decimal):
                total_cost = Decimal(str(total_cost))

            fx_rate_to_eur = self._get_latest_fx_rate_to_eur(
                currency,
                ticker=ticker,
                isin=isin,
            )

            if fx_rate_to_eur is None:
                return None

            total_cost_eur += total_cost * fx_rate_to_eur

        return total_cost_eur.quantize(Decimal("0.01"))

    def get_event(
        self,
        event_id: int,
        current_user: CurrentUser | None = None,
    ) -> InvestmentEvent:
        event = self.repository.get_by_id(event_id)

        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investment event not found",
            )

        return self._attach_matched_transaction(event)

    def update_event(
        self,
        event_id: int,
        event_data: InvestmentEventUpdate,
        current_user: CurrentUser | None = None,
    ) -> InvestmentEvent:
        event = self.get_event(event_id, current_user)
        return self.repository.update(event, event_data)

    def delete_event(
        self,
        event_id: int,
        current_user: CurrentUser | None = None,
    ) -> None:
        event = self.get_event(event_id, current_user)
        self.repository.delete(event)


    def _attach_matched_transaction(self, event: InvestmentEvent) -> InvestmentEvent:
        matched_transaction = None

        if (
            self.transaction_repository is not None
            and event.matched_transaction_id is not None
        ):
            matched_transaction = self.transaction_repository.get_by_id(
                event.matched_transaction_id
            )

        event.matched_transaction = matched_transaction

        return event

    def resolve_manual_funding(
        self,
        event_id: int,
        resolution_data: ManualFundingResolutionCreate,
        current_user: CurrentUser | None = None,
    ) -> tuple[InvestmentEvent, int]:
        if self.transaction_repository is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Transaction repository is required",
            )

        event = self.get_event(event_id, current_user)

        if event.event_type != "deposit":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only deposit investment events can be manually resolved",
            )

        if event.funding_match_status != "unmatched":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only unmatched funding events can be manually resolved",
            )

        transaction = self.transaction_repository.create(
            TransactionCreate(
                date=resolution_data.date,
                description=resolution_data.description,
                raw_description=(
                    f"Manual funding resolution for investment event {event.id}: "
                    f"{event.raw_description}"
                ),
                amount=resolution_data.eur_amount,
                original_amount=event.amount,
                original_currency=event.currency,
                fx_rate_to_eur=resolution_data.eur_amount / event.amount,
                fx_rate_source="manual",
                direction="out",
                cashflow_type="investment",
                source="manual",
                account="ActivoBank",
                currency="EUR",
                notes=resolution_data.notes,
            ),
            user_id=self._get_user_id(current_user),
        )

        updated_event = self.repository.update(
            event,
            InvestmentEventUpdate(
                transaction_id=transaction.id,
                matched_transaction_id=transaction.id,
                funding_match_status="manual",
                fx_rate_to_eur=resolution_data.eur_amount / event.amount,
                fx_rate_source="manual",
            ),
        )

        return updated_event, transaction.id
