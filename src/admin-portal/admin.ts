import {
  getPendingSubmissions,
  setSubmissionStatus,
  getLeaderboard,
  getChallengeById,
  getAdminGameId,
  getGameState,
  saveGameState,
  addAnnouncement,
  getTeamData,
  setAdminGameId,
  SubmissionStatus,
  GameStatus,
} from '../shared/store';
import { createSvgIcon } from '../shared/svg';

export const AdminTab = {
  Submissions: 'submissions',
  Leaderboard: 'leaderboard',
  Controls: 'controls',
} as const;
export type AdminTab = (typeof AdminTab)[keyof typeof AdminTab];

let container: HTMLElement | null = null;
let statusDisplay: HTMLElement | null = null;
let activeTab: AdminTab = AdminTab.Controls;
let refreshInterval: number | undefined;
let availableGames: number[] = [];

export async function mountAdmin(host: HTMLElement): Promise<void> {
  container = host;
  activeTab = AdminTab.Submissions;

  availableGames = [];
  for (const [envKey, id] of [
    ['VITE_GAME_CODE_1', 1],
    ['VITE_GAME_CODE_2', 2],
    ['VITE_GAME_CODE_3', 3],
  ] as const) {
    if (import.meta.env[envKey]?.trim()) {
      availableGames.push(id);
    }
  }

  renderShell();
  updateContent();
  refreshInterval = setInterval(() => {
    if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      updateContent();
    }
  }, 2000);
}

export function unmountAdmin(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = undefined;
  }
  if (container) {
    container.innerHTML = '';
  }
  container = null;
  statusDisplay = null;
}

function renderShell(): void {
  if (!container) {
    return;
  }
  container.innerHTML = '';

  const shell = document.createElement('div');
  shell.className = 'game-shell';

  const header = document.createElement('div');
  header.className = 'game-header';

  const title = document.createElement('div');
  title.className = 'game-team-tag admin-game-selector';

  const select = document.createElement('select');
  select.className = 'admin-game-select';
  select.innerHTML = `<option value="">None</option>` +
    availableGames.map(id =>
      `<option value="${id}" ${getAdminGameId() === id ? 'selected' : ''}>${id}</option>`
    ).join('');

  select.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    setAdminGameId(val ? parseInt(val, 10) : undefined);
    updateContent();
  });

  title.appendChild(select);

  statusDisplay = document.createElement('div');
  statusDisplay.className = 'game-time';

  header.appendChild(title);
  header.appendChild(statusDisplay);
  shell.appendChild(header);

  const tabContent = document.createElement('div');
  tabContent.className = 'game-tab-content';

  const panel = document.createElement('div');
  panel.className = 'game-tab-panel active';
  panel.id = 'adminTabPanel';

  tabContent.appendChild(panel);
  shell.appendChild(tabContent);

  const tabBar = document.createElement('div');
  tabBar.className = 'game-tab-bar';

  const createTab = (id: AdminTab, tabLabel: string, iconHtml: string) => {
    const btn = document.createElement('button');
    btn.className = `game-tab-btn ${activeTab === id ? 'active' : ''}`;
    btn.dataset.tabId = id;

    const svg = createSvgIcon(iconHtml);
    svg.classList.add('game-tab-icon');
    btn.appendChild(svg);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'game-tab-label';
    labelSpan.textContent = tabLabel;
    btn.appendChild(labelSpan);

    btn.addEventListener('click', () => {
      activeTab = id;
      tabBar.querySelectorAll('.game-tab-btn').forEach(t =>
        t.classList.toggle('active', (t as HTMLElement).dataset.tabId === activeTab)
      );
      updateContent();
    });
    return btn;
  };

  tabBar.appendChild(createTab(AdminTab.Controls, 'CONTROLS', '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-8h6m2 12h6"/>'));
  tabBar.appendChild(createTab(AdminTab.Submissions, 'SUBMISSIONS', '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'));
  tabBar.appendChild(createTab(AdminTab.Leaderboard, 'LEADERBOARD', '<path d="M18 20V10M12 20V4M6 20v-4"/>'));

  shell.appendChild(tabBar);
  container.appendChild(shell);
}

function updateContent(): void {
  const panel = document.getElementById('adminTabPanel');
  if (!panel) {
    return;
  }
  panel.innerHTML = '';

  if (activeTab === AdminTab.Submissions) {
    renderSubmissions(panel);
  } else if (activeTab === AdminTab.Leaderboard) {
    renderLeaderboard(panel);
  } else if (activeTab === AdminTab.Controls) {
    renderControls(panel);
  }

  if (statusDisplay) {
    const gameId = getAdminGameId();
    if (gameId) {
      const state = getGameState();
      const statusColor = state.status === 'running' ? 'var(--color-success)' : 'var(--color-danger)';
      statusDisplay.innerHTML = `<span style="font-weight: 800; color: ${statusColor}">${state.status.toUpperCase()}</span>`;
    } else {
      statusDisplay.innerHTML = '';
    }
  }
}

function renderSubmissions(content: HTMLElement): void {
  if (!getAdminGameId()) {
    return;
  }

  const pending = getPendingSubmissions();

  if (pending.length === 0) {
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'admin-submissions-wrapper';

  for (const sub of pending) {
    const challenge = getChallengeById(sub.challengeId);
    if (!challenge) {
      continue;
    }

    const card = document.createElement('div');
    card.className = 'review-card';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'review-card-header';

    const info = document.createElement('div');
    info.className = 'review-card-info';

    const teamData = getTeamData(sub.teamId);
    const teamName = teamData ? teamData.name : 'Unknown Team';
    const teamTag = teamData ? teamData.tag : 'UNK';

    const teamEl = document.createElement('div');
    teamEl.className = 'review-team-name';
    teamEl.textContent = `${teamName} (${teamTag})`;

    const challengeEl = document.createElement('div');
    challengeEl.className = 'review-challenge-name';
    challengeEl.textContent = challenge.title;

    info.appendChild(teamEl);
    info.appendChild(challengeEl);

    const pointsEl = document.createElement('div');
    pointsEl.className = 'review-points';
    pointsEl.textContent = `${challenge.points} pts`;

    cardHeader.appendChild(info);
    cardHeader.appendChild(pointsEl);
    card.appendChild(cardHeader);

    if (sub.value && (sub.value.startsWith('data:') || sub.value.startsWith('http'))) {
      const img = document.createElement('img');
      img.className = 'review-photo';
      img.src = sub.value;
      img.alt = `Submission by ${teamName}`;
      card.appendChild(img);
    }

    const actions = document.createElement('div');
    actions.className = 'review-actions';

    const approveBtn = document.createElement('button');
    approveBtn.className = 'review-approve-btn';
    approveBtn.textContent = 'Approve';
    approveBtn.addEventListener('click', () => {
      setSubmissionStatus(sub.id, SubmissionStatus.Approved);
      updateContent();
    });

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'review-reject-btn';
    rejectBtn.textContent = 'Reject';
    rejectBtn.addEventListener('click', () => {
      setSubmissionStatus(sub.id, SubmissionStatus.Rejected);
      updateContent();
    });

    actions.appendChild(approveBtn);
    actions.appendChild(rejectBtn);
    card.appendChild(actions);

    wrapper.appendChild(card);
  }

  content.appendChild(wrapper);
}

function renderLeaderboard(content: HTMLElement): void {
  if (!getAdminGameId()) {
    return;
  }

  const teams = getLeaderboard();

  if (teams.length === 0) {
    return;
  }

  const board = document.createElement('div');
  board.className = 'leaderboard';

  teams.forEach((team, index) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row';

    const rank = document.createElement('div');
    rank.className = 'leaderboard-rank';
    rank.textContent = `${index + 1}`;

    const teamInfo = document.createElement('div');
    teamInfo.className = 'leaderboard-team';

    const name = document.createElement('div');
    name.className = 'leaderboard-team-name';
    name.textContent = team.name;

    const tag = document.createElement('div');
    tag.className = 'leaderboard-team-tag';
    tag.textContent = team.tag;

    teamInfo.appendChild(name);
    teamInfo.appendChild(tag);

    const score = document.createElement('div');
    score.className = 'leaderboard-score';
    score.textContent = `${team.points} pts`;

    row.appendChild(rank);
    row.appendChild(teamInfo);
    row.appendChild(score);
    board.appendChild(row);
  });

  content.appendChild(board);
}

function renderControls(content: HTMLElement): void {
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

  const startBtn = document.createElement('button');
  startBtn.textContent = state.status === 'paused' ? 'Resume' : 'Start';
  startBtn.className = 'admin-btn-primary';
  startBtn.addEventListener('click', () => {
    const gameDuration = 120;
    if (state.status === GameStatus.Stopped) {
      state.duration = gameDuration * 60;
      state.timeRemainingSeconds = gameDuration * 60;
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