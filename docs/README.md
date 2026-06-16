# Project documentation

This folder documents how to run, maintain, and evolve the local-first personal finance transactions app.

## Current status

The app currently runs locally on a Mac, can be opened from an iPhone on the same Wi-Fi network, and can be added to the iPhone Home Screen as a local web app.

The backend uses FastAPI with SQLite. The frontend uses React, TypeScript, Vite, and minimal styling. A local access token gate exists, but this is not the same as production-grade authentication or user isolation.

## Important warning

This is still a local-first app. It is not ready to be public on the internet.

Do not expose it publicly until user accounts, data ownership, user-isolation tests, HTTPS, backups, and deployment hardening are in place.

## Documents

- `run-local.md`: how to run the local app during development.
- `local-network.md`: how to access the app from another device on the same Wi-Fi network.
- `sqlite-backups.md`: how local SQLite backups work.
- `pwa-local-app.md`: how to use the app as a local Home Screen app.
- `production-roadmap.md`: staged roadmap from the current local app to a secure multi-user app.
- `auth-options.md`: comparison of authentication and access-control options.
- `multi-user-data-model.md`: data ownership model required before real multi-user use.

## Recommended next steps

1. Keep the current local app private.
2. Add a local default-user ownership architecture before adding real authentication.
3. Add `user_id` ownership to private records.
4. Add user-isolation tests.
5. Only then evaluate real authentication and hosting options.
