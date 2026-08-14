import { getAdminGameId, getLeaderboard, logoutAdmin } from '../shared/store';
import { navigateTo, SangfroidView } from '../shared/router';
import { createSvgIcon } from '../shared/svg';

let currentView: (container: HTMLElement) => void = renderMenu;

export function renderMoreTab(container: HTMLElement | null): void {
  if (!container) {
    return;
  }
  currentView(container);
}

function renderMenu(container: HTMLElement): void {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'more-menu-wrapper';

  const menuList = document.createElement('div');
  menuList.className = 'more-menu-list';

  const createMenuItem = (label: string, iconHtml: string, onClick: () => void) => {
    const item = document.createElement('div');
    item.className = 'more-menu-item';
    item.addEventListener('click', onClick);

    const icon = createSvgIcon(iconHtml);
    icon.classList.add('more-menu-icon');

    const text = document.createElement('div');
    text.className = 'more-menu-text';
    text.textContent = label;

    item.appendChild(icon);
    item.appendChild(text);
    return item;
  };

  const leaderboardBtn = createMenuItem(
    'Leaderboard',
    '<path d="M18 20V10M12 20V4M6 20v-4"/>',
    () => {
      currentView = renderLeaderboard;
      currentView(container);
    }
  );

  const logoutBtn = createMenuItem(
    'Log Out',
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>',
    () => {
      logoutAdmin();
      navigateTo(SangfroidView.Landing);
    }
  );

  menuList.appendChild(leaderboardBtn);
  menuList.appendChild(logoutBtn);
  wrapper.appendChild(menuList);

  const logo = document.createElement('img');
  logo.src = '/sangfroid.png';
  logo.className = 'more-logo';
  wrapper.appendChild(logo);

  container.appendChild(wrapper);
}

function renderLeaderboard(container: HTMLElement): void {
  container.innerHTML = '';

  const leaderboardContainer = document.createElement('div');
  leaderboardContainer.className = 'more-subpage-container';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'challenge-detail-close-btn';
  closeBtn.type = 'button';
  closeBtn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  closeBtn.addEventListener('click', () => {
    currentView = renderMenu;
    currentView(container);
  });
  leaderboardContainer.appendChild(closeBtn);

  if (!getAdminGameId()) {
    container.appendChild(leaderboardContainer);
    return;
  }

  const teams = getLeaderboard();

  if (teams.length === 0) {
    container.appendChild(leaderboardContainer);
    return;
  }

  const board = document.createElement('div');
  board.className = 'leaderboard leaderboard-board';

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

  leaderboardContainer.appendChild(board);
  container.appendChild(leaderboardContainer);
}
