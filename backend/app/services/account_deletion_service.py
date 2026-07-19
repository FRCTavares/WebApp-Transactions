import os
from typing import Protocol

import requests
from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser, get_supabase_url
from app.repositories.account_deletion_repository import AccountDeletionRepository


class AuthIdentityDeletionClient(Protocol):
    def delete_user(self, user_id: str) -> None: ...


class SupabaseAuthIdentityDeletionClient:
    def delete_user(self, user_id: str) -> None:
        supabase_url = get_supabase_url()
        service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

        if not supabase_url or not service_role_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Account deletion is not configured",
            )

        try:
            response = requests.delete(
                f"{supabase_url}/auth/v1/admin/users/{user_id}",
                headers={
                    "apikey": service_role_key,
                    "Authorization": f"Bearer {service_role_key}",
                },
                timeout=15,
            )
        except requests.RequestException:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Financial data was deleted, but the sign-in identity "
                    "could not be removed. Contact the privacy support address."
                ),
            )

        if response.status_code not in {200, 204, 404}:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Financial data was deleted, but the sign-in identity "
                    "could not be removed. Contact the privacy support address."
                ),
            )


class AccountDeletionService:
    def __init__(
        self,
        repository: AccountDeletionRepository,
        identity_client: AuthIdentityDeletionClient,
    ) -> None:
        self.repository = repository
        self.identity_client = identity_client

    def delete_current_user(self, current_user: CurrentUser) -> dict[str, object]:
        try:
            deleted_counts = self.repository.delete_user_data(current_user.id)
            self.repository.db.commit()
        except Exception:
            self.repository.db.rollback()
            raise

        self.identity_client.delete_user(current_user.id)

        return {
            "status": "deleted",
            "deleted_counts": deleted_counts,
        }
