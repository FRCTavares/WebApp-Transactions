from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.repositories.trip_savings_repository import TripSavingsRepository
from app.repositories.user_preferences_repository import (
    UserPreferencesRepository,
)
from app.schemas.user_preferences import UserPreferencesRead, UserPreferencesUpdate
from app.services.trip_savings_service import TripSavingsService
from app.services.user_preferences_service import UserPreferencesService


router = APIRouter(prefix="/api/preferences", tags=["preferences"])


def get_user_preferences_service(
    db: Session = Depends(get_db),
) -> UserPreferencesService:
    trip_savings_service = TripSavingsService(
        db,
        TripSavingsRepository(db),
    )
    return UserPreferencesService(
        db,
        UserPreferencesRepository(db),
        trip_savings_service,
    )


@router.get("", response_model=UserPreferencesRead)
def read_preferences(
    service: UserPreferencesService = Depends(get_user_preferences_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.get_preferences(user_id=current_user.id)


@router.put("", response_model=UserPreferencesRead)
def update_preferences(
    payload: UserPreferencesUpdate,
    service: UserPreferencesService = Depends(get_user_preferences_service),
    current_user: CurrentUser = Depends(get_current_user),
):
    return service.update_preferences(
        user_id=current_user.id,
        payload=payload,
    )
