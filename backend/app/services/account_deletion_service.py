from app.auth.current_user import CurrentUser
from app.repositories.account_deletion_repository import AccountDeletionRepository


class AccountDeletionService:
    """Deletes a person's data. Sign-in is Google's, so there is no separate identity to remove: access itself
    is the operator's decision (removing the email from ALLOWED_USER_EMAILS)."""

    def __init__(self, repository: AccountDeletionRepository) -> None:
        self.repository = repository

    def delete_current_user(self, current_user: CurrentUser) -> dict[str, object]:
        try:
            deleted_counts = self.repository.delete_user_data(current_user.id)
            self.repository.db.commit()
        except Exception:
            self.repository.db.rollback()
            raise

        return {
            "status": "deleted",
            "deleted_counts": deleted_counts,
        }
