# Local network usage

This app contains private personal finance data.

Use this mode only on a trusted local Wi-Fi network. Do not port-forward the backend or frontend. Do not expose these ports publicly.

## 1. Find the Mac local IP

Run this command:

    ipconfig getifaddr en0

If that returns nothing, try:

    ipconfig getifaddr en1

Example result:

    192.168.1.50

In the commands below, replace 192.168.1.50 with your Mac local IP.

## 2. Start the backend for local network access

From the repo root:

    cd backend

    CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.50:5173 \
    PYTHONPATH=. \
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

## 3. Start the frontend for local network access

Open a second terminal tab.

From the repo root:

    cd frontend

    VITE_API_BASE_URL=http://192.168.1.50:8000 \
    npm run dev -- --host 0.0.0.0

## 4. Open the app on iPhone

Make sure the iPhone is on the same Wi-Fi as the Mac.

Open Safari and visit:

    http://192.168.1.50:5173

## 5. Stop local network access

When finished, stop both servers with Ctrl+C.

The app is still HTTP-only and has no app password yet. Do not use this on public or untrusted Wi-Fi.
