import {
  getAdminGameId,
  getGameState,
  saveGameState,
  addAnnouncement,
  GameStatus,
} from '../shared/store';

export function renderControls(content: HTMLElement, updateContent: () => void): void {
  const gameId = getAdminGameId();
  if (!gameId) {
    return;
  }

  const state = getGameState();

  const wrapper = document.createElement('div');
  wrapper.className = 'admin-controls-wrapper';

  const statusGroup = document.createElement('div');
  statusGroup.className = 'admin-control-group';

  const actions = document.createElement('div');
  actions.className = 'admin-control-actions';

  const configGroup = document.createElement('div');

  const skipPregameLabel = document.createElement('label');
  const skipPregameCheck = document.createElement('input');
  skipPregameCheck.type = 'checkbox';
  skipPregameCheck.checked = state.skipPregame;
  skipPregameCheck.disabled = state.status !== GameStatus.Stopped;
  skipPregameCheck.addEventListener('change', () => {
    state.skipPregame = skipPregameCheck.checked;
    saveGameState(gameId, state);
  });
  skipPregameLabel.appendChild(skipPregameCheck);
  skipPregameLabel.appendChild(document.createTextNode(' Skip Pre-Game'));
  configGroup.appendChild(skipPregameLabel);

  const skipMainLabel = document.createElement('label');
  const skipMainCheck = document.createElement('input');
  skipMainCheck.type = 'checkbox';
  skipMainCheck.checked = state.skipMainPhase;
  skipMainCheck.disabled = state.status !== GameStatus.Stopped;
  skipMainCheck.addEventListener('change', () => {
    state.skipMainPhase = skipMainCheck.checked;
    saveGameState(gameId, state);
    updateContent();
  });
  skipMainLabel.appendChild(skipMainCheck);
  skipMainLabel.appendChild(document.createTextNode(' Skip Main Phase'));
  configGroup.appendChild(skipMainLabel);

  const skipFinalLabel = document.createElement('label');
  const skipFinalCheck = document.createElement('input');
  skipFinalCheck.type = 'checkbox';
  skipFinalCheck.checked = state.skipFinalChallenge;
  skipFinalCheck.disabled = state.status !== GameStatus.Stopped;
  skipFinalCheck.addEventListener('change', () => {
    state.skipFinalChallenge = skipFinalCheck.checked;
    saveGameState(gameId, state);
  });
  skipFinalLabel.appendChild(skipFinalCheck);
  skipFinalLabel.appendChild(document.createTextNode(' Skip Final Challenge'));
  configGroup.appendChild(skipFinalLabel);

  const startBtn = document.createElement('button');
  startBtn.textContent = state.status === 'paused' ? 'Resume' : 'Start';
  startBtn.className = 'admin-btn-primary';
  startBtn.addEventListener('click', () => {
    state.skipPregame = skipPregameCheck.checked;
    state.skipMainPhase = skipMainCheck.checked;
    state.skipFinalChallenge = skipFinalCheck.checked;

    const gameDuration = state.skipMainPhase ? 0 : 120 * 60;
    const pregameDuration = state.skipPregame ? 0 : 5 * 60;
    const totalDuration = gameDuration + pregameDuration;

    if (state.status === GameStatus.Stopped) {
      state.duration = totalDuration;
      state.timeRemainingSeconds = totalDuration;
    }
    state.status = GameStatus.Running;
    state.lastTickTimestamp = Date.now();
    saveGameState(gameId, state);
    updateContent();
  });

  const pauseBtn = document.createElement('button');
  pauseBtn.textContent = 'Pause';
  pauseBtn.className = 'admin-btn-secondary';
  pauseBtn.disabled = state.status !== GameStatus.Running;
  pauseBtn.addEventListener('click', () => {
    if (state.status === GameStatus.Running) {
      const now = Date.now();
      const elapsed = Math.floor((now - state.lastTickTimestamp) / 1000);
      state.timeRemainingSeconds = Math.max(0, state.timeRemainingSeconds - elapsed);
      state.status = GameStatus.Paused;
      saveGameState(gameId, state);
      updateContent();
    }
  });

  const stopBtn = document.createElement('button');
  stopBtn.textContent = 'Stop';
  stopBtn.className = 'admin-btn-danger';
  stopBtn.disabled = state.status === GameStatus.Stopped;
  stopBtn.addEventListener('click', () => {
    if (state.status === GameStatus.Running) {
      const now = Date.now();
      const elapsed = Math.floor((now - state.lastTickTimestamp) / 1000);
      state.timeRemainingSeconds = Math.max(0, state.timeRemainingSeconds - elapsed);
    }
    state.status = GameStatus.Stopped;
    saveGameState(gameId, state);
    updateContent();
  });

  actions.appendChild(startBtn);
  actions.appendChild(pauseBtn);
  actions.appendChild(stopBtn);
  statusGroup.appendChild(configGroup);
  statusGroup.appendChild(actions);

  wrapper.appendChild(statusGroup);

  const annGroup = document.createElement('div');
  annGroup.className = 'admin-control-group';

  const annTitle = document.createElement('h3');
  annTitle.textContent = 'Announce';
  annGroup.appendChild(annTitle);

  const annInput = document.createElement('textarea');
  annInput.placeholder = 'Very important thing, etc...';
  annGroup.appendChild(annInput);

  const sendAnnBtn = document.createElement('button');
  sendAnnBtn.textContent = 'Send';
  sendAnnBtn.className = 'admin-btn-primary';
  sendAnnBtn.addEventListener('click', () => {
    const text = annInput.value.trim();
    if (text) {
      addAnnouncement(gameId, text);
      annInput.value = '';
    }
  });

  annGroup.appendChild(sendAnnBtn);
  wrapper.appendChild(annGroup);

  content.appendChild(wrapper);
}
