const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'Referrer-Policy': 'no-referrer' },
});

export async function onRequestGet({ request, env }) {
  const token = request.headers.get('X-SK8-Token');
  if (!token || token !== env.SK8_CONTROL_UID) return json({ error: 'Control access required' }, 401);
  return json({ gameId: 'keeskatez', overlayToken: env.SK8_OVERLAY_UID });
}
