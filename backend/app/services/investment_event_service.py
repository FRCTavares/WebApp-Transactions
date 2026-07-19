from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser
from app.models.investment_event import InvestmentEvent
from app.models.market_price_history import MarketPriceHistory
from app.repositories.investment_event_repository import InvestmentEventRepository
from app.repositories.market_price_history_repository import (
    MarketPriceHistoryRepository,
)
from app.repositories.market_price_repository import MarketPriceRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.investment_market_validation import (
    build_create_event_candidate,
    build_update_event_candidate,
    validate_market_event_candidate,
    validate_market_sell_timeline,
)
from app.services.investment_event_relationship_validation import (
    validate_investment_transaction_links,
)
from app.schemas.investment_event import (
    InvestmentEventCreate,
    InvestmentEventUpdate,
    ManualFundingResolutionCreate,
)
from app.schemas.transaction import TransactionCreate
from app.services.investment_cost_basis import build_average_cost_positions


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
        *,
        current_user: CurrentUser,
    ) -> InvestmentEvent:
        user_id = current_user.id
        candidate = build_create_event_candidate(event_data)

        validate_investment_transaction_links(
            event_data,
            transaction_repository=self.transaction_repository,
            user_id=user_id,
        )
        validate_market_event_candidate(candidate)
        validate_market_sell_timeline(
            candidate=candidate,
            existing_events=self.repository.list_all(user_id=user_id),
        )

        return self.repository.create(
            event_data,
            user_id=user_id,
        )

    def get_activity_months(
        self,
        *,
        current_user: CurrentUser,
    ) -> set[str]:
        return {
            event.date.strftime("%Y-%m")
            for event in self.repository.list_all(user_id=current_user.id)
        }

    def list_events(
        self,
        source: str | None = None,
        event_type: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 100,
        offset: int = 0,
        *,
        current_user: CurrentUser,
    ) -> list[InvestmentEvent]:
        user_id = current_user.id
        events = self.repository.list(
            source=source,
            event_type=event_type,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
            user_id=user_id,
        )

        return [
            self._attach_matched_transaction(event, user_id=user_id) for event in events
        ]

    def list_positions(
        self,
        source: str | None = None,
        *,
        current_user: CurrentUser,
    ) -> list[dict[str, object]]:
        events = self.repository.list_all(
            source=source,
            user_id=current_user.id,
        )
        positions = build_average_cost_positions(events)

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
                        "average_price": (total_cost / bucket_quantity).quantize(
                            Decimal("0.00000001")
                        ),
                    }
                )

            if not costs:
                continue

            market_fields = self._get_market_fields(
                ticker=position["ticker"],
                isin=position["isin"],
                quantity=quantity,
                costs=costs,
                current_user=current_user,
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

    def list_realised_gains(
        self,
        source: str | None = None,
        *,
        current_user: CurrentUser,
    ) -> list[dict[str, object]]:
        positions = build_average_cost_positions(
            self.repository.list_all(source=source, user_id=current_user.id)
        )
        totals: dict[str, Decimal] = {}
        for position in positions.values():
            for currency, bucket in position["cost_buckets"].items():
                realised_gain = bucket["realised_gain"]
                totals[currency] = totals.get(currency, Decimal("0")) + realised_gain

        return [
            {"currency": currency, "amount": amount.quantize(Decimal("0.01"))}
            for currency, amount in sorted(totals.items())
        ]

    def get_monthly_change(
        self,
        year: int,
        month: int,
        *,
        current_user: CurrentUser,
    ) -> dict[str, Decimal | str]:
        start_date = date(year, month, 1)
        end_date = self._get_next_month_start(year, month)
        month_end = end_date.fromordinal(end_date.toordinal() - 1)

        start_value, start_value_estimated = self._get_portfolio_value_on(
            start_date,
            current_user=current_user,
        )
        end_value, end_value_estimated = self._get_portfolio_value_on(
            month_end,
            current_user=current_user,
        )
        net_invested = self._get_net_invested_between(
            start_date,
            end_date,
            current_user=current_user,
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
            "is_estimated": start_value_estimated or end_value_estimated,
        }

    def get_monthly_series(
        self,
        months: int = 24,
        *,
        current_user: CurrentUser,
    ) -> list[dict[str, Decimal | str | None]]:
        today = date.today()
        start_month = self._shift_month(
            date(today.year, today.month, 1),
            -(months - 1),
        )
        final_month_start = self._shift_month(start_month, months - 1)
        final_next_month_start = self._get_next_month_start(
            final_month_start.year,
            final_month_start.month,
        )
        final_month_end = final_next_month_start.fromordinal(
            final_next_month_start.toordinal() - 1
        )

        events = self.repository.list_all(user_id=current_user.id)
        price_history = (
            []
            if self.market_price_history_repository is None
            else self.market_price_history_repository.list_until(
                end_date=final_month_end,
            )
        )
        series = []

        for index in range(months):
            month_start = self._shift_month(start_month, index)
            next_month_start = self._get_next_month_start(
                month_start.year,
                month_start.month,
            )
            month_end = next_month_start.fromordinal(next_month_start.toordinal() - 1)
            effective_date = min(month_end, today)

            allocated, allocated_estimated = self._get_total_cost_basis_on(
                effective_date,
                current_user=current_user,
                events=events,
            )
            market_value, market_value_estimated = self._get_portfolio_value_on(
                effective_date,
                current_user=current_user,
                events=events,
                price_history=price_history,
            )
            gain = None

            if market_value is not None and allocated is not None:
                gain = (market_value - allocated).quantize(Decimal("0.01"))

            series.append(
                {
                    "month": f"{month_start.year:04d}-{month_start.month:02d}",
                    "allocated_eur": allocated,
                    "market_value_eur": market_value,
                    "gain_eur": gain,
                    "is_estimated": (allocated_estimated or market_value_estimated),
                }
            )

        return series

    def _get_total_cost_basis_on(
        self,
        value_date: date,
        *,
        current_user: CurrentUser,
        events: list[InvestmentEvent] | None = None,
    ) -> tuple[Decimal | None, bool]:
        holdings = self._get_holding_cost_buckets_on(
            value_date,
            current_user=current_user,
            events=events,
        )
        total_cost_eur = Decimal("0")
        is_estimated = False

        for holding in holdings.values():
            ticker = holding["ticker"]
            isin = holding["isin"]

            for currency, bucket in holding["cost_buckets"].items():
                quantity = bucket["quantity"]
                total_cost = bucket["total_cost"]

                if quantity <= 0 or total_cost <= 0:
                    continue

                fx_rate_to_eur, fx_is_estimated = self._get_historical_fx_rate_to_eur(
                    currency=currency,
                    value_date=value_date,
                    ticker=ticker,
                    isin=isin,
                    current_user=current_user,
                    events=events,
                )

                if fx_rate_to_eur is None:
                    return None, False

                total_cost_eur += total_cost * fx_rate_to_eur
                is_estimated = is_estimated or fx_is_estimated

        return total_cost_eur.quantize(Decimal("0.01")), is_estimated

    def _get_holding_cost_buckets_on(
        self,
        value_date: date,
        *,
        current_user: CurrentUser,
        events: list[InvestmentEvent] | None = None,
    ) -> dict[tuple[str, str | None, str | None, str | None], dict[str, object]]:
        relevant_events = (
            self.repository.list_until(
                value_date,
                user_id=current_user.id,
            )
            if events is None
            else [event for event in events if event.date <= value_date]
        )

        return build_average_cost_positions(relevant_events)

    def _shift_month(self, month_date: date, offset: int) -> date:
        month_index = month_date.year * 12 + month_date.month - 1 + offset
        year = month_index // 12
        month = month_index % 12 + 1

        return date(year, month, 1)

    def _get_portfolio_value_on(
        self,
        value_date: date,
        *,
        current_user: CurrentUser,
        events: list[InvestmentEvent] | None = None,
        price_history: list[MarketPriceHistory] | None = None,
    ) -> tuple[Decimal | None, bool]:
        if self.market_price_history_repository is None:
            return None, False

        holdings = self._get_holdings_on(
            value_date,
            current_user=current_user,
            events=events,
        )
        total_value = Decimal("0")
        is_estimated = False

        for holding in holdings.values():
            quantity = holding["quantity"]

            if quantity <= 0:
                continue

            valuation_price = self._get_valuation_price_on(
                value_date=value_date,
                ticker=holding["ticker"],
                isin=holding["isin"],
                current_user=current_user,
                events=events,
                price_history=price_history,
            )

            if valuation_price is None:
                return None, False

            price_value, price_currency, price_is_estimated = valuation_price
            fx_rate_to_eur, fx_is_estimated = self._get_historical_fx_rate_to_eur(
                currency=price_currency,
                value_date=value_date,
                ticker=holding["ticker"],
                isin=holding["isin"],
                current_user=current_user,
                events=events,
            )

            if fx_rate_to_eur is None:
                return None, False

            total_value += quantity * price_value * fx_rate_to_eur
            is_estimated = is_estimated or price_is_estimated or fx_is_estimated

        return total_value.quantize(Decimal("0.01")), is_estimated

    def _get_valuation_price_on(
        self,
        value_date: date,
        ticker: str | None,
        isin: str | None,
        *,
        current_user: CurrentUser,
        events: list[InvestmentEvent] | None = None,
        price_history: list[MarketPriceHistory] | None = None,
    ) -> tuple[Decimal, str, bool] | None:
        historical_price = None

        if price_history is not None:
            matching_prices = [
                price
                for price in price_history
                if price.price_date <= value_date
                and (
                    (ticker is not None and price.ticker == ticker)
                    or (isin is not None and price.isin == isin)
                )
            ]

            if matching_prices:
                historical_price = max(
                    matching_prices,
                    key=lambda price: (price.price_date, price.id),
                )
        elif self.market_price_history_repository is not None:
            historical_price = (
                self.market_price_history_repository.get_latest_on_or_before(
                    price_date=value_date,
                    ticker=ticker,
                    isin=isin,
                )
            )

        if historical_price is not None:
            return (
                historical_price.close_price,
                historical_price.currency,
                historical_price.price_date < value_date,
            )

        relevant_events = (
            self.repository.list_until(
                value_date,
                user_id=current_user.id,
            )
            if events is None
            else [event for event in events if event.date <= value_date]
        )

        for event in sorted(
            relevant_events,
            key=lambda item: (item.date, item.id),
            reverse=True,
        ):
            if event.event_type not in {"market_buy", "market_sell"}:
                continue

            if ticker is not None and event.ticker != ticker:
                continue

            if isin is not None and event.isin != isin:
                continue

            if event.price is None or event.price <= 0:
                continue

            return event.price, event.currency, True

        return None

    def _get_holdings_on(
        self,
        value_date: date,
        *,
        current_user: CurrentUser,
        events: list[InvestmentEvent] | None = None,
    ) -> dict[tuple[str, str | None, str | None, str | None], dict[str, object]]:
        holdings: dict[
            tuple[str, str | None, str | None, str | None],
            dict[str, object],
        ] = {}

        relevant_events = (
            self.repository.list_until(
                value_date,
                user_id=current_user.id,
            )
            if events is None
            else [event for event in events if event.date <= value_date]
        )

        for event in relevant_events:
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
        *,
        current_user: CurrentUser,
    ) -> Decimal:
        net_invested = Decimal("0")

        for event in self.repository.list_between(
            start_date,
            end_date,
            user_id=current_user.id,
        ):
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
        *,
        current_user: CurrentUser,
    ) -> dict[str, Decimal | str | None]:
        empty_fields = {
            "market_price": None,
            "market_price_currency": None,
            "market_price_source": None,
            "market_price_fetched_at": None,
            "market_value": None,
            "market_value_currency": None,
            "market_fx_rate_to_eur": None,
            "market_fx_rate_source": None,
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
        market_fx_rate_to_eur, market_fx_rate_source = self._get_latest_fx_rate_details(
            market_price.currency,
            ticker=ticker,
            isin=isin,
            current_user=current_user,
        )

        if market_price.currency == "EUR":
            market_value = market_value_native.quantize(Decimal("0.01"))
            market_value_currency = "EUR"
            market_fx_rate_to_eur = Decimal("1")
            market_fx_rate_source = "source_currency"
        elif market_fx_rate_to_eur is not None:
            market_value = (market_value_native * market_fx_rate_to_eur).quantize(
                Decimal("0.01")
            )
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
                current_user=current_user,
            )

            if total_cost_eur is not None and total_cost_eur > 0:
                unrealised_gain = (market_value - total_cost_eur).quantize(
                    Decimal("0.01")
                )
                unrealised_gain_percent = (
                    unrealised_gain / total_cost_eur * Decimal("100")
                ).quantize(Decimal("0.01"))

        return {
            "market_price": market_price.price.quantize(Decimal("0.00000001")),
            "market_price_currency": market_price.currency,
            "market_price_source": market_price.source,
            "market_price_fetched_at": market_price.fetched_at,
            "market_value": market_value,
            "market_value_currency": market_value_currency,
            "market_fx_rate_to_eur": market_fx_rate_to_eur,
            "market_fx_rate_source": market_fx_rate_source,
            "unrealised_gain": unrealised_gain,
            "unrealised_gain_percent": unrealised_gain_percent,
        }

    def _get_historical_fx_rate_to_eur(
        self,
        currency: str,
        value_date: date,
        ticker: str | None = None,
        isin: str | None = None,
        *,
        current_user: CurrentUser,
        events: list[InvestmentEvent] | None = None,
    ) -> tuple[Decimal | None, bool]:
        if currency == "EUR":
            return Decimal("1"), False

        relevant_events = (
            self.repository.list_until(
                value_date,
                user_id=current_user.id,
            )
            if events is None
            else [event for event in events if event.date <= value_date]
        )
        ordered_events = sorted(
            relevant_events,
            key=lambda item: (item.date, item.id),
            reverse=True,
        )

        for event in ordered_events:
            if (
                event.fx_rate_to_eur is not None
                and event.fx_rate_to_eur > 0
                and (event.currency == currency or event.original_currency == currency)
            ):
                return event.fx_rate_to_eur, event.date < value_date

        for event in ordered_events:
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

            return (event.amount / native_value).quantize(Decimal("0.00000008")), True

        return None, False

    def _get_latest_fx_rate_to_eur(
        self,
        currency: str,
        ticker: str | None = None,
        isin: str | None = None,
        *,
        current_user: CurrentUser,
    ) -> Decimal | None:
        return self._get_latest_fx_rate_details(
            currency,
            ticker=ticker,
            isin=isin,
            current_user=current_user,
        )[0]

    def _get_latest_fx_rate_details(
        self,
        currency: str,
        ticker: str | None = None,
        isin: str | None = None,
        *,
        current_user: CurrentUser,
    ) -> tuple[Decimal | None, str | None]:
        if currency == "EUR":
            return Decimal("1"), "source_currency"

        events = sorted(
            self.repository.list_all(user_id=current_user.id),
            key=lambda item: item.date,
            reverse=True,
        )

        for event in events:
            if (
                event.fx_rate_to_eur is not None
                and event.fx_rate_to_eur > 0
                and (event.currency == currency or event.original_currency == currency)
            ):
                return event.fx_rate_to_eur, event.fx_rate_source or "investment_event"

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

            return (
                (event.amount / native_value).quantize(Decimal("0.00000008")),
                "derived_from_eur_trade",
            )

        return None, None

    def _get_total_cost_in_eur(
        self,
        costs: list[dict[str, Decimal | str]],
        ticker: str | None = None,
        isin: str | None = None,
        *,
        current_user: CurrentUser,
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
                current_user=current_user,
            )

            if fx_rate_to_eur is None:
                return None

            total_cost_eur += total_cost * fx_rate_to_eur

        return total_cost_eur.quantize(Decimal("0.01"))

    def get_event(
        self,
        event_id: int,
        *,
        current_user: CurrentUser,
    ) -> InvestmentEvent:
        event = self.repository.get_by_id(
            event_id,
            user_id=current_user.id,
        )

        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investment event not found",
            )

        return self._attach_matched_transaction(event, user_id=current_user.id)

    def update_event(
        self,
        event_id: int,
        event_data: InvestmentEventUpdate,
        *,
        current_user: CurrentUser,
    ) -> InvestmentEvent:
        user_id = current_user.id
        event = self.get_event(event_id, current_user=current_user)
        candidate = build_update_event_candidate(event, event_data)

        validate_investment_transaction_links(
            event_data,
            transaction_repository=self.transaction_repository,
            user_id=user_id,
        )
        validate_market_event_candidate(candidate)
        validate_market_sell_timeline(
            candidate=candidate,
            existing_events=self.repository.list_all(user_id=user_id),
            existing_event=event,
        )

        return self.repository.update(event, event_data)

    def delete_event(
        self,
        event_id: int,
        *,
        current_user: CurrentUser,
    ) -> None:
        event = self.get_event(event_id, current_user=current_user)
        self.repository.delete(event)

    def _attach_matched_transaction(
        self,
        event: InvestmentEvent,
        *,
        user_id: str,
    ) -> InvestmentEvent:
        matched_transaction = None

        if (
            self.transaction_repository is not None
            and event.matched_transaction_id is not None
        ):
            matched_transaction = self.transaction_repository.get_by_id(
                event.matched_transaction_id,
                user_id=user_id,
            )

        event.matched_transaction = matched_transaction

        return event

    def resolve_manual_funding(
        self,
        event_id: int,
        resolution_data: ManualFundingResolutionCreate,
        *,
        current_user: CurrentUser,
    ) -> tuple[InvestmentEvent, int]:
        if self.transaction_repository is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Transaction repository is required",
            )

        event = self.get_event(event_id, current_user=current_user)

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
                cashflow_type="transfer",
                source="manual",
                account="ActivoBank",
                currency="EUR",
                notes=resolution_data.notes,
            ),
            user_id=current_user.id,
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
