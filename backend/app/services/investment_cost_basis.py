from decimal import Decimal
from typing import Iterable

from app.models.investment_event import InvestmentEvent


ZERO = Decimal("0")

PositionKey = tuple[str, str | None, str | None, str | None]
CostBucket = dict[str, Decimal]
PositionState = dict[str, object]


def build_average_cost_positions(
    events: Iterable[InvestmentEvent],
) -> dict[PositionKey, PositionState]:
    """Apply moving weighted-average cost to investment events.

    Buy fees and taxes increase acquisition cost. Sell fees and taxes reduce
    net proceeds. A sell removes the average acquisition cost of units sold.
    """

    positions: dict[PositionKey, PositionState] = {}

    for event in events:
        if event.event_type not in {"market_buy", "market_sell"}:
            continue

        if event.quantity is None or event.quantity <= ZERO:
            continue

        key = (
            event.source,
            event.account,
            event.ticker,
            event.isin,
        )

        position = positions.setdefault(
            key,
            {
                "source": event.source,
                "account": event.account,
                "instrument_name": event.instrument_name,
                "ticker": event.ticker,
                "isin": event.isin,
                "quantity": ZERO,
                "cost_buckets": {},
            },
        )

        cost_buckets = position["cost_buckets"]
        bucket = cost_buckets.setdefault(
            event.currency,
            {
                "quantity": ZERO,
                "total_cost": ZERO,
                "realised_gain": ZERO,
            },
        )

        if event.event_type == "market_buy":
            acquisition_cost = (
                event.amount
                + _optional_amount(event.fees)
                + _optional_amount(event.taxes)
            )
            position["quantity"] += event.quantity
            bucket["quantity"] += event.quantity
            bucket["total_cost"] += acquisition_cost

            if position["instrument_name"] is None:
                position["instrument_name"] = event.instrument_name

            continue

        _apply_average_cost_sell(
            position=position,
            bucket=bucket,
            event=event,
        )

    return positions


def _apply_average_cost_sell(
    position: PositionState,
    bucket: CostBucket,
    event: InvestmentEvent,
) -> None:
    available_quantity = bucket["quantity"]

    if available_quantity <= ZERO:
        raise ValueError(
            "Investment sell has no matching positive cost bucket"
        )

    if event.quantity > available_quantity:
        raise ValueError(
            "Investment sell quantity exceeds the matching cost bucket"
        )

    average_cost = bucket["total_cost"] / available_quantity
    allocated_cost = average_cost * event.quantity
    net_proceeds = (
        event.amount
        - _optional_amount(event.fees)
        - _optional_amount(event.taxes)
    )

    position["quantity"] -= event.quantity
    bucket["realised_gain"] += net_proceeds - allocated_cost

    if event.quantity == available_quantity:
        bucket["quantity"] = ZERO
        bucket["total_cost"] = ZERO
        return

    bucket["quantity"] -= event.quantity
    bucket["total_cost"] -= allocated_cost


def _optional_amount(value: Decimal | None) -> Decimal:
    return value if value is not None else ZERO
