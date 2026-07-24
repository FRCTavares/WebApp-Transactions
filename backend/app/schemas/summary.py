from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class CategoryTotal(BaseModel):
    category: str
    total: Decimal


class MonthlySummary(BaseModel):
    month: str
    gross_money_in: Decimal
    money_in: Decimal
    money_out: Decimal
    owed_expense_amount: Decimal
    personal_money_out: Decimal
    reimbursement_received_amount: Decimal
    owed_payment_extra_income: Decimal
    net: Decimal
    personal_net: Decimal
    net_invested_cash: Decimal | None
    available_net: Decimal | None
    investment_cashflow_status: Literal[
        "available",
        "unavailable",
    ]
    investment_reconciliation_status: Literal[
        "not_applicable",
        "complete",
        "partial",
    ]
    investment_goal_eur: Decimal
    investment_goal_remaining: Decimal | None
    investment_goal_over: Decimal | None
    investment_goal_status: Literal[
        "in_progress",
        "reached",
        "exceeded",
        "unavailable",
    ]
    open_owed_amount: Decimal
    top_expense_categories: list[CategoryTotal]


class CategorySummaryItem(BaseModel):
    category: str
    total: Decimal
    gross_total: Decimal
    owed_total: Decimal
    personal_total: Decimal
    count: int


class CategorySummaryResponse(BaseModel):
    year: int | None = None
    month: int | None = None
    direction: str | None = None
    items: list[CategorySummaryItem]
