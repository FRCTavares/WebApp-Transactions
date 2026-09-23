from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.user_preferences import UserPreferences
from app.repositories.user_preferences_repository import (
    UserPreferencesRepository,
)
from app.schemas.user_preferences import UserPreferencesUpdate
from app.services.trip_savings_service import TripSavingsService


class UserPreferencesService:
    def __init__(
        self,
        db: Session,
        repository: UserPreferencesRepository,
        trip_savings_service: TripSavingsService,
    ) -> None:
        self.db = db
        self.repository = repository
        self.trip_savings_service = trip_savings_service

    def get_preferences(self, *, user_id: str) -> UserPreferences:
        preferences, created = self.repository.get_or_create(user_id)

        if created:
            self.db.commit()
            self.db.refresh(preferences)

        return preferences

    def update_preferences(
        self,
        *,
        user_id: str,
        payload: UserPreferencesUpdate,
    ) -> UserPreferences:
        preferences, _created = self.repository.get_or_create(user_id)
        updates = payload.model_dump(exclude_none=True)

        old_trip_goal = Decimal(
            str(preferences.monthly_trip_savings_goal_eur)
        )
        new_trip_goal = updates.get("monthly_trip_savings_goal_eur")

        try:
            if (
                new_trip_goal is not None
                and Decimal(str(new_trip_goal)) != old_trip_goal
            ):
                effective_time_zone = updates.get(
                    "time_zone",
                    preferences.time_zone,
                )
                current_month = datetime.now(
                    ZoneInfo(str(effective_time_zone))
                ).strftime("%Y-%m")

                self.trip_savings_service.snapshot_historical_defaults(
                    user_id=user_id,
                    default_goal_eur=old_trip_goal,
                    before_month=current_month,
                )
                self.trip_savings_service.apply_new_default_to_current_and_future(
                    user_id=user_id,
                    from_month=current_month,
                    new_goal_eur=Decimal(str(new_trip_goal)),
                )

            for field, value in updates.items():
                setattr(preferences, field, value)

            self.db.commit()
            self.db.refresh(preferences)
            return preferences
        except Exception:
            self.db.rollback()
            raise
