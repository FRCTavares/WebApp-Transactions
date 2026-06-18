# Deployment notes

This app is still local-first. These files prepare deployment, but do not mean the app is ready for public sharing.

## Target setup

- Backend: Render
- Database: Supabase/Postgres
- Frontend: Vercel

## Do not commit secrets

Set these in Render:

- DATABASE_URL
- CORS_ORIGINS
- APP_ACCESS_TOKEN
- ALLOWED_USER_EMAILS

Set this in Vercel:

- VITE_API_BASE_URL

## Render backend

The root render.yaml defines the backend service.

Expected settings:

- Root directory: backend
- Build command: pip install -r requirements.txt
- Pre-deploy command: alembic upgrade head
- Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
- Health check path: /api/health

LOCAL_NETWORK_ONLY must be false on Render.

## Supabase/Postgres

For non-SQLite databases, the FastAPI app does not run create_all on startup.

Schema creation must happen through Alembic:

alembic upgrade head

On Render this is configured as the pre-deploy command.

## Vercel frontend

The frontend must receive the backend URL at build time.

Example Vercel environment variable:

VITE_API_BASE_URL=https://your-render-backend.onrender.com

## Not ready for public family/friends use yet

Still required before real sharing:

1. Proper authentication and user accounts.
2. Removal of the temporary shared access token bridge.
3. Production CORS restricted to the final Vercel domain.
4. Supabase/Postgres migration tested on a real database.
5. Backup/export strategy for user data.
6. Clear privacy model per user.
