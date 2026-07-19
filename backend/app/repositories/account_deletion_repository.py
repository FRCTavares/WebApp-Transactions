from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.import_preview import ImportPreview
from app.recovery_registry import USER_RECOVERY_TABLES


class AccountDeletionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def delete_user_data(self, user_id: str) -> dict[str, int]:
        deletion_models = [
            ImportPreview,
            *(table.model for table in reversed(USER_RECOVERY_TABLES)),
        ]
        deleted_counts: dict[str, int] = {}

        for model in deletion_models:
            result = self.db.execute(
                delete(model).where(model.user_id == user_id),
            )
            deleted_counts[model.__tablename__] = result.rowcount or 0

        return deleted_counts
