import {
  getChallenges,
  getTeamSession,
  getTeamPoints,
  getSubmissionForChallenge,
  getGameState,
  getAnnouncements,
  addSubmission,
  updateSubmissionData,
  dataVersion,
  SubmissionStatus,
  getCurrentPhase,
  GamePhase,
  GameStatus,
  type Challenge,
  getMatchmakingRequests,
  isMatchmakingDeclined,
  hasDismissedAnnouncement,
  getUnreadChatMessagesCount,
  type Submission,
} from '../shared/store';
import { getRenderer } from './challenges';
import { renderMoreTab, renderMessages } from './more';
import { navigateTo, SangfroidView } from '../shared/router';
import { initGameMap, destroyGameMap } from './map';
import { createSvgIcon } from '../shared/svg';
import { startClock } from '../shared/clock';

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
  Unique: 'unique',
} as const;
export type TypeFilter = (typeof TypeFilter)[keyof typeof TypeFilter];

let container: HTMLElement | null = null;
let activeTab: GameTab = GameTab.Challenges;
let panels: Record<GameTab, HTMLElement | null> = { map: null, challenges: null, more: null };
let tabButtons: Record<GameTab, HTMLElement | null> = { map: null, challenges: null, more: null };
let pointsDisplay: HTMLElement | null = null;
let timeDisplay: HTMLElement | null = null;

let gameLoopInterval: number | undefined;
let stopClock: (() => void) | undefined;
let lastDataVersion = -1;
let activeChallengeId: number | undefined;
let activeChallengeData: string | undefined;

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

  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = undefined;
  }
  if (stopClock) {
    stopClock();
    stopClock = undefined;
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

  const tabContent = document.createElement('div');
  tabContent.className = 'game-tab-content';

  let lastPhase = getCurrentPhase();

  if (timeDisplay) {
    stopClock = startClock(timeDisplay, false);
  }

  gameLoopInterval = setInterval(() => {
    pollMessagesBanner(tabContent, session.id);

    const currentPhase = getCurrentPhase();
    const phaseChanged = currentPhase !== lastPhase;
    lastPhase = currentPhase;

    if (dataVersion !== lastDataVersion || phaseChanged) {
      lastDataVersion = dataVersion;
      refreshPointsDisplay();

      if (activeTab === GameTab.Challenges) {
        if (phaseChanged || !panels.challenges?.querySelector('.challenge-detail')) {
          renderChallengeList();
        } else if (activeChallengeId !== undefined) {
          const currentSub = getSubmissionForChallenge(session.id, activeChallengeId);
          let partnerSub: Submission;
          if (currentSub?.hostTeamId) {
            partnerSub = getSubmissionForChallenge(currentSub.hostTeamId, activeChallengeId);
          } else if (currentSub?.guestTeamIds?.length) {
            partnerSub = getSubmissionForChallenge(currentSub.guestTeamIds[0], activeChallengeId);
          }
          const currentData = JSON.stringify({ existingSub: currentSub, partnerSub });
          if (currentData !== activeChallengeData) {
            const chall = getChallenges().find(c => c.id === activeChallengeId);
            if (chall) {
              renderChallengeDetail(chall);
            }
          }
        }
      } else if (activeTab === GameTab.More && panels.more) {
        renderMoreTab(panels.more);
      }
    }
  }, 1000);
  pollMessagesBanner(tabContent, session.id);

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

  const banner = document.getElementById('messagesBanner');
  if (banner) {
    banner.style.display = (tab === GameTab.More) ? 'none' : 'block';
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
  activeChallengeData = undefined;
  if (!panels.challenges) {
    return;
  }
  panels.challenges.innerHTML = '';

  const currentPhase = getCurrentPhase();
  if (currentPhase === GamePhase.Stopped) {
    panels.challenges.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </div>
        <h3>Game Not Started</h3>
        <p>Challenges are locked.</p>
      </div>
    `;
    return;
  }

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
    <option value="unique" ${currentTypeFilter === 'unique' ? 'selected' : ''}>Unique</option>
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

  if (currentPhase !== GamePhase.Final) {
    panels.challenges.appendChild(filterRow);
  }

  const list = document.createElement('div');
  list.className = 'challenge-list';

  let challenges = [...getChallenges()];

  if (currentPhase === GamePhase.Final) {
    const finalChall = challenges.find(c => c.type === 'final');
    if (finalChall) {
      renderChallengeDetail(finalChall);
      return;
    }
  }

  challenges = challenges.filter(c => c.type !== 'final');

  if (currentTypeFilter !== TypeFilter.All) {
    challenges = challenges.filter(c => {
      const displayType = c.type.startsWith('unique') ? 'unique' : c.type;
      return displayType === currentTypeFilter;
    });
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

  const currentPhase = getCurrentPhase();
  if (currentPhase === GamePhase.Stopped || currentPhase === GamePhase.Pregame || currentPhase === GamePhase.Ended || getGameState()?.status === GameStatus.Paused) {
    card.classList.add('read-only');
  }

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
  desc.textContent = challenge.description.replace(/\\n/g, '\n');

  body.appendChild(title);
  body.appendChild(desc);

  const meta = document.createElement('div');
  meta.className = 'challenge-card-meta';

  const pointsBadge = document.createElement('span');
  pointsBadge.className = 'challenge-points-badge';
  pointsBadge.textContent = `${challenge.points} pts`;

  const typeBadge = document.createElement('span');
  typeBadge.className = 'challenge-type-badge';
  const displayType = challenge.type.startsWith('unique') ? 'unique' : challenge.type;
  typeBadge.dataset.type = displayType;
  typeBadge.textContent = displayType;

  meta.appendChild(pointsBadge);
  meta.appendChild(typeBadge);

  const statusBadge = document.createElement('span');
  statusBadge.className = 'challenge-status-badge';

  if (!submission || submission.status === 'matchmaking_request' || submission.status === 'matchmaking_accepted' || submission.status === 'pending_choice') {
    statusBadge.dataset.status = 'unsolved';
    statusBadge.textContent = 'Unsolved';
  } else {
    if (submission.status === 'approved') {
      statusBadge.dataset.status = 'solved';
      if (challenge.type === 'photo' || challenge.type.startsWith('unique')) {
        statusBadge.textContent = 'Approved (Solved)';
      } else {
        statusBadge.textContent = 'Solved';
      }
    } else if (submission.status === 'pending') {
      statusBadge.dataset.status = 'pending';
      statusBadge.textContent = 'Under Review';
    } else if (submission.status === 'rejected') {
      if (challenge.type === 'photo' || challenge.type.startsWith('unique')) {
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

  card.addEventListener('click', () => {
    renderChallengeDetail(challenge);
  });

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

  const currentPhase = getCurrentPhase();
  const isFinalChallenge = challenge.type === 'final' && currentPhase === GamePhase.Final;

  if (isFinalChallenge) {
    detail.classList.add('final-challenge-cli');
  } else {
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
  }

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
  const displayType = challenge.type.startsWith('unique') ? 'unique' : challenge.type;
  typeBadge.dataset.type = displayType;
  typeBadge.textContent = displayType;
  metaRow.appendChild(typeBadge);

  infoContainer.appendChild(metaRow);

  const descEl = document.createElement('p');
  descEl.className = 'challenge-detail-desc';
  descEl.textContent = challenge.description.replace(/\\n/g, '\n');
  infoContainer.appendChild(descEl);

  scrollArea.appendChild(infoContainer);
  detail.appendChild(scrollArea);

  const renderer = getRenderer(challenge.type);
  if (renderer) {
    const existingSub = getSubmissionForChallenge(session.id, challenge.id);

    let partnerSub: Submission;
    if (existingSub?.hostTeamId) {
      partnerSub = getSubmissionForChallenge(existingSub.hostTeamId, challenge.id);
    } else if (existingSub?.guestTeamIds?.length) {
      partnerSub = getSubmissionForChallenge(existingSub.guestTeamIds[0], challenge.id);
    }
    activeChallengeData = JSON.stringify({ existingSub, partnerSub });

    const renderedEl = renderer(challenge, existingSub, (value: string, hostTeamId?: number) => {
      const handleSubmission = (status: SubmissionStatus) => {
        if (existingSub) {
          updateSubmissionData(existingSub.id, value, status);
        } else {
          addSubmission(challenge.id, session.id, value, status, hostTeamId);
        }
      };

      if (challenge.type === 'answer' || challenge.type === 'final') {
        const isCorrect = challenge.answer
          ? value.trim().toLowerCase() === challenge.answer.toLowerCase()
          : false;
        handleSubmission(isCorrect ? SubmissionStatus.Approved : SubmissionStatus.Rejected);
        if (isCorrect) {
          refreshPointsDisplay();
        }
      } else if (challenge.type === 'photo') {
        handleSubmission(SubmissionStatus.Pending);
      } else {
        handleSubmission(SubmissionStatus.Pending);
      }
    });

    detail.appendChild(renderedEl);

    const currentPhase = getCurrentPhase();
    if (currentPhase === GamePhase.Stopped || currentPhase === GamePhase.Pregame || currentPhase === GamePhase.Ended || getGameState()?.status === GameStatus.Paused) {
      const inputs = renderedEl.querySelectorAll('input, button, textarea');
      inputs.forEach(el => {
        (el as HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement).disabled = true;
      });
      const zones = renderedEl.querySelectorAll<HTMLElement>('.photo-upload-zone');
      zones.forEach(el => el.classList.add('disabled-zone'));
    }
  }

  panels.challenges.appendChild(detail);
}

function refreshPointsDisplay(): void {
  const session = getTeamSession();
  if (session && pointsDisplay) {
    pointsDisplay.textContent = `${getTeamPoints(session.id)} pts`;
  }
}


function pollMessagesBanner(container: HTMLElement, currentTeamId: number): void {
  const currentPhase = getCurrentPhase();

  if (currentPhase === GamePhase.Pregame || getGameState()?.status === GameStatus.Paused) {
    delete container.dataset.messageCount;
    const existing = document.getElementById('messagesBanner');
    if (existing && !existing.classList.contains('pregame-banner')) {
      existing.remove();
    }

    const bannerText = currentPhase === GamePhase.Pregame
      ? 'PRE-GAME: Challenges are read-only.'
      : 'PAUSED: Challenges are read-only. Check messages for updates.';

    const currentBanner = document.getElementById('messagesBanner');
    if (!currentBanner) {
      const bannerHtml = `
        <div id="messagesBanner" class="pregame-banner" style="display: ${activeTab === GameTab.More ? 'none' : 'block'};">
          <div class="pregame-banner-text">
            ${bannerText}
          </div>
        </div>
      `;
      container.insertAdjacentHTML('beforebegin', bannerHtml);
    } else {
      const textEl = currentBanner.querySelector('.pregame-banner-text');
      if (textEl && textEl.textContent !== bannerText) {
        textEl.textContent = bannerText;
      }
    }
    return;
  }

  const requests = getMatchmakingRequests();
  const otherTeamRequests = requests.filter(r => {
    if (r.teamId === currentTeamId) {
      return false;
    }
    if (isMatchmakingDeclined(r.id)) {
      return false;
    }
    if (r.status !== 'matchmaking_request') {
      return false;
    }
    const existingSub = getSubmissionForChallenge(currentTeamId, r.challengeId);
    if (existingSub) {
      return false;
    }
    return true;
  });

  const announcements = getAnnouncements();
  const unreadAnnouncements = announcements.filter(a => !hasDismissedAnnouncement(a.id));

  const unreadChatsCount = getUnreadChatMessagesCount();

  const totalMessages = otherTeamRequests.length + unreadAnnouncements.length + unreadChatsCount;

  if (totalMessages === 0) {
    const existing = document.getElementById('messagesBanner');
    if (existing) {
      existing.remove();
    }
    delete container.dataset.messageCount;

    const subBtnText = document.querySelector('#moreTabMessagesBtn .more-menu-text');
    if (subBtnText) {
      subBtnText.textContent = 'Messages';
    }
    return;
  }

  const subBtnText = document.querySelector('#moreTabMessagesBtn .more-menu-text');
  if (subBtnText) {
    subBtnText.textContent = `Messages (${totalMessages})`;
  }

  if (container.dataset.messageCount === String(totalMessages)) {
    return; // Already showing this count
  }

  const existing = document.getElementById('messagesBanner');
  if (existing) {
    existing.remove();
  }

  container.dataset.messageCount = String(totalMessages);

  let detailsHtml = '';
  if (unreadAnnouncements.length > 0) {
    detailsHtml += `<div>- ${unreadAnnouncements.length}x admin message${unreadAnnouncements.length > 1 ? 's' : ''}</div>`;
  }
  if (otherTeamRequests.length > 0) {
    detailsHtml += `<div>- ${otherTeamRequests.length}x matchmaking request${otherTeamRequests.length > 1 ? 's' : ''}</div>`;
  }
  if (unreadChatsCount > 0) {
    detailsHtml += `<div>- ${unreadChatsCount}x new chat message${unreadChatsCount > 1 ? 's' : ''}</div>`;
  }

  const bannerHtml = `
    <div id="messagesBanner" class="matchmaking-banner messages-banner" style="display: ${activeTab === GameTab.More ? 'none' : 'block'};">
      <div id="messagesBannerText" class="matchmaking-banner-text messages-banner-text">
        You have ${totalMessages} new message${totalMessages > 1 ? 's' : ''}:
        <div class="messages-banner-details">
          ${detailsHtml}
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforebegin', bannerHtml);

  const banner = document.getElementById('messagesBanner');
  if (banner) {
    banner.addEventListener('click', () => {
      switchTab(GameTab.More);
      const morePanel = panels.more;
      if (morePanel) {
        renderMessages(morePanel);
      }
    });
  }
}
