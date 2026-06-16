# Production roadmap

## Purpose

This document explains what is missing before the local-first finance app can become a proper secure app that family or friends can use with their own accounts and isolated data.

The main point is simple: authentication is not the hard part. Correct user data isolation is the hard part.

## Current local architecture

The app currently has:

- FastAPI backend.
- SQLite database.
- React, TypeScript, and Vite frontend.
- Local network access for iPhone over the same Wi-Fi.
- Basic local access token gate.
- SQLite backup script.
- Local development startup scripts.
- Documentation for local running, local network access, backups, and Home Screen use.

This is suitable for personal local use. It is not suitable for public internet use or for family and friends with separate accounts.

## Target future architecture

A future secure multi-user version should have:

- Real user accounts.
- Private data owned by a specific user.
- Strict backend-side filtering by current user.
- User-isolation tests.
- Database migrations.
- A production database, likely Postgres through Supabase or another managed provider.
- HTTPS.
- Secure deployment.
- Backups and restore plan.
- Account export and delete flows.
- Clear privacy boundaries.

The backend should keep the same clean architecture:

- routers handle HTTP only.
- services handle business logic.
- repositories handle database access.
- importers handle source-specific CSV parsing.
- schemas handle API validation and serialisation.

## Staged roadmap

### 1. Local single-user app, current

The current app is a local single-user app.

It can be used privately on the Mac and on the iPhone over the same local network. The local access token gate helps avoid casual access on the LAN, but it does not provide production-grade identity, sessions, or account separation.

### 2. Multi-user readiness locally with fixed/default local user

Before adding real authentication, introduce the idea of a current user inside the backend.

For local development, this can be a fixed default local user. The goal is not to create accounts yet. The goal is to make the backend code behave as if a current user exists.

This allows the app to evolve safely without forcing an early auth decision.

### 3. User ownership in all private tables

Every private record should belong to a user.

Most private tables should gain a `user_id` field. Repositories and services should use this ownership field in every list, get, update, delete, import, and summary operation.

The frontend should not be trusted to provide ownership for private records.

### 4. User-isolation tests

User-isolation tests must prove that user A cannot access, modify, delete, summarise, or import into user B's data.

These tests are more important than the login screen.

A secure login page with broken user filtering is still a data leak.

### 5. Database migration readiness, likely Alembic

Manual schema changes are acceptable during early local development, but a multi-user app needs controlled migrations.

A likely future step is Alembic for database migrations.

Before moving to Postgres or Supabase, migrations should be able to:

- add tables.
- add columns.
- backfill existing rows.
- preserve existing local data.
- support repeatable setup in development.

### 6. Postgres/Supabase evaluation

SQLite is good for the current local-first app.

For a shared app with several users, a managed Postgres provider is likely a better fit. Supabase is a strong candidate because it can provide Postgres, authentication, storage, and row-level security if needed.

This decision should come after the backend already has clean user ownership boundaries.

### 7. Auth provider decision

Authentication should be chosen after the data model is ready for users.

Possible options include:

- local token for private local access.
- Tailscale or VPN for private remote access.
- Cloudflare Access for protected remote access.
- Supabase Auth with email magic links.
- Supabase Auth with OAuth.
- Google OAuth.
- passkeys.
- custom email/password auth.

Avoid custom password auth unless there is a strong reason to own that security burden.

### 8. HTTPS deployment

Any public or semi-public deployment must use HTTPS.

HTTPS is required for secure sessions, cookies, passkeys, OAuth redirects, and safe use over untrusted networks.

Do not expose the current local app publicly without HTTPS and proper access control.

### 9. Backups, monitoring, privacy, export/delete account

A real app for family or friends needs operational basics:

- automated backups.
- restore testing.
- error monitoring.
- privacy notes.
- account export.
- account deletion.
- clear ownership of imported financial data.
- clear rules for who can access the database and backups.

## Recommended order

The safest order is:

1. Keep the app local and private.
2. Add local default-user ownership architecture.
3. Add `user_id` to private records.
4. Add user-isolation tests.
5. Add migration tooling.
6. Evaluate Supabase/Postgres.
7. Choose authentication.
8. Deploy behind HTTPS.
9. Add account export, account delete, backups, and monitoring.
