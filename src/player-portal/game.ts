import {
  getChallenges,
  getTeamSession,
  getTeamPoints,
  getSubmissionForChallenge,
  getGameState,
  getAnnouncements,
  dismissAnnouncement,
  addSubmission,
  dataVersion,
  SubmissionStatus,
  GameStatus,
  type Challenge,
} from '../shared/store';
import { getRenderer } from './challenges';
import { renderMoreTab } from './more';
import { navigateTo, SangfroidView } from '../shared/router';
import { initGameMap, destroyGameMap } from './map';
import { createSvgIcon } from '../shared/svg';
import { formatTime } from '../shared/format';

export const GameTab = {
  Map: 'map',
  Challenges: 'challenges',
  More: 'more',
} as const;
export type GameTab = (typeof GameTab)[keyof typeof GameTab];

export const SortMode = {
  TitleAsc: 'title-asc',
  TitleDesc: 'title-desc',
  PointsAsc: 'points-asc',
  PointsDesc: 'points-desc',
  StatusUnsolved: 'status-unsolved',
  StatusSolved: 'status-solved',
} as const;
export type SortMode = (typeof SortMode)[keyof typeof SortMode];

export const TypeFilter = {
  All: 'all',
  Answer: 'answer',
  Photo: 'photo',
  Limited: 'limited',
} as const;
export type TypeFilter = (typeof TypeFilter)[keyof typeof TypeFilter];

let container: HTMLElement | null = null;
let activeTab: GameTab = GameTab.Challenges;
let panels: Record<GameTab, HTMLElement | null> = { map: null, challenges: null, more: null };
let tabButtons: Record<GameTab, HTMLElement | null> = { map: null, challenges: null, more: null };
let pointsDisplay: HTMLElement | null = null;
let timeDisplay: HTMLElement | null = null;

let clockInterval: number | undefined;
let dismissedAnnouncements: Set<number> = new Set();
let lastDataVersion = -1;
let activeChallengeId: number | undefined;
let activeChallengeStatus: string | undefined;

let currentSortMode: SortMode = SortMode.TitleAsc;
let currentTypeFilter: TypeFilter = TypeFilter.All;

export function mountGame(host: HTMLElement): void {
  container = host;
  activeTab = GameTab.Challenges;
  renderShell();
}

export function unmountGame(): void {
  destroyGameMap();
  if (container) {
    container.innerHTML = '';
  }
  container = null;
  panels = { map: null, challenges: null, more: null };
  tabButtons = { map: null, challenges: null, more: null };
  pointsDisplay = null;
  timeDisplay = null;

  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = undefined;
  }
}

function renderShell(): void {
  if (!container) {
    return;
  }
  container.innerHTML = '';

  const session = getTeamSession();
  if (!session) {
    navigateTo(SangfroidView.Landing);
    return;
  }

  const shell = document.createElement('div');
  shell.className = 'game-shell';

  const header = document.createElement('div');
  header.className = 'game-header';

  const teamTag = document.createElement('div');
  teamTag.className = 'game-team-tag';
  teamTag.textContent = session.tag;

  pointsDisplay = document.createElement('div');
  pointsDisplay.className = 'game-points';
  pointsDisplay.textContent = `${getTeamPoints(session.id)} pts`;

  timeDisplay = document.createElement('div');
  timeDisplay.className = 'game-time';
  timeDisplay.textContent = '--:--:--';

  header.appendChild(teamTag);
  header.appendChild(pointsDisplay);
  header.appendChild(timeDisplay);
  shell.appendChild(header);

  clockInterval = setInterval(() => {
    updateClock(session.gameId);
    pollAnnouncements(session.gameId);

    if (activeTab === GameTab.Challenges && dataVersion !== lastDataVersion) {
      lastDataVersion = dataVersion;
      refreshPointsDisplay();

      if (!panels.challenges?.querySelector('.challenge-detail')) {
        renderChallengeList();
      } else if (activeChallengeId !== undefined) {
        const currentSub = getSubmissionForChallenge(session.id, activeChallengeId);
        const currentStatus = currentSub?.status ?? null;
        if (currentStatus !== activeChallengeStatus) {
          const chall = getChallenges().find(c => c.id === activeChallengeId);
          if (chall) {
            renderChallengeDetail(chall);
          }
        }
      }
    }
  }, 1000);
  updateClock(session.gameId);
  pollAnnouncements(session.gameId);

  const tabContent = document.createElement('div');
  tabContent.className = 'game-tab-content';

  panels.map = document.createElement('div');
  panels.map.className = 'game-tab-panel';
  panels.map.dataset.tab = 'map';
  tabContent.appendChild(panels.map);

  panels.challenges = document.createElement('div');
  panels.challenges.className = 'game-tab-panel';
  panels.challenges.dataset.tab = 'challenges';
  tabContent.appendChild(panels.challenges);

  panels.more = document.createElement('div');
  panels.more.className = 'game-tab-panel';
  panels.more.dataset.tab = 'more';
  tabContent.appendChild(panels.more);

  shell.appendChild(tabContent);

  const tabBar = document.createElement('div');
  tabBar.className = 'game-tab-bar';

  tabButtons.map = createTabButton(GameTab.Map, 'Map', '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>');
  tabButtons.challenges = createTabButton(GameTab.Challenges, 'Challenges', '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>');
  tabButtons.more = createTabButton(GameTab.More, 'More', '<line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>');

  tabBar.appendChild(tabButtons.map);
  tabBar.appendChild(tabButtons.challenges);
  tabBar.appendChild(tabButtons.more);
  shell.appendChild(tabBar);

  container.appendChild(shell);
  switchTab(activeTab);
}

function createTabButton(tab: GameTab, label: string, iconHtml: string): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'game-tab-btn';
  btn.dataset.tab = tab;

  const icon = createSvgIcon(iconHtml);
  icon.classList.add('game-tab-icon');
  btn.appendChild(icon);

  const labelEl = document.createElement('span');
  labelEl.className = 'game-tab-label';
  labelEl.textContent = label;
  btn.appendChild(labelEl);

  btn.addEventListener('click', () => switchTab(tab));
  return btn;
}

function switchTab(tab: GameTab): void {
  activeTab = tab;

  for (const [key, btn] of Object.entries(tabButtons)) {
    btn?.classList.toggle('active', key === tab);
  }

  for (const [key, panel] of Object.entries(panels)) {
    panel?.classList.toggle('active', key === tab);
  }

  if (tab === GameTab.Map && panels.map && panels.map.children.length === 0) {
    renderMapTab();
  }
  if (tab === GameTab.Challenges) {
    renderChallengesTab();
  }
  if (tab === GameTab.More) {
    renderMoreTab(panels.more);
  }
}

function renderMapTab(): void {
  if (!panels.map) {
    return;
  }
  panels.map.innerHTML = '';

  const mapContainer = document.createElement('div');
  mapContainer.className = 'game-map-container';
  mapContainer.id = 'gameMapContainer';
  panels.map.appendChild(mapContainer);

  requestAnimationFrame(() => {
    initGameMap('gameMapContainer');
  });
}

function renderChallengesTab(): void {
  if (!panels.challenges) {
    return;
  }

  const session = getTeamSession();
  if (!session) {
    return;
  }

  if (panels.challenges.querySelector('.challenge-detail')) {
    return;
  }

  renderChallengeList();
}

function sortChallenges(challenges: Challenge[], teamId: number): Challenge[] {
  const sorted = [...challenges];

  switch (currentSortMode) {
    case SortMode.TitleAsc:
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case SortMode.TitleDesc:
      sorted.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case SortMode.PointsAsc:
      sorted.sort((a, b) => a.points - b.points);
      break;
    case SortMode.PointsDesc:
      sorted.sort((a, b) => b.points - a.points);
      break;
    case SortMode.StatusUnsolved:
    case SortMode.StatusSolved: {
      sorted.sort((a, b) => {
        const solvedA = getSubmissionForChallenge(teamId, a.id)?.status === SubmissionStatus.Approved ? 1 : 0;
        const solvedB = getSubmissionForChallenge(teamId, b.id)?.status === SubmissionStatus.Approved ? 1 : 0;
        if (solvedA !== solvedB) {
          return currentSortMode === SortMode.StatusUnsolved ? solvedA - solvedB : solvedB - solvedA;
        }
        return 0;
      });
      break;
    }
  }

  return sorted;
}

function renderChallengeList(): void {
  activeChallengeId = undefined;
  activeChallengeStatus = undefined;
  if (!panels.challenges) {
    return;
  }
  panels.challenges.innerHTML = '';

  const session = getTeamSession();
  if (!session) {
    return;
  }

  const filterRow = document.createElement('div');
  filterRow.className = 'challenge-filters';

  const typeSelect = document.createElement('select');
  typeSelect.className = 'challenge-filter-select';
  typeSelect.innerHTML = `
    <option value="all" ${currentTypeFilter === 'all' ? 'selected' : ''}>All Types</option>
    <option value="answer" ${currentTypeFilter === 'answer' ? 'selected' : ''}>Answer</option>
    <option value="photo" ${currentTypeFilter === 'photo' ? 'selected' : ''}>Photo</option>
    <option value="limited" ${currentTypeFilter === 'limited' ? 'selected' : ''}>Limited</option>
  `;
  typeSelect.addEventListener('change', (e) => {
    currentTypeFilter = (e.target as HTMLSelectElement).value as typeof currentTypeFilter;
    renderChallengeList();
  });

  const sortSelect = document.createElement('select');
  sortSelect.className = 'challenge-filter-select';
  sortSelect.innerHTML = `
    <option value="title-asc" ${currentSortMode === 'title-asc' ? 'selected' : ''}>Title: A to Z</option>
    <option value="title-desc" ${currentSortMode === 'title-desc' ? 'selected' : ''}>Title: Z to A</option>
    <option value="points-asc" ${currentSortMode === 'points-asc' ? 'selected' : ''}>Points: Low to High</option>
    <option value="points-desc" ${currentSortMode === 'points-desc' ? 'selected' : ''}>Points: High to Low</option>
    <option value="status-unsolved" ${currentSortMode === 'status-unsolved' ? 'selected' : ''}>Status: Unsolved First</option>
    <option value="status-solved" ${currentSortMode === 'status-solved' ? 'selected' : ''}>Status: Solved First</option>
  `;
  sortSelect.addEventListener('change', (e) => {
    currentSortMode = (e.target as HTMLSelectElement).value as typeof currentSortMode;
    renderChallengeList();
  });

  filterRow.appendChild(typeSelect);
  filterRow.appendChild(sortSelect);
  panels.challenges.appendChild(filterRow);

  const list = document.createElement('div');
  list.className = 'challenge-list';

  let challenges = [...getChallenges()];

  if (currentTypeFilter !== TypeFilter.All) {
    challenges = challenges.filter(c => c.type === currentTypeFilter);
  }

  challenges = sortChallenges(challenges, session.id);

  for (const challenge of challenges) {
    list.appendChild(buildChallengeCard(challenge, session.id));
  }

  panels.challenges.appendChild(list);
}

function buildChallengeCard(challenge: Challenge, teamId: number): HTMLElement {
  const submission = getSubmissionForChallenge(teamId, challenge.id);

  const card = document.createElement('div');
  card.className = 'challenge-card';

  if (submission?.status === SubmissionStatus.Approved) {
    card.classList.add('solved');
  } else if (submission?.status === SubmissionStatus.Pending) {
    card.classList.add('pending');
  } else if (submission?.status === SubmissionStatus.Rejected) {
    card.classList.add('rejected');
  }

  const body = document.createElement('div');
  body.className = 'challenge-card-body';

  const title = document.createElement('div');
  title.className = 'challenge-card-title';
  title.textContent = challenge.title;

  const desc = document.createElement('div');
  desc.className = 'challenge-card-desc';
  desc.textContent = challenge.description;

  body.appendChild(title);
  body.appendChild(desc);

  const meta = document.createElement('div');
  meta.className = 'challenge-card-meta';

  const pointsBadge = document.createElement('span');
  pointsBadge.className = 'challenge-points-badge';
  pointsBadge.textContent = `${challenge.points} pts`;

  const typeBadge = document.createElement('span');
  typeBadge.className = 'challenge-type-badge';
  typeBadge.dataset.type = challenge.type;
  typeBadge.textContent = challenge.type;

  meta.appendChild(pointsBadge);
  meta.appendChild(typeBadge);

  const statusBadge = document.createElement('span');
  statusBadge.className = 'challenge-status-badge';

  if (!submission) {
    statusBadge.dataset.status = 'unsolved';
    statusBadge.textContent = 'Unsolved';
  } else {
    if (submission.status === 'approved') {
      statusBadge.dataset.status = 'solved';
      if (challenge.type === 'photo') {
        statusBadge.textContent = 'Approved (Solved)';
      } else {
        statusBadge.textContent = 'Solved';
      }
    } else if (submission.status === 'pending') {
      statusBadge.dataset.status = 'pending';
      statusBadge.textContent = 'Under Review';
    } else if (submission.status === 'rejected') {
      if (challenge.type === 'photo') {
        statusBadge.dataset.status = 'rejected';
        statusBadge.textContent = 'Rejected (Unsolved)';
      } else {
        statusBadge.dataset.status = 'unsolved';
        statusBadge.textContent = 'Unsolved';
      }
    }
  }

  meta.appendChild(statusBadge);

  body.appendChild(meta);
  card.appendChild(body);

  const isLocked = submission?.status === 'approved' || submission?.status === 'pending';
  if (!isLocked) {
    card.addEventListener('click', () => {
      renderChallengeDetail(challenge);
    });
  }

  return card;
}

function renderChallengeDetail(challenge: Challenge): void {
  activeChallengeId = challenge.id;
  if (!panels.challenges) {
    return;
  }
  panels.challenges.innerHTML = '';

  const session = getTeamSession();
  if (!session) {
    return;
  }

  const detail = document.createElement('div');
  detail.className = 'challenge-detail';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'challenge-detail-close-btn';
  closeBtn.type = 'button';
  closeBtn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  closeBtn.addEventListener('click', () => renderChallengeList());
  detail.appendChild(closeBtn);

  const scrollArea = document.createElement('div');
  scrollArea.className = 'challenge-detail-scroll-area';

  const infoContainer = document.createElement('div');
  infoContainer.className = 'challenge-detail-info';

  const titleEl = document.createElement('h2');
  titleEl.className = 'challenge-detail-title';
  titleEl.textContent = challenge.title;
  infoContainer.appendChild(titleEl);

  const metaRow = document.createElement('div');
  metaRow.className = 'challenge-detail-meta-row';

  const pointsBadge = document.createElement('span');
  pointsBadge.className = 'challenge-points-badge';
  pointsBadge.textContent = `${challenge.points} pts`;
  metaRow.appendChild(pointsBadge);

  const typeBadge = document.createElement('span');
  typeBadge.className = 'challenge-type-badge';
  typeBadge.dataset.type = challenge.type;
  typeBadge.textContent = challenge.type;
  metaRow.appendChild(typeBadge);

  infoContainer.appendChild(metaRow);

  const descEl = document.createElement('p');
  descEl.className = 'challenge-detail-desc';
  descEl.textContent = challenge.description;
  infoContainer.appendChild(descEl);

  scrollArea.appendChild(infoContainer);
  detail.appendChild(scrollArea);

  const renderer = getRenderer(challenge.type);
  if (renderer) {
    const existingSub = getSubmissionForChallenge(session.id, challenge.id);
    activeChallengeStatus = existingSub?.status ?? undefined;

    const renderedEl = renderer(challenge, existingSub, (value: string) => {
      if (challenge.type === 'answer') {
        const isCorrect = challenge.answer
          ? value.trim().toLowerCase() === challenge.answer.toLowerCase()
          : false;
        addSubmission(challenge.id, session.id, value, isCorrect ? 'approved' : 'rejected');
        if (isCorrect) {
          refreshPointsDisplay();
        }
      } else if (challenge.type === 'photo') {
        addSubmission(challenge.id, session.id, value, 'pending');
      }
    });

    detail.appendChild(renderedEl);
  }

  panels.challenges.appendChild(detail);
}

function refreshPointsDisplay(): void {
  const session = getTeamSession();
  if (session && pointsDisplay) {
    pointsDisplay.textContent = `${getTeamPoints(session.id)} pts`;
  }
}

function updateClock(_gameId: number): void {
  if (!timeDisplay) {
    return;
  }
  const state = getGameState();

  if (state.status === GameStatus.Stopped) {
    timeDisplay.textContent = 'STOPPED';
    return;
  }

  let remaining = state.timeRemainingSeconds;

  if (state.status === GameStatus.Running) {
    const elapsed = Math.floor((Date.now() - state.lastTickTimestamp) / 1000);
    remaining = Math.max(0, remaining - elapsed);
  }

  timeDisplay.textContent = formatTime(remaining);
}

function pollAnnouncements(gameId: number): void {
  const announcements = getAnnouncements();
  for (const ann of announcements) {
    if (!dismissedAnnouncements.has(ann.id)) {
      showAnnouncement(gameId, ann);
      break;
    }
  }
}

function showAnnouncement(_gameId: number, ann: { id: number, message: string }): void {
  if (document.getElementById(`ann-${ann.id}`)) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'announcement-overlay';
  overlay.id = `ann-${ann.id}`;

  const popup = document.createElement('div');
  popup.className = 'announcement-popup';

  const msg = document.createElement('p');
  msg.textContent = ann.message;

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'announcement-dismiss-btn';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.addEventListener('click', () => {
    dismissedAnnouncements.add(ann.id);
    dismissAnnouncement(ann.id);
    overlay.remove();
  });

  popup.appendChild(msg);
  popup.appendChild(dismissBtn);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
}
