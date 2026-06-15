from decimal import Decimal

from pydantic import BaseModel


class CategoryTotal(BaseModel):
    category: str
    total: Decimal


class MonthlySummary(BaseModel):
    month: str
    money_in: Decimal
    money_out: Decimal
    owed_expense_amount: Decimal
    personal_money_out: Decimal
    net: Decimal
    personal_net: Decimal
    open_owed_amount: Decimal
    top_expense_categories: list[CategoryTotal]


class CategorySummaryItem(BaseModel):
    category: str
    subcategory: str | None = None
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
