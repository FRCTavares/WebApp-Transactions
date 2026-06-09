from datetime import date
from decimal import Decimal

from app.utils.hashing import create_dedupe_hash


def test_create_dedupe_hash_is_stable():
    first_hash = create_dedupe_hash(
        source="revolut",
        transaction_date=date(2026, 6, 9),
        amount=Decimal("25.50"),
        direction="out",
        raw_description="Groceries",
        currency="EUR",
    )

    second_hash = create_dedupe_hash(
        source="REVOLUT",
        transaction_date=date(2026, 6, 9),
        amount=Decimal("25.500"),
        direction="OUT",
        raw_description="Groceries",
        currency="eur",
    )

    assert first_hash == second_hash
    assert len(first_hash) == 64
