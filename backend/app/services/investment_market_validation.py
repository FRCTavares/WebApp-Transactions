from decimal import Decimal

from fastapi import HTTPException, status

from app.models.investment_event import InvestmentEvent
from app.schemas.investment_event import InvestmentEventCreate, InvestmentEventUpdate


MarketEventCandidate = dict[str, object]


def build_create_event_candidate(
    event_data: InvestmentEventCreate,
) -> MarketEventCandidate:
    return {
        "id": None,
        "date": event_data.date,
        "source": event_data.source,
        "account": event_data.account,
        "event_type": event_data.event_type,
        "ticker": event_data.ticker,
        "isin": event_data.isin,
        "quantity": event_data.quantity,
        "price": event_data.price,
    }


def build_update_event_candidate(
    event: InvestmentEvent,
    event_data: InvestmentEventUpdate,
) -> MarketEventCandidate:
    update_data = event_data.model_dump(exclude_unset=True)

    return {
        "id": event.id,
        "date": update_data.get("date", event.date),
        "source": update_data.get("source", event.source),
        "account": update_data.get("account", event.account),
        "event_type": update_data.get("event_type", event.event_type),
        "ticker": update_data.get("ticker", event.ticker),
        "isin": update_data.get("isin", event.isin),
        "quantity": update_data.get("quantity", event.quantity),
        "price": update_data.get("price", event.price),
    }


def build_existing_event_candidate(
    event: InvestmentEvent,
) -> MarketEventCandidate:
    return {
        "id": event.id,
        "date": event.date,
        "source": event.source,
        "account": event.account,
        "event_type": event.event_type,
        "ticker": event.ticker,
        "isin": event.isin,
        "quantity": event.quantity,
        "price": event.price,
    }


def validate_market_event_candidate(candidate: MarketEventCandidate) -> None:
    if candidate["event_type"] not in {"market_buy", "market_sell"}:
        return

    quantity = candidate["quantity"]
    price = candidate["price"]

    if quantity is None or quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Investment buy/sell events require a positive quantity",
        )

    if price is None or price <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Investment buy/sell events require a positive price",
        )

    if not has_market_identity(candidate):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Investment buy/sell events require ticker or ISIN",
        )


def validate_market_sell_timeline(
    candidate: MarketEventCandidate,
    existing_events: list[InvestmentEvent],
    existing_event: InvestmentEvent | None = None,
) -> None:
    affected_keys = get_affected_market_identity_keys(
        candidate=candidate,
        existing_event=existing_event,
    )

    if not affected_keys:
        return

    entries: list[MarketEventCandidate] = []

    for event in existing_events:
        if existing_event is not None and event.id == existing_event.id:
            continue

        entry = build_existing_event_candidate(event)
        if get_market_identity_key(entry) in affected_keys:
            entries.append(entry)

    if candidate["event_type"] in {"market_buy", "market_sell"}:
        entries.append(candidate)

    entries.sort(
        key=lambda entry: (
            entry["date"],
            entry["id"] if entry["id"] is not None else 10**18,
        )
    )

    holdings: dict[tuple[str, str, str, str], Decimal] = {}

    for entry in entries:
        if entry["event_type"] not in {"market_buy", "market_sell"}:
            continue

        quantity = entry["quantity"]
        if quantity is None:
            continue

        key = get_market_identity_key(entry)
        current_quantity = holdings.get(key, Decimal("0"))

        if entry["event_type"] == "market_buy":
            holdings[key] = current_quantity + quantity
            continue

        if quantity > current_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Investment sell quantity cannot exceed available holdings",
            )

        holdings[key] = current_quantity - quantity


def get_affected_market_identity_keys(
    candidate: MarketEventCandidate,
    existing_event: InvestmentEvent | None,
) -> set[tuple[str, str, str, str]]:
    keys: set[tuple[str, str, str, str]] = set()

    if existing_event is not None and existing_event.event_type in {
        "market_buy",
        "market_sell",
    }:
        keys.add(get_market_identity_key(build_existing_event_candidate(existing_event)))

    if candidate["event_type"] in {"market_buy", "market_sell"}:
        keys.add(get_market_identity_key(candidate))

    return keys


def get_market_identity_key(
    candidate: MarketEventCandidate,
) -> tuple[str, str, str, str]:
    return (
        str(candidate["source"] or ""),
        str(candidate["account"] or ""),
        str(candidate["ticker"] or ""),
        str(candidate["isin"] or ""),
    )


def has_market_identity(candidate: MarketEventCandidate) -> bool:
    ticker = candidate["ticker"]
    isin = candidate["isin"]

    return bool(str(ticker or "").strip() or str(isin or "").strip())
