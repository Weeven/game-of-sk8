const GAME_ID = 'keeskatez';

const emptyState = () => ({ players: [], pendingWinner: null, screen: 'setup', winnerConfirmed: false });

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'Referrer-Policy': 'no-referrer' },
});

function validToken(request, env, write = false) {
  const token = request.headers.get('X-SK8-Token');
  if (!token) return false;
  return write ? token === env.SK8_CONTROL_UID : token === env.SK8_CONTROL_UID || token === env.SK8_OVERLAY_UID;
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

async function readState(env) {
  const row = await env.SK8_DB.prepare('SELECT state_json FROM sk8_state WHERE game_id = ?').bind(GAME_ID).first();
  return row ? JSON.parse(row.state_json) : emptyState();
}

export async function onRequestGet({ request, env }) {
  if (!validToken(request, env)) return json({ error: 'Invalid SK8 UID' }, 401);
  try { return json(await readState(env)); }
  catch (_) { return json({ error: 'SK8 storage is not configured' }, 500); }
}

export async function onRequestPost({ request, env }) {
  if (!validToken(request, env, true)) return json({ error: 'Control access required' }, 401);
  try {
    const state = cleanState(await request.json());
    await env.SK8_DB.prepare(`
      INSERT INTO sk8_state (game_id, state_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(game_id) DO UPDATE SET state_json = excluded.state_json, updated_at = CURRENT_TIMESTAMP
    `).bind(GAME_ID, JSON.stringify(state)).run();
    return json(state);
  } catch (_) { return json({ error: 'Invalid SK8 game state' }, 400); }
}
