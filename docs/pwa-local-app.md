# Local app experience

The frontend includes basic PWA metadata so the app can be added to the iPhone Home Screen or installed from a desktop browser when supported.

This does not make the app public. It still depends on the backend running on the Mac.

## Start the app on the local network

Use the commands in:

    docs/local-network.md

The backend should be started with APP_ACCESS_TOKEN set.

## Add to iPhone Home Screen

1. Make sure the iPhone is on the same Wi-Fi as the Mac.
2. Open Safari.
3. Visit the local frontend URL, for example:

       http://192.168.1.213:5173

4. Tap Share.
5. Tap Add to Home Screen.
6. Confirm the name.

The app will still need the Mac backend to be running.

## Install on Mac

In a Chromium-based browser, open the local frontend URL.

If the browser offers install support, use the install button in the address bar or browser menu.

Safari support depends on macOS and browser behaviour.

## Current limitations

- HTTP only.
- Local network only.
- No offline mode.
- No service worker.
- No cloud sync.
- No public hosting.
- No OAuth yet.

This is intentional. The app contains private financial data and should not be exposed publicly before a proper deployment and authentication plan exists.
