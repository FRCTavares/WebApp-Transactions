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
