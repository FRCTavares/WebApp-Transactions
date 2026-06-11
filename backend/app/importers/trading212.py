import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import StringIO

from app.importers.base import (
    ImportParseResult,
    NormalisedInvestmentEvent,
    NormalisedTransaction,
)


class Trading212Importer:
    source = "trading212"
    account = "Trading 212"

    def parse(self, csv_content: str) -> list[NormalisedTransaction]:
        return self.parse_full(csv_content).transactions

    def parse_full(self, csv_content: str) -> ImportParseResult:
        reader = csv.DictReader(StringIO(csv_content))
        transactions: list[NormalisedTransaction] = []
        investment_events: list[NormalisedInvestmentEvent] = []

        for row in reader:
            action = self._get_optional_value(row, "Action")
            description = self._get_description(row)

            if self._is_investment_event(action=action, description=description):
                investment_events.append(self._parse_investment_event(row))
            else:
                transactions.append(self._parse_transaction(row))

        return ImportParseResult(
            transactions=transactions,
            investment_events=investment_events,
        )

    def _parse_transaction(self, row: dict[str, str]) -> NormalisedTransaction:
        time = self._get_required_value(row, "Time")
        amount_text = self._get_required_value(row, "Total")
        currency = self._get_required_value(row, "Currency (Total)").upper()
        external_id = self._get_optional_value(row, "ID")
        action = self._get_optional_value(row, "Action")

        description = self._get_description(row)
        raw_description = self._build_raw_description(
            description=description,
            external_id=external_id,
        )
        signed_amount = self._parse_amount(amount_text)
        amount = abs(signed_amount)

        direction = self._get_transaction_direction(
            action=action,
            description=description,
            signed_amount=signed_amount,
        )
        cashflow_type = self._get_cashflow_type(
            action=action,
            description=description,
            direction=direction,
        )

        return NormalisedTransaction(
            date=self._parse_date(time),
            raw_description=raw_description,
            description=description,
            amount=amount,
            direction=direction,
            source=self.source,
            account=self.account,
            currency=currency,
            original_amount=amount,
            original_currency=currency,
            fx_rate_to_eur=Decimal("1") if currency == "EUR" else None,
            fx_rate_source="source_currency" if currency == "EUR" else "pending",
            cashflow_type=cashflow_type,
            external_id=external_id,
            notes=action,
        )

    def _parse_investment_event(self, row: dict[str, str]) -> NormalisedInvestmentEvent:
        time = self._get_required_value(row, "Time")
        amount_text = self._get_required_value(row, "Total")
        currency = self._get_required_value(row, "Currency (Total)").upper()
        external_id = self._get_optional_value(row, "ID")
        action = self._get_optional_value(row, "Action")

        description = self._get_description(row)
        raw_description = self._build_raw_description(
            description=description,
            external_id=external_id,
        )
        amount = abs(self._parse_amount(amount_text))

        return NormalisedInvestmentEvent(
            date=self._parse_date(time),
            source=self.source,
            account=self.account,
            event_type=self._get_event_type(action=action, description=description),
            description=description,
            raw_description=raw_description,
            amount=amount,
            currency=currency,
            original_amount=amount,
            original_currency=currency,
            fx_rate_to_eur=Decimal("1") if currency == "EUR" else None,
            fx_rate_source="source_currency" if currency == "EUR" else "pending",
            external_id=external_id,
            notes=action,
        )

    def _is_investment_event(
        self,
        action: str | None,
        description: str,
    ) -> bool:
        action_text = (action or "").strip().lower()
        description_text = description.strip().lower()
        combined_text = f"{action_text} {description_text}"

        investment_markers = (
            "market buy",
            "market sell",
            "dividend",
            "interest on cash",
            "fx conversion",
            "currency conversion",
        )

        return any(marker in combined_text for marker in investment_markers)

    def _get_event_type(
        self,
        action: str | None,
        description: str,
    ) -> str:
        action_text = (action or "").strip().lower()
        description_text = description.strip().lower()
        combined_text = f"{action_text} {description_text}"

        if "market buy" in combined_text:
            return "market_buy"

        if "market sell" in combined_text:
            return "market_sell"

        if "dividend" in combined_text:
            return "dividend"

        if "interest on cash" in combined_text:
            return "interest"

        if "fx conversion" in combined_text or "currency conversion" in combined_text:
            return "fx_conversion"

        return "broker_event"

    def _get_transaction_direction(
        self,
        action: str | None,
        description: str,
        signed_amount: Decimal,
    ) -> str:
        action_text = (action or "").strip().lower()
        description_text = description.strip().lower()

        if (
            "bank transfer" in action_text
            or "bank transfer" in description_text
            or "deposit" in action_text
            or "deposit" in description_text
            or description_text.startswith("transaction id:")
        ):
            return "out" if signed_amount > 0 else "in"

        if "withdrawal" in action_text or "withdrawal" in description_text:
            return "in" if signed_amount < 0 else "out"

        return "in" if signed_amount > 0 else "out"

    def _get_cashflow_type(
        self,
        action: str | None,
        description: str,
        direction: str,
    ) -> str:
        action_text = (action or "").strip().lower()
        description_text = description.strip().lower()

        if (
            "bank transfer" in action_text
            or "bank transfer" in description_text
            or "deposit" in action_text
            or "deposit" in description_text
            or "withdrawal" in action_text
            or "withdrawal" in description_text
            or description_text.startswith("transaction id:")
        ):
            return "investment"

        if "spending cashback" in action_text or "spending cashback" in description_text:
            return "income"

        if "card debit" in action_text:
            return "expense"

        if direction == "in":
            return "income"

        return "expense"

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
