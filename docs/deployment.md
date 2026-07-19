# Deployment

## Production API documentation policy

FastAPI documentation exposure is controlled by `API_DOCS_ENABLED`.

The application uses these defaults:

- documentation is enabled outside production;
- documentation is disabled when `APP_ENV=production`;
- an explicit `API_DOCS_ENABLED=true` enables documentation in any environment;
- an explicit false value disables documentation in any environment.

When documentation is disabled, the following endpoints are not registered:

- `/docs`
- `/docs/oauth2-redirect`
- `/redoc`
- `/openapi.json`

The Render production service sets `API_DOCS_ENABLED=false` explicitly. Public
production deployments must keep this setting disabled unless API documentation
exposure has been deliberately reviewed and approved.

Local development requires no additional configuration because documentation is
enabled by default. Set `API_DOCS_ENABLED=false` locally to test the disabled
behavior.

## Account deletion configuration

Production account deletion requires `SUPABASE_SERVICE_ROLE_KEY` on the backend
service. This secret authorizes the backend to remove the authenticated user's
Supabase Auth identity after the user's application data has been deleted.

Requirements:

- configure the service-role key only on Render or another trusted backend;
- never expose it through a `VITE_` variable or frontend bundle;
- never commit it to the repository or include it in logs;
- rotate it immediately if it is exposed;
- verify the Settings account-deletion flow after changing Supabase projects.

If the variable is absent, the deletion endpoint returns a controlled
configuration error and does not claim that the account identity was removed.

Set `VITE_PRIVACY_CONTACT_EMAIL` in the Vercel frontend environment to the
monitored address that handles privacy requests. This value is public and must
not contain credentials or private operational information.
