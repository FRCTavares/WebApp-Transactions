from calendar import monthrange
from datetime import date

from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser
from app.repositories.month_reset_repository import MonthResetRepository
from app.schemas.admin_reset import MonthResetRequest, MonthResetResponse


class AdminResetService:
    def __init__(self, repository: MonthResetRepository) -> None:
        self.repository = repository

    def reset_month(
        self,
        request_data: MonthResetRequest,
        current_user: CurrentUser,
    ) -> MonthResetResponse:
        month_label = f"{request_data.year:04d}-{request_data.month:02d}"
        expected_confirmation = f"DELETE {month_label}"

        if request_data.confirm != expected_confirmation:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f'Confirmation must be exactly "{expected_confirmation}"',
            )

        start_date = date(request_data.year, request_data.month, 1)
        _last_day = monthrange(request_data.year, request_data.month)[1]

        if request_data.month == 12:
            end_date = date(request_data.year + 1, 1, 1)
        else:
            end_date = date(request_data.year, request_data.month + 1, 1)

        before = self.repository.count_reset_rows(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            month_label=month_label,
        )

        deleted = {key: 0 for key in before}

        if not request_data.dry_run:
            try:
                deleted = self.repository.delete_reset_rows(
                    user_id=current_user.id,
                    start_date=start_date,
                    end_date=end_date,
                    month_label=month_label,
                )
                self.repository.db.commit()
            except Exception:
                self.repository.db.rollback()
                raise

        after = self.repository.count_reset_rows(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            month_label=month_label,
        )

        return MonthResetResponse(
            month=month_label,
            dry_run=request_data.dry_run,
            before=before,
            deleted=deleted,
            after=after,
            status="dry_run" if request_data.dry_run else "deleted",
        )
