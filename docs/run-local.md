# Run locally

This project is currently designed for local and local-network use.

The Mac runs both servers:

- FastAPI backend on port 8000
- Vite frontend on port 5173

The iPhone connects over the same Wi-Fi.

## One-time shell setup per terminal session

Choose a private local token and export it in the backend terminal:

    export APP_ACCESS_TOKEN="your-real-local-token"

Do not commit the real token.

## Start the backend

From the repo root:

    ./scripts/dev_backend_lan.sh

The script:

- requires APP_ACCESS_TOKEN
- detects the Mac LAN IP
- sets CORS_ORIGINS
- starts FastAPI on 0.0.0.0:8000

## Start the frontend

In a second terminal, from the repo root:

    ./scripts/dev_frontend_lan.sh

The script:

- detects the Mac LAN IP
- sets VITE_API_BASE_URL
- starts Vite on 0.0.0.0:5173
- prints the iPhone URL

## Open on iPhone

Make sure the iPhone is on the same Wi-Fi as the Mac.

Open the printed frontend URL, for example:

    http://192.168.1.213:5173

Enter the same APP_ACCESS_TOKEN in the unlock screen.

## Stop the app

Press Ctrl+C in both terminal tabs.

## Notes

The app is still not public and not production-hosted.

Current limitations:

- local network only
- HTTP only
- no cloud sync
- no OAuth
- no user accounts
- no background service
