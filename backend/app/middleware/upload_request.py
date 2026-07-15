from collections.abc import Awaitable, Callable
from typing import Any

import anyio
from fastapi.responses import JSONResponse


AsgiMessage = dict[str, Any]
AsgiReceive = Callable[[], Awaitable[AsgiMessage]]
AsgiSend = Callable[[AsgiMessage], Awaitable[None]]
AsgiApp = Callable[
    [dict[str, Any], AsgiReceive, AsgiSend],
    Awaitable[None],
]


UPLOAD_REQUEST_PATHS = frozenset(
    {
        "/api/import/preview",
        "/api/import/commit",
        "/api/import/fx-matches/preview",
        "/api/legacy-excel-import/preview",
        "/api/legacy-excel-import/commit",
        "/api/legacy-excel-import/wealth-preview",
        "/api/legacy-excel-import/wealth-commit",
    }
)

UPLOAD_BODY_INACTIVITY_TIMEOUT_SECONDS = 30.0
MAX_UPLOAD_REQUEST_BODY_BYTES = 21 * 1024 * 1024


class UploadRequestMiddleware:
    """Bound multipart body receipt before FastAPI form parsing."""

    def __init__(
        self,
        app: AsgiApp,
        *,
        inactivity_timeout_seconds: float = (
            UPLOAD_BODY_INACTIVITY_TIMEOUT_SECONDS
        ),
        max_body_bytes: int = MAX_UPLOAD_REQUEST_BODY_BYTES,
    ) -> None:
        if inactivity_timeout_seconds <= 0:
            raise ValueError(
                "Upload inactivity timeout must be positive"
            )

        if max_body_bytes <= 0:
            raise ValueError(
                "Upload request body limit must be positive"
            )

        self.app = app
        self.inactivity_timeout_seconds = (
            inactivity_timeout_seconds
        )
        self.max_body_bytes = max_body_bytes

    async def __call__(
        self,
        scope: dict[str, Any],
        receive: AsgiReceive,
        send: AsgiSend,
    ) -> None:
        if not self._requires_upload_protection(scope):
            await self.app(scope, receive, send)
            return

        content_length = self._get_content_length(scope)

        if (
            content_length is not None
            and content_length > self.max_body_bytes
        ):
            await self._send_error(
                scope=scope,
                receive=receive,
                send=send,
                status_code=413,
                detail="Upload request body is too large",
            )
            return

        messages: list[AsgiMessage] = []
        total_body_bytes = 0

        while True:
            try:
                with anyio.fail_after(
                    self.inactivity_timeout_seconds
                ):
                    message = await receive()
            except TimeoutError:
                await self._send_error(
                    scope=scope,
                    receive=receive,
                    send=send,
                    status_code=408,
                    detail="Upload request body timed out",
                )
                return

            messages.append(message)

            if message["type"] == "http.disconnect":
                break

            if message["type"] != "http.request":
                continue

            total_body_bytes += len(
                message.get("body", b"")
            )

            if total_body_bytes > self.max_body_bytes:
                await self._send_error(
                    scope=scope,
                    receive=receive,
                    send=send,
                    status_code=413,
                    detail="Upload request body is too large",
                )
                return

            if not message.get("more_body", False):
                break

        message_index = 0

        async def replay_receive() -> AsgiMessage:
            nonlocal message_index

            if message_index < len(messages):
                message = messages[message_index]
                message_index += 1
                return message

            return {
                "type": "http.request",
                "body": b"",
                "more_body": False,
            }

        await self.app(scope, replay_receive, send)

    def _requires_upload_protection(
        self,
        scope: dict[str, Any],
    ) -> bool:
        return (
            scope.get("type") == "http"
            and scope.get("method") == "POST"
            and scope.get("path") in UPLOAD_REQUEST_PATHS
        )

    def _get_content_length(
        self,
        scope: dict[str, Any],
    ) -> int | None:
        for name, value in scope.get("headers", []):
            if name.lower() != b"content-length":
                continue

            try:
                return int(value)
            except ValueError:
                return None

        return None

    async def _send_error(
        self,
        *,
        scope: dict[str, Any],
        receive: AsgiReceive,
        send: AsgiSend,
        status_code: int,
        detail: str,
    ) -> None:
        response = JSONResponse(
            status_code=status_code,
            content={"detail": detail},
        )
        await response(scope, receive, send)
