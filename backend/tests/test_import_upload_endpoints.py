from dataclasses import dataclass

import pytest

from app.routers.imports import (
    get_fx_match_service,
    get_import_service,
)
from app.routers.legacy_excel_imports import (
    get_legacy_excel_import_service,
)
from app.services.upload_validation import (
    ACTIVOBANK_UPLOAD_MAX_BYTES,
    CSV_UPLOAD_MAX_BYTES,
    LEGACY_EXCEL_UPLOAD_MAX_BYTES,
)


@dataclass
class RecordingService:
    called: bool = False
    filename: str | None = None
    content: bytes | None = None
    source: str | None = None
    preview_id: str | None = None

    def _record(
        self,
        *,
        file_content,
        filename,
        source=None,
        **kwargs,
    ) -> None:
        self.called = True
        self.filename = filename
        self.content = file_content
        self.source = source
        self.preview_id = kwargs.get("preview_id")

    def preview_import_from_file(
        self,
        *,
        file_content,
        filename,
        source,
        **kwargs,
    ):
        self._record(
            file_content=file_content,
            filename=filename,
            source=source,
            **kwargs,
        )
        return {
            "preview_id": "preview-test-id",
            "expires_at": "2026-07-15T12:00:00Z",
            "source": source,
            "rows_total": 0,
            "rows_valid": 0,
            "rows_duplicates": 0,
            "rows_invalid": 0,
            "transactions": [],
            "investment_events": [],
            "invalid_rows": [],
        }

    def commit_import_from_file(
        self,
        *,
        file_content,
        filename,
        source,
        **kwargs,
    ):
        self._record(
            file_content=file_content,
            filename=filename,
            source=source,
            **kwargs,
        )
        return {}

    def preview_matches_from_file(
        self,
        *,
        file_content,
        filename,
        source,
        **kwargs,
    ):
        self._record(
            file_content=file_content,
            filename=filename,
            source=source,
            **kwargs,
        )
        return {
            "source": source,
            "pending_deposits": [],
        }

    def preview_legacy_import_from_file(
        self,
        *,
        file_content,
        filename,
        **kwargs,
    ):
        self._record(
            file_content=file_content,
            filename=filename,
            **kwargs,
        )
        return {
            "source": "legacy_excel",
            "filename": filename,
            "rows_total": 0,
            "rows_valid": 0,
            "rows_duplicates": 0,
            "rows_invalid": 0,
            "summary": {
                "transaction_count": 0,
                "duplicate_transaction_count": 0,
                "owed_item_count": 0,
                "duplicate_owed_item_count": 0,
                "invalid_row_count": 0,
                "money_in_total": "0",
                "money_out_total": "0",
                "owed_open_total": "0",
                "owed_paid_total": "0",
            },
            "transactions": [],
            "owed_items": [],
            "invalid_rows": [],
        }

    def preview_wealth_import_from_file(
        self,
        *,
        file_content,
        filename,
        **kwargs,
    ):
        self._record(
            file_content=file_content,
            filename=filename,
            **kwargs,
        )
        return {
            "source": "legacy_excel",
            "filename": filename,
            "rows_total": 0,
            "rows_valid": 0,
            "rows_duplicates": 0,
            "rows_invalid": 0,
            "summary": {
                "snapshot_count": 0,
                "account_count": 0,
                "latest_snapshot_date": None,
            },
            "snapshots": [],
            "invalid_rows": [],
        }

    def commit_wealth_import_from_file(
        self,
        *,
        file_content,
        filename,
        **kwargs,
    ):
        self._record(
            file_content=file_content,
            filename=filename,
            **kwargs,
        )
        return {}

    preview_import_from_file = preview_legacy_import_from_file


@pytest.mark.parametrize(
    ("route", "source", "filename"),
    [
        ("/api/import/preview", "revolut", "data.xlsx"),
        ("/api/import/commit", "trading212", "data.xlsx"),
        (
            "/api/import/fx-matches/preview",
            "trading212",
            "data.xlsx",
        ),
        ("/api/import/preview", "activobank", "data.csv"),
    ],
)
def test_standard_upload_routes_reject_wrong_extension(
    client,
    route,
    source,
    filename,
):
    response = client.post(
        route,
        data={
            "source": source,
            **(
                {"preview_id": "preview-test-id"}
                if route == "/api/import/commit"
                else {}
            ),
        },
        files={
            "file": (
                filename,
                b"data",
                "application/octet-stream",
            )
        },
    )

    assert response.status_code == 400
    assert "requires one of these extensions" in (
        response.json()["detail"]
    )


@pytest.mark.parametrize(
    "route",
    [
        "/api/legacy-excel-import/preview",
        "/api/legacy-excel-import/commit",
        "/api/legacy-excel-import/wealth-preview",
        "/api/legacy-excel-import/wealth-commit",
    ],
)
def test_legacy_upload_routes_reject_wrong_extension(
    client,
    route,
):
    response = client.post(
        route,
        files={
            "file": (
                "legacy.csv",
                b"data",
                "text/csv",
            )
        },
    )

    assert response.status_code == 400
    assert "requires one of these extensions" in (
        response.json()["detail"]
    )


@pytest.mark.parametrize(
    ("route", "source", "filename", "limit"),
    [
        (
            "/api/import/preview",
            "revolut",
            "data.csv",
            CSV_UPLOAD_MAX_BYTES,
        ),
        (
            "/api/import/commit",
            "trading212",
            "data.csv",
            CSV_UPLOAD_MAX_BYTES,
        ),
        (
            "/api/import/fx-matches/preview",
            "trading212",
            "data.csv",
            CSV_UPLOAD_MAX_BYTES,
        ),
        (
            "/api/import/preview",
            "activobank",
            "data.xlsx",
            ACTIVOBANK_UPLOAD_MAX_BYTES,
        ),
    ],
)
def test_standard_upload_routes_reject_oversized_files(
    client,
    route,
    source,
    filename,
    limit,
):
    response = client.post(
        route,
        data={
            "source": source,
            **(
                {"preview_id": "preview-test-id"}
                if route == "/api/import/commit"
                else {}
            ),
        },
        files={
            "file": (
                filename,
                b"x" * (limit + 1),
                "application/octet-stream",
            )
        },
    )

    assert response.status_code == 413


@pytest.mark.parametrize(
    "route",
    [
        "/api/legacy-excel-import/preview",
        "/api/legacy-excel-import/commit",
        "/api/legacy-excel-import/wealth-preview",
        "/api/legacy-excel-import/wealth-commit",
    ],
)
def test_legacy_upload_routes_reject_oversized_files(
    client,
    route,
):
    response = client.post(
        route,
        files={
            "file": (
                "legacy.xlsx",
                b"x" * (LEGACY_EXCEL_UPLOAD_MAX_BYTES + 1),
                "application/octet-stream",
            )
        },
    )

    assert response.status_code == 413


def test_standard_upload_route_accepts_exact_limit(
    client,
):
    service = RecordingService()
    client.app.dependency_overrides[get_import_service] = (
        lambda: service
    )

    response = client.post(
        "/api/import/preview",
        data={"source": "revolut"},
        files={
            "file": (
                "data.csv",
                b"x" * CSV_UPLOAD_MAX_BYTES,
                "text/csv",
            )
        },
    )

    assert response.status_code == 200
    assert service.called is True
    assert service.filename == "data.csv"
    assert len(service.content or b"") == CSV_UPLOAD_MAX_BYTES


def test_legacy_upload_route_accepts_exact_limit(
    client,
):
    service = RecordingService()
    client.app.dependency_overrides[
        get_legacy_excel_import_service
    ] = lambda: service

    response = client.post(
        "/api/legacy-excel-import/preview",
        files={
            "file": (
                "legacy.xlsx",
                b"x" * LEGACY_EXCEL_UPLOAD_MAX_BYTES,
                "application/octet-stream",
            )
        },
    )

    assert response.status_code == 200
    assert service.called is True
    assert service.filename == "legacy.xlsx"
    assert len(service.content or b"") == (
        LEGACY_EXCEL_UPLOAD_MAX_BYTES
    )


def test_fx_upload_route_uses_bounded_reader(
    client,
):
    service = RecordingService()
    client.app.dependency_overrides[get_fx_match_service] = (
        lambda: service
    )

    response = client.post(
        "/api/import/fx-matches/preview",
        data={"source": "trading212"},
        files={
            "file": (
                "trading212.csv",
                b"header\n",
                "text/csv",
            )
        },
    )

    assert response.status_code == 200
    assert service.called is True

def test_standard_commit_route_requires_preview_id(client):
    response = client.post(
        "/api/import/commit",
        data={"source": "revolut"},
        files={
            "file": (
                "data.csv",
                b"header\n",
                "text/csv",
            )
        },
    )

    assert response.status_code == 422


def test_standard_commit_route_forwards_preview_id(client):
    service = RecordingService()
    client.app.dependency_overrides[get_import_service] = lambda: service

    response = client.post(
        "/api/import/commit",
        data={
            "source": "revolut",
            "preview_id": "preview-test-id",
        },
        files={
            "file": (
                "data.csv",
                b"header\n",
                "text/csv",
            )
        },
    )

    assert response.status_code == 200
    assert service.called is True
    assert service.preview_id == "preview-test-id"
