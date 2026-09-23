from sqlalchemy.orm import Session

from app.models.user_preferences import UserPreferences


class UserPreferencesRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, user_id: str) -> UserPreferences | None:
        return self.db.get(UserPreferences, user_id)

    def get_or_create(self, user_id: str) -> tuple[UserPreferences, bool]:
        preferences = self.get(user_id)

        if preferences is not None:
            return preferences, False

        preferences = UserPreferences(user_id=user_id)
        self.db.add(preferences)
        self.db.flush()
        return preferences, True
