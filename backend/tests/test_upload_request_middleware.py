import asyncio
import json

from app.middleware.upload_request import (
    UploadRequestMiddleware,
)


def build_scope(
    *,
    path: str = "/api/import/preview",
    method: str = "POST",
    headers=None,
):
    return {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": headers or [],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
        "root_path": "",
    }


def run_middleware(
    middleware,
    *,
    scope,
    receive,
):
    sent_messages = []

    async def send(message):
        sent_messages.append(message)

    asyncio.run(
        middleware(
            scope,
            receive,
            send,
        )
    )

    return sent_messages


def get_response(sent_messages):
    start = next(
        message
        for message in sent_messages
        if message["type"] == "http.response.start"
    )
    body = b"".join(
        message.get("body", b"")
        for message in sent_messages
        if message["type"] == "http.response.body"
    )
    return start["status"], json.loads(body)


def test_non_upload_route_passes_receive_through():
    received_by_app = []

    async def app(scope, receive, send):
        del scope
        received_by_app.append(await receive())
        await send(
            {
                "type": "http.response.start",
                "status": 204,
                "headers": [],
            }
        )
        await send(
            {
                "type": "http.response.body",
                "body": b"",
            }
        )

    async def receive():
        return {
            "type": "http.request",
            "body": b"normal",
            "more_body": False,
        }

    messages = run_middleware(
        UploadRequestMiddleware(app),
        scope=build_scope(path="/api/health", method="GET"),
        receive=receive,
    )

    assert received_by_app == [
        {
            "type": "http.request",
            "body": b"normal",
            "more_body": False,
        }
    ]
    assert next(
        message
        for message in messages
        if message["type"] == "http.response.start"
    )["status"] == 204


def test_upload_body_messages_are_replayed_unchanged():
    received_by_app = []
    source_messages = [
        {
            "type": "http.request",
            "body": b"first-",
            "more_body": True,
        },
        {
            "type": "http.request",
            "body": b"second",
            "more_body": False,
        },
    ]

    async def app(scope, receive, send):
        del scope

        while True:
            message = await receive()
            received_by_app.append(message)

            if not message.get("more_body", False):
                break

        await send(
            {
                "type": "http.response.start",
                "status": 204,
                "headers": [],
            }
        )
        await send(
            {
                "type": "http.response.body",
                "body": b"",
            }
        )

    async def receive():
        return source_messages.pop(0)

    messages = run_middleware(
        UploadRequestMiddleware(app),
        scope=build_scope(),
        receive=receive,
    )

    assert received_by_app == [
        {
            "type": "http.request",
            "body": b"first-",
            "more_body": True,
        },
        {
            "type": "http.request",
            "body": b"second",
            "more_body": False,
        },
    ]
    assert next(
        message
        for message in messages
        if message["type"] == "http.response.start"
    )["status"] == 204


def test_stalled_upload_returns_408_without_running_app():
    app_called = False

    async def app(scope, receive, send):
        nonlocal app_called
        del scope, receive, send
        app_called = True

    async def receive():
        await asyncio.sleep(1)
        return {
            "type": "http.request",
            "body": b"",
            "more_body": False,
        }

    messages = run_middleware(
        UploadRequestMiddleware(
            app,
            inactivity_timeout_seconds=0.01,
        ),
        scope=build_scope(),
        receive=receive,
    )

    status_code, body = get_response(messages)

    assert status_code == 408
    assert body == {
        "detail": "Upload request body timed out"
    }
    assert app_called is False


def test_content_length_over_limit_returns_413():
    app_called = False

    async def app(scope, receive, send):
        nonlocal app_called
        del scope, receive, send
        app_called = True

    async def receive():
        raise AssertionError(
            "Body must not be read after Content-Length rejection"
        )

    messages = run_middleware(
        UploadRequestMiddleware(
            app,
            max_body_bytes=10,
        ),
        scope=build_scope(
            headers=[(b"content-length", b"11")],
        ),
        receive=receive,
    )

    status_code, body = get_response(messages)

    assert status_code == 413
    assert body == {
        "detail": "Upload request body is too large"
    }
    assert app_called is False


def test_streamed_body_over_limit_returns_413():
    app_called = False
    source_messages = [
        {
            "type": "http.request",
            "body": b"123456",
            "more_body": True,
        },
        {
            "type": "http.request",
            "body": b"78901",
            "more_body": False,
        },
    ]

    async def app(scope, receive, send):
        nonlocal app_called
        del scope, receive, send
        app_called = True

    async def receive():
        return source_messages.pop(0)

    messages = run_middleware(
        UploadRequestMiddleware(
            app,
            max_body_bytes=10,
        ),
        scope=build_scope(),
        receive=receive,
    )

    status_code, body = get_response(messages)

    assert status_code == 413
    assert body == {
        "detail": "Upload request body is too large"
    }
    assert app_called is False


def test_timeout_stops_after_request_body_is_complete():
    async def app(scope, receive, send):
        del scope

        message = await receive()
        assert message["body"] == b"complete"
        assert message["more_body"] is False

        await asyncio.sleep(0.05)

        await send(
            {
                "type": "http.response.start",
                "status": 204,
                "headers": [],
            }
        )
        await send(
            {
                "type": "http.response.body",
                "body": b"",
            }
        )

    async def receive():
        return {
            "type": "http.request",
            "body": b"complete",
            "more_body": False,
        }

    messages = run_middleware(
        UploadRequestMiddleware(
            app,
            inactivity_timeout_seconds=0.01,
        ),
        scope=build_scope(),
        receive=receive,
    )

    assert next(
        message
        for message in messages
        if message["type"] == "http.response.start"
    )["status"] == 204
