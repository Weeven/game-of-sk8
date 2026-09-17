import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const port = Number(process.argv[2] ?? process.env.SK8_PORT ?? 8791);
const dataFile = resolve(process.env.SK8_DATA_FILE ?? '.data/sk8-sessions.json');
const games = new Map();

const emptyGame = () => ({ players: [], pendingWinner: null, screen: 'setup', winnerConfirmed: false });

function loadSessions() {
  try {
    const saved = JSON.parse(readFileSync(dataFile, 'utf8'));
    for (const [gameId, session] of Object.entries(saved)) {
      if (session?.controlToken && session?.overlayToken && session?.state) games.set(gameId, session);
    }
  } catch (_) { /* a first run starts with an empty session store */ }
}

function persistSessions() {
  try {
    mkdirSync(dirname(dataFile), { recursive: true });
    writeFileSync(dataFile, JSON.stringify(Object.fromEntries(games), null, 2));
  } catch (_) { /* the UI still works when the host filesystem is read-only */ }
}

games.set('local-demo', { controlToken: null, overlayToken: null, state: emptyGame() });
loadSessions();

const uid = (bytes = 16) => randomBytes(bytes).toString('base64url');

function createSession() {
  let gameId = uid(9);
  while (games.has(gameId)) gameId = uid(9);
  const session = { controlToken: uid(32), overlayToken: uid(32), state: emptyGame() };
  games.set(gameId, session);
  persistSessions();
  return { gameId, controlToken: session.controlToken, overlayToken: session.overlayToken };
}

function json(res, status, value) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(JSON.stringify(value));
}

function cleanState(value) {
  const players = Array.isArray(value?.players) ? value.players.slice(0, 6).map(player => ({
    name: String(player?.name ?? '').slice(0, 18),
    letters: Array.isArray(player?.letters) ? [Boolean(player.letters[0]), Boolean(player.letters[1]), Boolean(player.letters[2])] : [false, false, false],
    eliminated: Boolean(player?.eliminated),
  })).filter(player => player.name) : [];
  return {
    players,
    pendingWinner: null,
    screen: value?.screen === 'winner' ? 'winner' : value?.screen === 'board' ? 'board' : 'setup',
    winnerConfirmed: Boolean(value?.winnerConfirmed),
  };
}

function serveFile(res, file, type) {
  try {
    res.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': type, 'Referrer-Policy': 'no-referrer' });
    res.end(readFileSync(resolve('public', file)));
  } catch (_) {
    res.writeHead(404);
    res.end('Not found');
  }
}

function isAuthorized(session, request, write = false) {
  if (!session) return false;
  if (!session.controlToken && !session.overlayToken) return true;
  const token = request.headers['x-sk8-token'];
  return write ? token === session.controlToken : token === session.controlToken || token === session.overlayToken;
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = url.pathname;
  const gameId = url.searchParams.get('game') || 'local-demo';

  if (pathname === '/api/sk8/session' && req.method === 'POST') {
    return json(res, 201, createSession());
  }

  if (pathname === '/api/sk8/session' && req.method === 'GET') {
    const session = games.get(gameId);
    if (!isAuthorized(session, req) || req.headers['x-sk8-token'] !== session?.controlToken) return json(res, 401, { error: 'Control access required' });
    return json(res, 200, { gameId, overlayToken: session.overlayToken });
  }

  if (pathname === '/api/sk8/state' && req.method === 'GET') {
    const session = games.get(gameId);
    if (!session) return json(res, 404, { error: 'Game not found' });
    if (!isAuthorized(session, req)) return json(res, 401, { error: 'Invalid session token' });
    return json(res, 200, session.state);
  }

  if (pathname === '/api/sk8/state' && req.method === 'POST') {
    const session = games.get(gameId);
    if (!session) return json(res, 404, { error: 'Game not found' });
    if (!isAuthorized(session, req, true)) return json(res, 401, { error: 'Control access required' });
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 100000) req.destroy(); });
    req.on('end', () => {
      try {
        const game = cleanState(JSON.parse(body));
        session.state = game;
        persistSessions();
        json(res, 200, game);
      } catch (_) { json(res, 400, { error: 'Invalid game state' }); }
    });
    return;
  }

  if (pathname === '/' || pathname === '/sk8' || pathname === '/sk8.html' || pathname === '/sk8-overlay' || pathname === '/sk8-overlay.html') return serveFile(res, 'sk8.html', 'text/html; charset=utf-8');
  if (pathname === '/sk8-runtime.js') return serveFile(res, 'sk8-runtime.js', 'text/javascript; charset=utf-8');
  res.writeHead(404);
  res.end('Not found');
});

server.listen(port, '127.0.0.1', () => console.log(`SK8 local server: http://127.0.0.1:${port}/sk8.html`));
