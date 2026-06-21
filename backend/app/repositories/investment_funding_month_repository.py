from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.current_user import LOCAL_DEFAULT_USER_ID
from app.models.investment_funding_month import InvestmentFundingMonth
from app.schemas.investment_funding_month import (
    InvestmentFundingMonthCreate,
    InvestmentFundingMonthUpdate,
)


class InvestmentFundingMonthRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(
        self,
        month: str | None = None,
        source: str | None = None,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> list[InvestmentFundingMonth]:
        statement = (
            select(InvestmentFundingMonth)
            .where(InvestmentFundingMonth.user_id == user_id)
            .order_by(
                InvestmentFundingMonth.month.desc(),
                InvestmentFundingMonth.source.asc(),
            )
        )

        if month is not None:
            statement = statement.where(InvestmentFundingMonth.month == month)

        if source is not None:
            statement = statement.where(InvestmentFundingMonth.source == source)

        return list(self.db.scalars(statement).all())

    def get_by_month_and_source(
        self,
        month: str,
        source: str,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> InvestmentFundingMonth | None:
        statement = (
            select(InvestmentFundingMonth)
            .where(InvestmentFundingMonth.user_id == user_id)
            .where(InvestmentFundingMonth.month == month)
            .where(InvestmentFundingMonth.source == source)
        )

        return self.db.scalar(statement)

    def create(
        self,
        data: InvestmentFundingMonthCreate,
        user_id: str = LOCAL_DEFAULT_USER_ID,
    ) -> InvestmentFundingMonth:
        funding_month = InvestmentFundingMonth(
            user_id=user_id,
            **data.model_dump(),
        )

        self.db.add(funding_month)
        self.db.commit()
        self.db.refresh(funding_month)

        return funding_month

    def update(
        self,
        funding_month: InvestmentFundingMonth,
        data: InvestmentFundingMonthUpdate,
    ) -> InvestmentFundingMonth:
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(funding_month, field, value)

        self.db.add(funding_month)
        self.db.commit()
        self.db.refresh(funding_month)

        return funding_month
