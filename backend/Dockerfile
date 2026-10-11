# Self-hosted API image (HomeServer). Build context: this directory.
#
#   docker build --build-arg GIT_COMMIT=<sha> -t finance-api:<sha> backend/
#
# The same image runs the API and the one-shot schema job
# (`python -m alembic upgrade head`). The container runs as an arbitrary
# unprivileged uid on a read-only root filesystem, so nothing may be written
# under /app at runtime: /app/data exists only so the app's import-time
# mkdir succeeds, and caches go to the tmpfs at /tmp.
FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /app/data && chmod 0555 /app/data

# Reported by GET /api/health.
ARG GIT_COMMIT=""
ENV APP_GIT_COMMIT=${GIT_COMMIT} \
    HOME=/tmp \
    XDG_CACHE_HOME=/tmp \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

USER 65534:65534
EXPOSE 8080

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "*"]
