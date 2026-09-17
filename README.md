# Game of SK8

A lightweight SK8 letter tracker for a streamer’s control window and OBS browser source.

## Local test

Requires Node.js 18 or newer.

```text
node scripts/sk8-server.mjs 8792
```

Open `http://127.0.0.1:8792/sk8` for the control window. After starting the first game, copy the generated OBS overlay link into OBS once. The “Start a new game” action reuses that same link and replaces only the game state behind it. The control link contains a private control token; the overlay link contains a separate read-only token.

## Hosting

The front end can be served by GitHub Pages, but GitHub Pages cannot run the live session API. For real streams, run `scripts/sk8-server.mjs` (or move its small API to a serverless host with durable storage) and serve the `public` files from the same origin. The test server stores streamer identities and current game state in `.data/sk8-sessions.json`; a multi-streamer production host should use a real database or durable key-value store.

### Free single-streamer deployment

Cloudflare Pages can deploy this repository with `public` as the build output directory and the `functions` folder as the API. Create one free D1 database, run `schema.sql`, and bind it as `SK8_DB`. Add two encrypted environment variables to the Pages project:

- `SK8_CONTROL_UID` — a long random secret used only in the control link.
- `SK8_OVERLAY_UID` — a separate long random secret used by OBS.

Use these permanent links after deployment:

```text
Control: https://YOUR-PAGES-DOMAIN/sk8.html?uid=SK8_CONTROL_UID
OBS:     https://YOUR-PAGES-DOMAIN/sk8-overlay.html?uid=SK8_OVERLAY_UID&mode=overlay
```

The OBS source is added once. Starting a new round only updates the single D1 state row, so its URL never changes. A normal URL without a UID shows a locked screen and cannot access the board.

## Session security

Every started game gets a random game ID, a private control token, and a separate overlay token. Only the control token can change letters or confirm a winner. Anyone with the overlay link can view that game, but cannot update it. Treat the control URL like a password.
