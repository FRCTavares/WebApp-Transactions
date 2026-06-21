from app.auth.current_user import CurrentUser, LOCAL_DEFAULT_USER_ID
from app.models.investment_funding_month import InvestmentFundingMonth
from app.repositories.investment_funding_month_repository import InvestmentFundingMonthRepository
from app.schemas.investment_funding_month import (
    InvestmentFundingMonthCreate,
    InvestmentFundingMonthUpdate,
)


class InvestmentFundingMonthService:
    def __init__(self, repository: InvestmentFundingMonthRepository) -> None:
        self.repository = repository

    def list_funding_months(
        self,
        month: str | None = None,
        source: str | None = None,
        current_user: CurrentUser | None = None,
    ) -> list[InvestmentFundingMonth]:
        return self.repository.list(
            month=month,
            source=source,
            user_id=self._get_user_id(current_user),
        )

    def upsert_funding_month(
        self,
        data: InvestmentFundingMonthCreate,
        current_user: CurrentUser | None = None,
    ) -> InvestmentFundingMonth:
        user_id = self._get_user_id(current_user)
        existing = self.repository.get_by_month_and_source(
            month=data.month,
            source=data.source,
            user_id=user_id,
        )

        if existing is None:
            return self.repository.create(data, user_id=user_id)

        return self.repository.update(
            existing,
            InvestmentFundingMonthUpdate(
                manual_amount=data.manual_amount,
                cashback_rounding_amount=data.cashback_rounding_amount,
                currency=data.currency,
                notes=data.notes,
            ),
        )

    def _get_user_id(self, current_user: CurrentUser | None) -> str:
        if current_user is None:
            return LOCAL_DEFAULT_USER_ID

        return current_user.id
