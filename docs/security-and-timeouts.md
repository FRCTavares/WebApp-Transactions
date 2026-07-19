# Security and timeout policy

## Runtime defaults

- Browser API requests abort after 30 seconds. Callers can provide a shorter timeout and an `AbortSignal` through the shared API client.
- Yahoo Finance market-data operations return a controlled error after `MARKET_DATA_TIMEOUT_SECONDS` (15 seconds by default). Cancellation is requested and the HTTP response is released without logging the requested symbol.
- Database connections and pool checkout wait at most `DATABASE_CONNECT_TIMEOUT_SECONDS` (10 seconds by default).
- PostgreSQL statements use `DATABASE_STATEMENT_TIMEOUT_MS` (30 seconds by default). SQLite uses the connection timeout as its bounded busy-lock wait.

All timeout values must be positive integers. Timeout responses use generic messages and request logs contain only the route template, method, status, duration, request ID, and a one-way user identifier.

## HTTP response hardening

The API returns `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and a restrictive `Content-Security-Policy` suitable for a JSON API. Production also returns one-year HSTS with subdomains. The frontend host should independently set a CSP matching its configured API and Supabase origins because those origins are deployment-specific.
