from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.auth.current_user import CurrentUser, get_current_user
from app.main import app
from app.models.import_preview import ImportPreview
from app.models.transaction import Transaction
from app.repositories.account_deletion_repository import AccountDeletionRepository
from app.services.account_deletion_service import AccountDeletionService


class RecordingIdentityClient:
    def __init__(self) -> None:
        self.deleted_user_ids: list[str] = []

    def delete_user(self, user_id: str) -> None:
        self.deleted_user_ids.append(user_id)


class FailingDeletionRepository(AccountDeletionRepository):
    def delete_user_data(self, user_id: str) -> dict[str, int]:
        super().delete_user_data(user_id)
        raise RuntimeError("forced deletion failure")


def add_user_rows(db_session, user_id: str) -> None:
    db_session.add(
        Transaction(
            user_id=user_id,
            date=datetime.now(UTC).date(),
            description="Deletion test",
            raw_description="Deletion test",
            amount=Decimal("10.00"),
            direction="out",
            source="manual",
            currency="EUR",
        )
    )
    db_session.add(
        ImportPreview(
            user_id=user_id,
            mode="standard",
            source="revolut",
            filename="preview.csv",
            file_sha256="a" * 64,
            rows_total=0,
            rows_valid=0,
            rows_duplicates=0,
            rows_invalid=0,
            transactions_pending=0,
            investment_events_pending=0,
            owed_items_pending=0,
            wealth_snapshots_pending=0,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )
    )
    db_session.commit()


def test_account_deletion_removes_only_current_user_data(db_session):
    add_user_rows(db_session, "deleting-user")
    add_user_rows(db_session, "other-user")
    identity_client = RecordingIdentityClient()
    service = AccountDeletionService(
        AccountDeletionRepository(db_session),
        identity_client,
    )

    result = service.delete_current_user(CurrentUser(id="deleting-user"))

    assert result["status"] == "deleted"
    assert result["deleted_counts"]["transactions"] == 1
    assert result["deleted_counts"]["import_previews"] == 1
    assert identity_client.deleted_user_ids == ["deleting-user"]
    assert db_session.query(Transaction).filter_by(user_id="deleting-user").count() == 0
    assert db_session.query(ImportPreview).filter_by(user_id="deleting-user").count() == 0
    assert db_session.query(Transaction).filter_by(user_id="other-user").count() == 1
    assert db_session.query(ImportPreview).filter_by(user_id="other-user").count() == 1


def test_account_deletion_requires_matching_confirmation(client):
    current_user = CurrentUser(id="user-id", email="owner@example.com")
    app.dependency_overrides[get_current_user] = lambda: current_user

    try:
        response = client.delete(
            "/api/me",
            headers={"X-Confirm-Account-Deletion": "wrong@example.com"},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 400
    assert response.json()["detail"] == "Account deletion confirmation does not match"


def test_account_deletion_rolls_back_all_application_data(db_session):
    add_user_rows(db_session, "deleting-user")
    service = AccountDeletionService(
        FailingDeletionRepository(db_session),
        RecordingIdentityClient(),
    )

    try:
        service.delete_current_user(CurrentUser(id="deleting-user"))
    except RuntimeError as error:
        assert str(error) == "forced deletion failure"
    else:
        raise AssertionError("Expected account deletion to fail")

    assert db_session.query(Transaction).filter_by(user_id="deleting-user").count() == 1
    assert db_session.query(ImportPreview).filter_by(user_id="deleting-user").count() == 1
