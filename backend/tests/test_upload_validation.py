import asyncio

import pytest
from fastapi import HTTPException

from app.services.upload_validation import (
    UploadPolicy,
    read_validated_upload,
)


class RecordingUpload:
    def __init__(
        self,
        *,
        filename: str | None,
        content: bytes,
    ) -> None:
        self.filename = filename
        self._content = content
        self._offset = 0
        self.read_sizes: list[int] = []
        self.closed = False

    async def read(self, size: int = -1) -> bytes:
        self.read_sizes.append(size)

        if size < 0:
            raise AssertionError(
                "Upload reader requested an unbounded read"
            )

        start = self._offset
        end = min(start + size, len(self._content))
        self._offset = end
        return self._content[start:end]

    async def close(self) -> None:
        self.closed = True


def build_policy(max_bytes: int) -> UploadPolicy:
    return UploadPolicy(
        allowed_extensions=frozenset({".csv"}),
        max_bytes=max_bytes,
        description="Test CSV",
    )


def test_upload_reader_accepts_exact_limit():
    upload = RecordingUpload(
        filename="test.csv",
        content=b"a" * 10,
    )

    result = asyncio.run(
        read_validated_upload(
            upload,
            policy=build_policy(10),
        )
    )

    assert result.filename == "test.csv"
    assert result.content == b"a" * 10
    assert upload.closed is True
    assert all(size <= 11 for size in upload.read_sizes)
    assert -1 not in upload.read_sizes


def test_upload_reader_rejects_one_byte_over_limit():
    upload = RecordingUpload(
        filename="test.csv",
        content=b"a" * 11,
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            read_validated_upload(
                upload,
                policy=build_policy(10),
            )
        )

    assert error.value.status_code == 413
    assert upload.closed is True
    assert -1 not in upload.read_sizes


@pytest.mark.parametrize(
    ("filename", "content", "expected_detail"),
    [
        (None, b"data", "must have a filename"),
        ("", b"data", "must have a filename"),
        ("test.xlsx", b"data", "requires one of these extensions"),
        ("test.csv", b"", "is empty"),
    ],
)
def test_upload_reader_rejects_invalid_uploads(
    filename,
    content,
    expected_detail,
):
    upload = RecordingUpload(
        filename=filename,
        content=content,
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(
            read_validated_upload(
                upload,
                policy=build_policy(10),
            )
        )

    assert error.value.status_code == 400
    assert expected_detail in error.value.detail
    assert upload.closed is True
