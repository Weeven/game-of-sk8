(() => {
  const MAX_PLAYERS = 6;
  const LETTERS = ['S', 'K', '8'];
  const STORAGE_KEY = 'sk8-game-state-v1';
  const params = new URLSearchParams(window.location.search);
  const isOverlay = params.get('mode') === 'overlay' || window.location.hash === '#overlay' || /sk8-overlay(?:\.html)?$/.test(window.location.pathname);
  const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const requiresUid = isHttp && !isLocalHost;
  const fixedUid = params.get('uid') || '';
  let gameId = params.get('game') || (fixedUid ? 'keeskatez' : 'local-demo');
  let controlToken = params.get('control') || (!isOverlay ? fixedUid : '');
  let overlayToken = params.get('overlay') || (isOverlay ? fixedUid : '');
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
  const setupSessionTools = $('setup-session-tools');
  const setupOverlayUrl = $('setup-overlay-url');
  const setupCopyOverlay = $('setup-copy-overlay');
  const sessionTools = $('session-tools');
  const overlayUrl = $('overlay-url');
  const copyOverlay = $('copy-overlay');

  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function readSavedState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && Array.isArray(saved.players)) Object.assign(state, saved);
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

  function clearOverlay() {
    if (!isOverlay) return;
    state.players = [];
    state.pendingWinner = null;
    state.screen = 'setup';
    state.winnerConfirmed = false;
    show(setup);
  }

  async function pushRemoteState(nextState = state) {
    try {
      await fetch(`/api/sk8/state?game=${encodeURIComponent(gameId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(nextState) });
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
    if (/sk8(?:\.html)?$/.test(nextUrl.pathname)) nextUrl.pathname = nextUrl.pathname.replace(/sk8(?:\.html)?$/, nextUrl.pathname.endsWith('.html') ? 'sk8-overlay.html' : 'sk8-overlay');
    nextUrl.searchParams.set('game', gameId);
    nextUrl.searchParams.set('mode', 'overlay');
    nextUrl.searchParams.delete('control');
    if (overlayToken) nextUrl.searchParams.set('uid', overlayToken);
    else nextUrl.searchParams.delete('uid');
    nextUrl.searchParams.delete('overlay');
    nextUrl.hash = '';
    return nextUrl.toString();
  }

  function updateSessionLinks() {
    if (isOverlay || !isHttp || !overlayToken) return;
    const url = makeOverlayUrl();
    if (setupSessionTools) {
      setupSessionTools.hidden = state.screen !== 'setup';
      if (setupOverlayUrl) setupOverlayUrl.value = url;
    }
    if (sessionTools) {
      sessionTools.hidden = state.screen !== 'board';
      if (overlayUrl) overlayUrl.value = url;
    }
  }

  function showUidRequired() {
    if (!requiresUid || fixedUid) return false;
    document.body.innerHTML = '<main class="access-locked"><div><div class="locked-mark">SK8</div><h1>Private game link required</h1><p>This KeeSK8 board is only available from the streamer\'s private link.</p></div></main>';
    return true;
  }

  function createNameInput(value = '', locked = false) {
    const row = document.createElement('div');
    row.className = 'name-row';
    row.innerHTML = `<span class="name-number" aria-hidden="true"></span><div class="name-field"><input class="name-input${locked ? ' locked' : ''}" maxlength="18" autocomplete="off" placeholder="Player name" value="${escapeHtml(value)}"${locked ? ' readonly aria-label="Player 1 KeeSkatez"' : ''}>${locked ? '' : '<button class="remove-player" type="button" aria-label="Remove player">×</button>'}</div>`;
    row.querySelector('input').addEventListener('input', updateSetupState);
    row.querySelector('.remove-player')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      row.remove();
      updateSetupState();
    });
    list.append(row);
    updateSetupState();
  }

  function resetSetupInputs() {
    list.replaceChildren();
    createNameInput('KeeSkatez', true);
    createNameInput();
  }

  function updateSetupState() {
    [...list.children].forEach((row, index) => {
      row.querySelector('.name-number').textContent = String(index + 1);
      row.querySelector('.remove-player')?.setAttribute('aria-label', `Remove player ${index + 1}`);
    });
    const inputs = [...list.querySelectorAll('input')];
    startGame.disabled = inputs.length < 2 || inputs.some(input => !input.value.trim());
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
    updateSessionLinks();
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
    if (isHttp && !isOverlay && !fixedUid && (!controlToken || gameId === 'local-demo') && !(await createRemoteSession())) {
      window.alert('Could not create a game session. Check that the KeeSK8 server is running.');
      return;
    }
    state.players = shuffle([kee, ...names]).map(name => ({ name, letters: [false, false, false], eliminated: false }));
    state.pendingWinner = null;
    state.screen = 'board';
    state.winnerConfirmed = false;
    await saveState();
    render();
  }

  async function resetGame() {
    if (!state.players.length) return;
    state.players = state.players.map(player => ({ ...player, letters: [false, false, false], eliminated: false }));
    state.pendingWinner = null;
    state.screen = 'board';
    state.winnerConfirmed = false;
    await saveState();
    render();
  }

  async function startNewGame() {
    const blankPlayers = state.players.map(player => ({ ...player, letters: [...player.letters] }));
    state.players = [];
    state.pendingWinner = null;
    state.screen = 'setup';
    state.winnerConfirmed = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* best effort */ }
    resetSetupInputs();
    // Keep the previous records in the remote setup state for one update so older cached
    // overlays accept the screen change instead of ignoring an empty player list.
    await pushRemoteState({ ...state, players: blankPlayers });
    render();
  }

  addPlayer.addEventListener('click', () => createNameInput());
  startGame.addEventListener('click', start);
  $('reset-game').addEventListener('click', resetGame);
  async function copyOverlayLink(input, button) {
    if (!input?.value) return;
    try {
      await navigator.clipboard.writeText(input.value);
      button.textContent = 'Copied';
      window.setTimeout(() => { button.textContent = 'Copy'; }, 1400);
    } catch (_) {
      input.select();
      document.execCommand('copy');
    }
  }
  copyOverlay?.addEventListener('click', () => copyOverlayLink(overlayUrl, copyOverlay));
  setupCopyOverlay?.addEventListener('click', () => copyOverlayLink(setupOverlayUrl, setupCopyOverlay));
  $('confirm-winner').addEventListener('click', () => {
    if (!state.pendingWinner) return;
    state.screen = 'winner';
    state.winnerConfirmed = true;
    saveState();
    render();
  });
  $('new-game').addEventListener('click', startNewGame);
  $('board-new-game').addEventListener('click', startNewGame);

  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY || !isOverlay || isHttp) return;
    readSavedState();
    render();
  });

  window.addEventListener('beforeunload', event => {
    if (isOverlay || !isHttp) return;
    event.preventDefault();
    event.returnValue = 'Closing this control page will stop KeeSK8 and remove the OBS overlay.';
    return event.returnValue;
  });

  window.addEventListener('pagehide', () => {
    if (isOverlay || !isHttp || !controlToken || gameId === 'local-demo') return;
    fetch(`/api/sk8/stop?game=${encodeURIComponent(gameId)}`, {
      method: 'POST',
      headers: { 'X-SK8-Token': controlToken },
      keepalive: true,
    }).catch(() => {});
  });

  async function init() {
    if (showUidRequired()) return;
    resetSetupInputs();
    if (isHttp && !isOverlay && !fixedUid && (!controlToken || gameId === 'local-demo')) await createRemoteSession();
    await loadSessionDetails();
    if (isHttp) await loadRemoteState();
    else readSavedState();
    render();
    if (isOverlay && isHttp) window.setInterval(async () => {
      if (await loadRemoteState()) render();
      else clearOverlay();
    }, 750);
  }

  init();
})();
