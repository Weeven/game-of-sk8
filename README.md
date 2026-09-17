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

## Session security

Every started game gets a random game ID, a private control token, and a separate overlay token. Only the control token can change letters or confirm a winner. Anyone with the overlay link can view that game, but cannot update it. Treat the control URL like a password.
