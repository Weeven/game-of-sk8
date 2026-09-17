# Game of SK8

A lightweight SK8 letter tracker for a streamer’s control window and OBS browser source.

## Local test

Requires Node.js 18 or newer.

```text
node scripts/sk8-server.mjs 8792
```

Open `http://127.0.0.1:8792/sk8` for the control window. After starting a game, copy the generated OBS overlay link into OBS. The control link contains a private control token; the overlay link contains a separate read-only token.

## Hosting

The front end can be served by GitHub Pages, but GitHub Pages cannot run the live session API. For real streams, run `scripts/sk8-server.mjs` (or move its small API to a serverless host with durable storage) and serve the `public` files from the same origin. The current server keeps sessions in memory, so it is intended for testing until a persistent host is selected.

## Session security

Every started game gets a random game ID, a private control token, and a separate overlay token. Only the control token can change letters or confirm a winner. Anyone with the overlay link can view that game, but cannot update it. Treat the control URL like a password.
