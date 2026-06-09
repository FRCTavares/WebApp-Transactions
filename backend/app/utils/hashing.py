import hashlib
from decimal import Decimal


def normalise_decimal_for_hash(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01'))}"


def create_dedupe_hash(
    source: str,
    transaction_date,
    amount: Decimal,
    direction: str,
    raw_description: str,
    currency: str,
) -> str:
    hash_input = "|".join(
        [
            source.strip().lower(),
            transaction_date.isoformat(),
            normalise_decimal_for_hash(amount),
            direction.strip().lower(),
            raw_description.strip(),
            currency.strip().upper(),
        ]
    )

    return hashlib.sha256(hash_input.encode("utf-8")).hexdigest()
