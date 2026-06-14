from datetime import date

from app.repositories.summary_repository import SummaryRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.summary import (
    CategorySummaryItem,
    CategorySummaryResponse,
    CategoryTotal,
    MonthlySummary,
)


class SummaryService:
    def __init__(
        self,
        repository: SummaryRepository,
        transaction_repository: TransactionRepository | None = None,
    ) -> None:
        self.repository = repository
        self.transaction_repository = transaction_repository

    def get_monthly_summary(
        self,
        year: int | None = None,
        month: int | None = None,
    ) -> MonthlySummary:
        today = date.today()

        if year is None:
            year = today.year

        if month is None:
            month = today.month

        start_date = date(year, month, 1)
        end_date = self._get_next_month_start(year, month)

        money_in = self.repository.get_total_by_cashflow_type(
            cashflow_type="income",
            start_date=start_date,
            end_date=end_date,
        )
        money_out = self.repository.get_total_by_cashflow_type(
            cashflow_type="expense",
            start_date=start_date,
            end_date=end_date,
        )
        open_owed_amount = self.repository.get_open_owed_amount()

        top_categories = [
            CategoryTotal(category=category, total=total)
            for category, total in self.repository.get_top_expense_categories(
                start_date=start_date,
                end_date=end_date,
                limit=5,
            )
        ]

        return MonthlySummary(
            month=f"{year:04d}-{month:02d}",
            money_in=money_in,
            money_out=money_out,
            net=money_in - money_out,
            open_owed_amount=open_owed_amount,
            top_expense_categories=top_categories,
        )

    def get_category_summary(
        self,
        year: int | None = None,
        month: int | None = None,
        direction: str | None = None,
        cashflow_type: str | None = None,
    ) -> CategorySummaryResponse:
        if self.transaction_repository is None:
            raise RuntimeError("Transaction repository is required for category summary")

        effective_cashflow_type = cashflow_type

        if effective_cashflow_type is None and direction == "out":
            effective_cashflow_type = "expense"

        if effective_cashflow_type is None and direction == "in":
            effective_cashflow_type = "income"

        rows = self.transaction_repository.get_category_summary(
            year=year,
            month=month,
            direction=direction,
            cashflow_type=effective_cashflow_type,
        )

        items = [
            CategorySummaryItem(
                category=category,
                subcategory=subcategory,
                total=total,
                count=count,
            )
            for category, subcategory, total, count in rows
        ]

        return CategorySummaryResponse(
            year=year,
            month=month,
            direction=direction,
            items=items,
        )

    def _get_next_month_start(self, year: int, month: int) -> date:
        if month == 12:
            return date(year + 1, 1, 1)

        return date(year, month + 1, 1)
