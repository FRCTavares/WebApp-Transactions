# Python version pinned to match requirements.txt's validated target (py313).
FROM python:3.13-slim

WORKDIR /app

# Keep Python from writing .pyc files / buffering stdout, matching typical
# container hygiene for a service whose logs are read via `gcloud run logs`.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run injects $PORT at runtime and expects the container to listen on
# it - never hardcode 8080/8000. Shell form so $PORT expands.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
