import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import StringIO

from app.importers.base import NormalisedTransaction


class Trading212Importer:
    source = "trading212"

    def parse(self, csv_content: str) -> list[NormalisedTransaction]:
        reader = csv.DictReader(StringIO(csv_content))
        transactions: list[NormalisedTransaction] = []

        for row in reader:
            transaction = self._parse_row(row)
            transactions.append(transaction)

        return transactions

    def _parse_row(self, row: dict[str, str]) -> NormalisedTransaction:
        time = self._get_required_value(row, "Time")
        amount_text = self._get_required_value(row, "Total")
        currency = self._get_required_value(row, "Currency (Total)")
        external_id = self._get_optional_value(row, "ID")

        description = self._get_description(row)
        raw_description = self._build_raw_description(
            description=description,
            external_id=external_id,
        )
        amount = self._parse_amount(amount_text)
        direction = "in" if amount > 0 else "out"

        return NormalisedTransaction(
            date=self._parse_date(time),
            raw_description=raw_description,
            description=description,
            amount=abs(amount),
            direction=direction,
            source=self.source,
            account="Trading 212",
            currency=currency.upper(),
            external_id=external_id,
            notes=self._get_optional_value(row, "Action"),
        )

    def _build_raw_description(
        self,
        description: str,
        external_id: str | None,
    ) -> str:
        if external_id is None:
            return description

        return f"{description} | ID: {external_id}"

    def _get_description(self, row: dict[str, str]) -> str:
        for field_name in ("Merchant name", "Notes", "Action"):
            value = row.get(field_name)

            if value is not None and value.strip() != "":
                return value.strip()

        raise ValueError("Missing required Trading 212 description")

    def _get_required_value(self, row: dict[str, str], field_name: str) -> str:
        value = row.get(field_name)

        if value is None or value.strip() == "":
            raise ValueError(f"Missing required Trading 212 field: {field_name}")

        return value.strip()

    def _get_optional_value(self, row: dict[str, str], field_name: str) -> str | None:
        value = row.get(field_name)

        if value is None or value.strip() == "":
            return None

        return value.strip()

    def _parse_date(self, value: str):
        formats = (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y",
            "%Y-%m-%d",
        )

        for date_format in formats:
            try:
                return datetime.strptime(value, date_format).date()
            except ValueError:
                continue

        raise ValueError(f"Unsupported Trading 212 date format: {value}")

    def _parse_amount(self, value: str) -> Decimal:
        clean_value = value.strip().replace(",", "")

        try:
            return Decimal(clean_value)
        except InvalidOperation as error:
            raise ValueError(f"Invalid Trading 212 amount: {value}") from error
