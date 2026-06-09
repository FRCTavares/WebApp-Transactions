import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import StringIO

from app.importers.base import NormalisedTransaction


class RevolutImporter:
    source = "revolut"

    def parse(self, csv_content: str) -> list[NormalisedTransaction]:
        reader = csv.DictReader(StringIO(csv_content))
        transactions: list[NormalisedTransaction] = []

        for row in reader:
            if self._should_skip_row(row):
                continue

            transaction = self._parse_row(row)
            transactions.append(transaction)

        return transactions

    def _parse_row(self, row: dict[str, str]) -> NormalisedTransaction:
        completed_date = self._get_first_available_value(
            row,
            ["Data de Conclusão", "Completed Date"],
        )
        description = self._get_first_available_value(
            row,
            ["Descrição", "Description"],
        )
        amount_text = self._get_first_available_value(
            row,
            ["Montante", "Amount"],
        )
        currency = self._get_first_available_value(
            row,
            ["Moeda", "Currency"],
        )

        amount = self._parse_amount(amount_text)
        direction = "in" if amount > 0 else "out"

        return NormalisedTransaction(
            date=self._parse_date(completed_date),
            raw_description=description,
            description=description,
            amount=abs(amount),
            direction=direction,
            source=self.source,
            account="Revolut",
            currency=currency.upper(),
            external_id=None,
            notes=None,
        )

    def _should_skip_row(self, row: dict[str, str]) -> bool:
        status = row.get("Estado")

        if status is None:
            return False

        return status.strip().upper() != "CONCLUÍDA"

    def _get_first_available_value(
        self,
        row: dict[str, str],
        field_names: list[str],
    ) -> str:
        for field_name in field_names:
            value = row.get(field_name)

            if value is not None and value.strip() != "":
                return value.strip()

        raise ValueError(f"Missing required Revolut field: {field_names[0]}")

    def _parse_date(self, value: str):
        formats = (
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y",
        )

        for date_format in formats:
            try:
                return datetime.strptime(value, date_format).date()
            except ValueError:
                continue

        raise ValueError(f"Unsupported Revolut date format: {value}")

    def _parse_amount(self, value: str) -> Decimal:
        clean_value = value.strip().replace(",", "")

        try:
            return Decimal(clean_value)
        except InvalidOperation as error:
            raise ValueError(f"Invalid Revolut amount: {value}") from error
