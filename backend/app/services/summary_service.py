from datetime import date

from app.auth.current_user import CurrentUser
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
        *,
        current_user: CurrentUser,
    ) -> MonthlySummary:
        today = date.today()

        if year is None:
            year = today.year

        if month is None:
            month = today.month

        start_date = date(year, month, 1)
        end_date = self._get_next_month_start(year, month)

        user_id = current_user.id
        gross_money_in = self.repository.get_gross_money_in(
            start_date=start_date,
            end_date=end_date,
            user_id=user_id,
        )
        transaction_income = self.repository.get_transaction_income_excluding_linked_owed_payments(
            start_date=start_date,
            end_date=end_date,
            user_id=user_id,
        )
        reimbursement_received_amount = self.repository.get_reimbursement_received_amount(
            start_date=start_date,
            end_date=end_date,
            user_id=user_id,
        )
        owed_payment_extra_income = self.repository.get_owed_payment_extra_income(
            start_date=start_date,
            end_date=end_date,
            user_id=user_id,
        )
        money_in = transaction_income + owed_payment_extra_income
        money_out = self.repository.get_total_by_cashflow_type(
            cashflow_type="expense",
            start_date=start_date,
            end_date=end_date,
            user_id=user_id,
        )
        owed_expense_amount = self.repository.get_owed_expense_amount(
            start_date=start_date,
            end_date=end_date,
            user_id=user_id,
        )
        personal_money_out = money_out - owed_expense_amount
        open_owed_amount = self.repository.get_open_owed_amount(user_id=user_id)

        top_categories = [
            CategoryTotal(category=category, total=total)
            for category, total in self.repository.get_top_expense_categories(
                start_date=start_date,
                end_date=end_date,
                limit=5,
                user_id=user_id,
            )
        ]

        return MonthlySummary(
            month=f"{year:04d}-{month:02d}",
            gross_money_in=gross_money_in,
            money_in=money_in,
            money_out=money_out,
            owed_expense_amount=owed_expense_amount,
            personal_money_out=personal_money_out,
            reimbursement_received_amount=reimbursement_received_amount,
            owed_payment_extra_income=owed_payment_extra_income,
            net=money_in - money_out,
            personal_net=money_in - personal_money_out,
            open_owed_amount=open_owed_amount,
            top_expense_categories=top_categories,
        )

    def get_category_summary(
        self,
        year: int | None = None,
        month: int | None = None,
        direction: str | None = None,
        cashflow_type: str | None = None,
        *,
        current_user: CurrentUser,
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
            user_id=current_user.id,
        )

        items = [
            CategorySummaryItem(
                category=category,
                total=personal_total,
                gross_total=gross_total,
                owed_total=owed_total,
                personal_total=personal_total,
                count=count,
            )
            for category, _subcategory, gross_total, owed_total, personal_total, count in rows
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
