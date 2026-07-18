from __future__ import annotations

import hashlib
import json
import logging
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi.responses import JSONResponse


AsgiMessage = dict[str, Any]
AsgiReceive = Callable[[], Awaitable[AsgiMessage]]
AsgiSend = Callable[[AsgiMessage], Awaitable[None]]
AsgiApp = Callable[
    [dict[str, Any], AsgiReceive, AsgiSend],
    Awaitable[None],
]

REQUEST_ID_HEADER = b"x-request-id"
REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
REQUEST_LOGGER_NAME = "app.request"
REQUEST_LOG_EVENT = "http_request"
LOG_USER_ID_STATE_KEY = "log_user_id"


def build_safe_user_identifier(user_id: str) -> str:
    digest = hashlib.sha256(
        f"f-transactions-user:{user_id}".encode("utf-8")
    ).hexdigest()
    return f"sha256:{digest[:16]}"


def set_request_log_user_id(
    scope: dict[str, Any],
    user_id: str,
) -> None:
    state = scope.setdefault("state", {})
    state[LOG_USER_ID_STATE_KEY] = build_safe_user_identifier(user_id)


class RequestLoggingMiddleware:
    """Emit one structured, sensitive-data-safe log per HTTP request."""

    def __init__(
        self,
        app: AsgiApp,
        *,
        logger: logging.Logger | None = None,
    ) -> None:
        self.app = app
        self.logger = logger or logging.getLogger(REQUEST_LOGGER_NAME)

    async def __call__(
        self,
        scope: dict[str, Any],
        receive: AsgiReceive,
        send: AsgiSend,
    ) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        request_id = self._get_request_id(scope)
        status_code = 500
        response_started = False
        started_at = time.perf_counter()

        async def send_with_request_id(message: AsgiMessage) -> None:
            nonlocal response_started, status_code

            if message["type"] == "http.response.start":
                response_started = True
                status_code = int(message["status"])
                headers = list(message.get("headers", []))
                headers = [
                    (name, value)
                    for name, value in headers
                    if name.lower() != REQUEST_ID_HEADER
                ]
                headers.append(
                    (
                        REQUEST_ID_HEADER,
                        request_id.encode("ascii"),
                    )
                )
                message = {
                    **message,
                    "headers": headers,
                }

            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            if response_started:
                raise

            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )
            await response(
                scope,
                receive,
                send_with_request_id,
            )
        finally:
            duration_ms = round(
                (time.perf_counter() - started_at) * 1000,
                3,
            )
            event = {
                "duration_ms": duration_ms,
                "event": REQUEST_LOG_EVENT,
                "method": str(scope.get("method", "")),
                "request_id": request_id,
                "route": self._get_route(scope),
                "status": status_code,
            }

            safe_user_id = self._get_safe_user_id(scope)

            if safe_user_id is not None:
                event["user_id"] = safe_user_id

            self.logger.info(
                json.dumps(
                    event,
                    separators=(",", ":"),
                    sort_keys=True,
                )
            )

    def _get_request_id(self, scope: dict[str, Any]) -> str:
        for name, value in scope.get("headers", []):
            if name.lower() != REQUEST_ID_HEADER:
                continue

            try:
                candidate = value.decode("ascii")
            except UnicodeDecodeError:
                break

            if REQUEST_ID_PATTERN.fullmatch(candidate):
                return candidate

            break

        return uuid.uuid4().hex

    def _get_route(self, scope: dict[str, Any]) -> str:
        route = scope.get("route")
        path_format = getattr(route, "path_format", None)

        if isinstance(path_format, str) and path_format:
            return path_format

        return str(scope.get("path", ""))

    def _get_safe_user_id(
        self,
        scope: dict[str, Any],
    ) -> str | None:
        state = scope.get("state")

        if not isinstance(state, dict):
            return None

        safe_user_id = state.get(LOG_USER_ID_STATE_KEY)

        if not isinstance(safe_user_id, str):
            return None

        return safe_user_id
