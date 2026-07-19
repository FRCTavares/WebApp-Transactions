from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.current_user import CurrentUser, get_current_user
from app.database import get_db
from app.models.user_preferences import UserPreferences
from app.schemas.user_preferences import UserPreferencesRead, UserPreferencesUpdate


router = APIRouter(prefix="/api/preferences", tags=["preferences"])


def get_or_create_preferences(db: Session, user_id: str) -> UserPreferences:
    preferences = db.get(UserPreferences, user_id)
    if preferences is None:
        preferences = UserPreferences(user_id=user_id)
        db.add(preferences)
        db.commit()
        db.refresh(preferences)
    return preferences


@router.get("", response_model=UserPreferencesRead)
def read_preferences(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> UserPreferences:
    return get_or_create_preferences(db, current_user.id)


@router.put("", response_model=UserPreferencesRead)
def update_preferences(
    payload: UserPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> UserPreferences:
    preferences = get_or_create_preferences(db, current_user.id)
    for field, value in payload.model_dump().items():
        setattr(preferences, field, value)
    db.commit()
    db.refresh(preferences)
    return preferences
