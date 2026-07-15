from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException

from app.auth.current_user import CurrentUser
from app.repositories.import_preview_repository import ImportPreviewRepository
from app.services.import_preview_binding_service import (
    ImportPreviewBindingService,
    ImportPreviewCounts,
    STANDARD_IMPORT_MODE,
)


USER = CurrentUser(id="user-one", email="one@example.com")
OTHER_USER = CurrentUser(id="user-two", email="two@example.com")
COUNTS = ImportPreviewCounts(
    rows_total=2,
    rows_valid=2,
    rows_duplicates=0,
    rows_invalid=0,
    transactions_pending=2,
)


def create_service(db_session):
    return ImportPreviewBindingService(
        ImportPreviewRepository(db_session)
    )


def create_preview(service, *, now=None):
    return service.create_preview(
        mode=STANDARD_IMPORT_MODE,
        source="revolut",
        filename="transactions.csv",
        file_content=b"previewed bytes",
        counts=COUNTS,
        current_user=USER,
        now=now,
    )


def test_preview_hash_and_timestamps_are_server_generated(db_session):
    service = create_service(db_session)
    created_at = datetime(2026, 7, 15, 9, 0, tzinfo=UTC)
    preview = create_preview(service, now=created_at)

    assert preview.file_sha256 == service.hash_file(b"previewed bytes")
    assert len(preview.file_sha256) == 64
    assert preview.user_id == USER.id
    assert service._normalise_datetime(preview.created_at) == created_at
    assert service._normalise_datetime(preview.expires_at) == (
        created_at + timedelta(minutes=15)
    )


def test_commit_validation_accepts_exact_preview(db_session):
    service = create_service(db_session)
    preview = create_preview(service)

    validated = service.validate_and_claim_commit(
        preview_id=preview.id,
        mode=STANDARD_IMPORT_MODE,
        source="revolut",
        file_content=b"previewed bytes",
        counts=COUNTS,
        current_user=USER,
        commit=True,
    )

    assert validated.id == preview.id


def test_commit_rejects_changed_file(db_session):
    service = create_service(db_session)
    preview = create_preview(service)

    with pytest.raises(HTTPException) as caught_error:
        service.validate_and_claim_commit(
            preview_id=preview.id,
            mode=STANDARD_IMPORT_MODE,
            source="revolut",
            file_content=b"different bytes",
            counts=COUNTS,
            current_user=USER,
            commit=True,
        )

    assert caught_error.value.status_code == 409


def test_commit_rejects_other_user_preview(db_session):
    service = create_service(db_session)
    preview = create_preview(service)

    with pytest.raises(HTTPException) as caught_error:
        service.validate_and_claim_commit(
            preview_id=preview.id,
            mode=STANDARD_IMPORT_MODE,
            source="revolut",
            file_content=b"previewed bytes",
            counts=COUNTS,
            current_user=OTHER_USER,
            commit=True,
        )

    assert caught_error.value.status_code == 404
    assert caught_error.value.detail == "Import preview not found"


def test_commit_rejects_wrong_source_or_mode(db_session):
    service = create_service(db_session)
    preview = create_preview(service)

    with pytest.raises(HTTPException) as caught_error:
        service.validate_and_claim_commit(
            preview_id=preview.id,
            mode="legacy_transactions",
            source="legacy_excel",
            file_content=b"previewed bytes",
            counts=COUNTS,
            current_user=USER,
            commit=True,
        )

    assert caught_error.value.status_code == 409


def test_commit_rejects_expired_preview(db_session):
    service = create_service(db_session)
    created_at = datetime(2026, 7, 15, 9, 0, tzinfo=UTC)
    preview = create_preview(service, now=created_at)

    with pytest.raises(HTTPException) as caught_error:
        service.validate_and_claim_commit(
            preview_id=preview.id,
            mode=STANDARD_IMPORT_MODE,
            source="revolut",
            file_content=b"previewed bytes",
            counts=COUNTS,
            current_user=USER,
            commit=True,
            now=created_at + timedelta(minutes=16),
        )

    assert caught_error.value.status_code == 410


def test_commit_rejects_changed_counts(db_session):
    service = create_service(db_session)
    preview = create_preview(service)
    changed_counts = ImportPreviewCounts(
        rows_total=2,
        rows_valid=2,
        rows_duplicates=1,
        rows_invalid=0,
        transactions_pending=1,
    )

    with pytest.raises(HTTPException) as caught_error:
        service.validate_and_claim_commit(
            preview_id=preview.id,
            mode=STANDARD_IMPORT_MODE,
            source="revolut",
            file_content=b"previewed bytes",
            counts=changed_counts,
            current_user=USER,
            commit=True,
        )

    assert caught_error.value.status_code == 409


def test_preview_claim_is_atomic_and_cannot_be_reused(db_session):
    service = create_service(db_session)
    preview = create_preview(service)

    first_claim = service.validate_and_claim_commit(
        preview_id=preview.id,
        mode=STANDARD_IMPORT_MODE,
        source="revolut",
        file_content=b"previewed bytes",
        counts=COUNTS,
        current_user=USER,
        commit=True,
    )

    assert first_claim.id == preview.id

    with pytest.raises(HTTPException) as caught_error:
        service.validate_and_claim_commit(
            preview_id=preview.id,
            mode=STANDARD_IMPORT_MODE,
            source="revolut",
            file_content=b"previewed bytes",
            counts=COUNTS,
            current_user=USER,
            commit=True,
        )

    assert caught_error.value.status_code == 409
    assert caught_error.value.detail == (
        "Import preview has already been consumed"
    )


def test_rolled_back_claim_can_be_retried(db_session):
    service = create_service(db_session)
    preview = create_preview(service)

    service.validate_and_claim_commit(
        preview_id=preview.id,
        mode=STANDARD_IMPORT_MODE,
        source="revolut",
        file_content=b"previewed bytes",
        counts=COUNTS,
        current_user=USER,
        commit=False,
    )
    db_session.rollback()

    retried = service.validate_and_claim_commit(
        preview_id=preview.id,
        mode=STANDARD_IMPORT_MODE,
        source="revolut",
        file_content=b"previewed bytes",
        counts=COUNTS,
        current_user=USER,
        commit=True,
    )

    assert retried.id == preview.id
