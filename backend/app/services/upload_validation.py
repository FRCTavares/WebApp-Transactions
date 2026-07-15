from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, UploadFile, status


UPLOAD_CHUNK_SIZE_BYTES = 64 * 1024
CSV_UPLOAD_MAX_BYTES = 5 * 1024 * 1024
ACTIVOBANK_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
LEGACY_EXCEL_UPLOAD_MAX_BYTES = 20 * 1024 * 1024


@dataclass(frozen=True)
class UploadPolicy:
    allowed_extensions: frozenset[str]
    max_bytes: int
    description: str


@dataclass(frozen=True)
class ValidatedUpload:
    filename: str
    content: bytes


STANDARD_UPLOAD_POLICIES = {
    "activobank": UploadPolicy(
        allowed_extensions=frozenset({".xlsx"}),
        max_bytes=ACTIVOBANK_UPLOAD_MAX_BYTES,
        description="ActivoBank XLSX",
    ),
    "revolut": UploadPolicy(
        allowed_extensions=frozenset({".csv"}),
        max_bytes=CSV_UPLOAD_MAX_BYTES,
        description="Revolut CSV",
    ),
    "trading212": UploadPolicy(
        allowed_extensions=frozenset({".csv"}),
        max_bytes=CSV_UPLOAD_MAX_BYTES,
        description="Trading 212 CSV",
    ),
}

LEGACY_EXCEL_UPLOAD_POLICY = UploadPolicy(
    allowed_extensions=frozenset({".xlsx"}),
    max_bytes=LEGACY_EXCEL_UPLOAD_MAX_BYTES,
    description="Legacy Excel XLSX",
)


def get_standard_upload_policy(source: str) -> UploadPolicy:
    normalised_source = source.strip().lower()
    policy = STANDARD_UPLOAD_POLICIES.get(normalised_source)

    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported import source: {normalised_source}",
        )

    return policy


async def read_validated_upload(
    upload: UploadFile,
    *,
    policy: UploadPolicy,
) -> ValidatedUpload:
    filename = (upload.filename or "").strip()

    try:
        if not filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must have a filename",
            )

        extension = Path(filename).suffix.lower()

        if extension not in policy.allowed_extensions:
            expected = ", ".join(sorted(policy.allowed_extensions))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{policy.description} upload requires "
                    f"one of these extensions: {expected}"
                ),
            )

        chunks: list[bytes] = []
        total_bytes = 0

        while True:
            remaining_with_overflow_byte = (
                policy.max_bytes - total_bytes + 1
            )
            read_size = min(
                UPLOAD_CHUNK_SIZE_BYTES,
                remaining_with_overflow_byte,
            )
            chunk = await upload.read(read_size)

            if not chunk:
                break

            total_bytes += len(chunk)

            if total_bytes > policy.max_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    detail=(
                        f"{policy.description} upload exceeds "
                        f"the {policy.max_bytes}-byte limit"
                    ),
                )

            chunks.append(chunk)

        if total_bytes == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty",
            )

        return ValidatedUpload(
            filename=filename,
            content=b"".join(chunks),
        )
    finally:
        await upload.close()
