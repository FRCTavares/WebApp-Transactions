import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status

from app.auth.current_user import CurrentUser
from app.models.import_preview import ImportPreview
from app.repositories.import_preview_repository import ImportPreviewRepository


STANDARD_IMPORT_MODE = "standard"
IMPORT_PREVIEW_TTL = timedelta(minutes=15)


@dataclass(frozen=True)
class ImportPreviewCounts:
    rows_total: int
    rows_valid: int
    rows_duplicates: int
    rows_invalid: int
    transactions_pending: int = 0
    investment_events_pending: int = 0
    owed_items_pending: int = 0
    wealth_snapshots_pending: int = 0


class ImportPreviewBindingService:
    def __init__(
        self,
        repository: ImportPreviewRepository,
    ) -> None:
        self.repository = repository

    def create_preview(
        self,
        *,
        mode: str,
        source: str,
        filename: str,
        file_content: bytes,
        counts: ImportPreviewCounts,
        current_user: CurrentUser,
        now: datetime | None = None,
    ) -> ImportPreview:
        created_at = self._normalise_datetime(now or datetime.now(UTC))
        return self.repository.create(
            user_id=current_user.id,
            mode=mode,
            source=source,
            filename=filename,
            file_sha256=self.hash_file(file_content),
            created_at=created_at,
            expires_at=created_at + IMPORT_PREVIEW_TTL,
            rows_total=counts.rows_total,
            rows_valid=counts.rows_valid,
            rows_duplicates=counts.rows_duplicates,
            rows_invalid=counts.rows_invalid,
            transactions_pending=counts.transactions_pending,
            investment_events_pending=counts.investment_events_pending,
            owed_items_pending=counts.owed_items_pending,
            wealth_snapshots_pending=counts.wealth_snapshots_pending,
        )

    def validate_and_claim_commit(
        self,
        *,
        preview_id: str,
        mode: str,
        source: str,
        file_content: bytes,
        counts: ImportPreviewCounts,
        current_user: CurrentUser,
        commit: bool,
        now: datetime | None = None,
    ) -> ImportPreview:
        preview = self.repository.get_by_id(
            preview_id,
            user_id=current_user.id,
        )

        if preview is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Import preview not found",
            )

        current_time = self._normalise_datetime(now or datetime.now(UTC))
        expires_at = self._normalise_datetime(preview.expires_at)

        if preview.consumed_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Import preview has already been consumed",
            )

        if current_time >= expires_at:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Import preview has expired",
            )

        if preview.mode != mode or preview.source != source:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Import preview does not match this import flow",
            )

        if preview.file_sha256 != self.hash_file(file_content):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Uploaded file does not match the previewed file",
            )

        if self._counts_from_model(preview) != counts:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Import contents no longer match the preview",
            )

        claimed = self.repository.claim_unconsumed(
            preview.id,
            user_id=current_user.id,
            consumed_at=current_time,
            commit=commit,
        )

        if not claimed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Import preview has already been consumed",
            )

        return preview

    @staticmethod
    def hash_file(file_content: bytes) -> str:
        return hashlib.sha256(file_content).hexdigest()

    @staticmethod
    def _normalise_datetime(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    @staticmethod
    def _counts_from_model(
        preview: ImportPreview,
    ) -> ImportPreviewCounts:
        return ImportPreviewCounts(
            rows_total=preview.rows_total,
            rows_valid=preview.rows_valid,
            rows_duplicates=preview.rows_duplicates,
            rows_invalid=preview.rows_invalid,
            transactions_pending=preview.transactions_pending,
            investment_events_pending=preview.investment_events_pending,
            owed_items_pending=preview.owed_items_pending,
            wealth_snapshots_pending=preview.wealth_snapshots_pending,
        )
