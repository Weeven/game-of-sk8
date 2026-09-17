(() => {
  const MAX_PLAYERS = 6;
  const LETTERS = ['S', 'K', '8'];
  const STORAGE_KEY = 'sk8-game-state-v1';
  const params = new URLSearchParams(window.location.search);
  const isOverlay = params.get('mode') === 'overlay' || window.location.hash === '#overlay' || /sk8-overlay(?:\.html)?$/.test(window.location.pathname);
  const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  let gameId = params.get('game') || 'local-demo';
  let controlToken = params.get('control') || '';
  let overlayToken = params.get('overlay') || '';
  const state = { players: [], pendingWinner: null, screen: 'setup', winnerConfirmed: false };

  document.body.classList.toggle('overlay-mode', isOverlay);

  const $ = id => document.getElementById(id);
  const setup = $('setup-screen');
  const board = $('board-screen');
  const winner = $('winner-screen');
  const list = $('name-list');
  const addPlayer = $('add-player');
  const startGame = $('start-game');
  const grid = $('player-grid');
  const sessionTools = $('session-tools');
  const overlayUrl = $('overlay-url');
  const copyOverlay = $('copy-overlay');

  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function readSavedState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.players?.length) Object.assign(state, saved);
    } catch (_) { /* Local file origins can restrict storage; the prototype still works in-tab. */ }
  }

  function authHeaders() {
    const token = isOverlay ? overlayToken : controlToken;
    return token ? { 'X-SK8-Token': token } : {};
  }

  async function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* best effort for file:// previews */ }
    if (isHttp) return pushRemoteState();
  }

  async function loadRemoteState() {
    try {
      const response = await fetch(`/api/sk8/state?game=${encodeURIComponent(gameId)}`, { cache: 'no-store', headers: authHeaders() });
      if (!response.ok) return false;
      const saved = await response.json();
      if (saved?.players?.length) Object.assign(state, saved);
      return true;
    } catch (_) { return false; }
  }

  async function pushRemoteState() {
    try {
      await fetch(`/api/sk8/state?game=${encodeURIComponent(gameId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(state) });
    } catch (_) { /* local preview can fall back to browser storage */ }
  }

  async function createRemoteSession() {
    try {
      const response = await fetch('/api/sk8/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) return false;
      const session = await response.json();
      gameId = session.gameId;
      controlToken = session.controlToken;
      overlayToken = session.overlayToken;
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('game', gameId);
      nextUrl.searchParams.set('control', controlToken);
      nextUrl.searchParams.delete('overlay');
      nextUrl.searchParams.delete('mode');
      nextUrl.hash = '';
      window.history.replaceState({}, '', nextUrl);
      updateSessionLinks();
      return true;
    } catch (_) { return false; }
  }

  async function loadSessionDetails() {
    if (!isHttp || isOverlay || !controlToken || gameId === 'local-demo') return;
    try {
      const response = await fetch(`/api/sk8/session?game=${encodeURIComponent(gameId)}`, { cache: 'no-store', headers: authHeaders() });
      if (response.ok) overlayToken = (await response.json()).overlayToken || '';
    } catch (_) { /* the control screen can still render without the convenience link */ }
  }

  function makeOverlayUrl() {
    const nextUrl = new URL(window.location.href);
    if (/sk8(?:\.html)?$/.test(nextUrl.pathname)) nextUrl.pathname = nextUrl.pathname.replace(/sk8(?:\.html)?$/, 'sk8-overlay');
    nextUrl.searchParams.set('game', gameId);
    nextUrl.searchParams.set('mode', 'overlay');
    nextUrl.searchParams.delete('control');
    if (overlayToken) nextUrl.searchParams.set('overlay', overlayToken);
    else nextUrl.searchParams.delete('overlay');
    nextUrl.hash = '';
    return nextUrl.toString();
  }

  function updateSessionLinks() {
    if (!sessionTools || isOverlay || !isHttp || !state.players.length) return;
    sessionTools.hidden = false;
    overlayUrl.value = makeOverlayUrl();
  }

  function createNameInput(value = '', locked = false) {
    const row = document.createElement('label');
    row.className = 'name-row';
    row.innerHTML = `<span class="name-number" aria-hidden="true"></span><input class="name-input${locked ? ' locked' : ''}" maxlength="18" autocomplete="off" placeholder="Player name" value="${escapeHtml(value)}"${locked ? ' readonly aria-label="Player 1 KeeSkatez"' : ''}>`;
    row.querySelector('input').addEventListener('input', updateSetupState);
    list.append(row);
    updateSetupState();
  }

  function resetSetupInputs() {
    list.replaceChildren();
    createNameInput('KeeSkatez', true);
    createNameInput();
  }

  function updateSetupState() {
    [...list.children].forEach((row, index) => { row.querySelector('.name-number').textContent = String(index + 1); });
    const count = [...list.querySelectorAll('input')].filter(input => input.value.trim()).length;
    startGame.disabled = count < 2;
    addPlayer.hidden = list.children.length >= MAX_PLAYERS;
  }

  function shuffle(players) {
    const result = [...players];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result;
  }

  function activePlayers() { return state.players.filter(player => !player.eliminated); }

  function finalPlayer() {
    const active = activePlayers();
    return active.length === 1 && state.players.some(player => player.eliminated) ? active[0] : null;
  }

  function show(screen) {
    [setup, board, winner].forEach(node => { node.hidden = node !== screen || isOverlay; });
    if (isOverlay) {
      board.hidden = screen !== board;
      winner.hidden = screen !== winner;
      setup.hidden = true;
    }
  }

  function renderBoard() {
    grid.className = `player-grid count-${state.players.length}`;
    grid.replaceChildren();
    state.players.forEach(player => {
      const card = document.createElement('article');
      card.className = `player-card${player.eliminated ? ' eliminated' : ''}`;
      card.innerHTML = `<div class="player-name">${escapeHtml(player.name)}</div><div class="status">${player.eliminated ? 'Eliminated' : 'Still in'}</div><div class="letters" aria-label="${escapeHtml(player.name)} letters"></div>`;
      const letters = card.querySelector('.letters');
      LETTERS.forEach((letter, letterIndex) => {
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = `letter-slot ${player.letters[letterIndex] ? 'filled' : 'empty'}`;
        slot.setAttribute('aria-label', player.letters[letterIndex] ? `${letter} — click to remove` : `Add ${letter}`);
        slot.textContent = letter;
        if (player.letters[letterIndex]) {
          const remove = document.createElement('span');
          remove.className = 'remove-letter';
          remove.setAttribute('aria-hidden', 'true');
          remove.textContent = '×';
          slot.append(remove);
        }
        if (!isOverlay) {
          slot.addEventListener('click', event => {
            event.stopPropagation();
            if (player.letters[letterIndex]) player.letters[letterIndex] = false;
            else if (!player.eliminated && letterIndex === player.letters.findIndex(value => !value)) player.letters[letterIndex] = true;
            player.eliminated = player.letters.every(Boolean);
            state.pendingWinner = finalPlayer();
            saveState();
            render();
          });
        }
        letters.append(slot);
      });
      grid.append(card);
    });
    state.pendingWinner = finalPlayer();
    const check = $('winner-check');
    check.hidden = !state.pendingWinner || isOverlay;
    if (state.pendingWinner) $('last-player').textContent = state.pendingWinner.name;
    updateSessionLinks();
  }

  function render() {
    if (state.screen === 'winner' && state.winnerConfirmed && state.players.length) {
      $('winner-title').textContent = state.players.find(player => !player.eliminated)?.name || 'Winner';
      show(winner);
      return;
    }
    if (state.players.length && state.screen === 'board') {
      renderBoard();
      show(board);
      return;
    }
    show(setup);
  }

  async function start() {
    const names = [...list.querySelectorAll('input')].map(input => input.value.trim()).filter(Boolean);
    const kee = names.shift() || 'KeeSkatez';
    if (isHttp && !isOverlay && (!controlToken || gameId === 'local-demo') && !(await createRemoteSession())) {
      window.alert('Could not create a game session. Check that the SK8 server is running.');
      return;
    }
    state.players = shuffle([kee, ...names]).map(name => ({ name, letters: [false, false, false], eliminated: false }));
    state.pendingWinner = null;
    state.screen = 'board';
    state.winnerConfirmed = false;
    await saveState();
    render();
  }

  addPlayer.addEventListener('click', () => createNameInput());
  startGame.addEventListener('click', start);
  copyOverlay?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(overlayUrl.value);
      copyOverlay.textContent = 'Copied';
      window.setTimeout(() => { copyOverlay.textContent = 'Copy'; }, 1400);
    } catch (_) {
      overlayUrl.select();
      document.execCommand('copy');
    }
  });
  $('confirm-winner').addEventListener('click', () => {
    if (!state.pendingWinner) return;
    state.screen = 'winner';
    state.winnerConfirmed = true;
    saveState();
    render();
  });
  $('new-game').addEventListener('click', () => {
    state.players = [];
    state.pendingWinner = null;
    state.screen = 'setup';
    state.winnerConfirmed = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* best effort */ }
    resetSetupInputs();
    render();
  });

  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY || !isOverlay || isHttp) return;
    readSavedState();
    render();
  });

  async function init() {
    resetSetupInputs();
    await loadSessionDetails();
    if (isHttp) await loadRemoteState();
    else readSavedState();
    render();
    if (isOverlay && isHttp) window.setInterval(async () => { if (await loadRemoteState()) render(); }, 750);
  }

  init();
})();
