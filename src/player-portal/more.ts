import { getTeamSession, logoutTeam, getLeaderboard } from '../shared/store';
import { navigateTo, SangfroidView } from '../shared/router';
import { fetchTeamPlayers } from '../shared/supabase';
import { createSvgIcon } from '../shared/svg';
import { marked } from 'marked';
import rulesMd from '../../rules.md?raw';

export function renderMoreTab(container: HTMLElement | null): void {
  if (!container) return;
  container.innerHTML = '';

  const session = getTeamSession();
  if (!session) {
    navigateTo(SangfroidView.Landing);
    return;
  }

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

  const rulesBtn = createMenuItem(
    'Rules',
    '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>',
    () => renderRules(container)
  );

  const yourTeamBtn = createMenuItem(
    'Your Team',
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    () => renderYourTeam(container)
  );

  const logoutBtn = createMenuItem(
    'Log Out',
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>',
    () => {
      logoutTeam();
      navigateTo(SangfroidView.Landing);
    }
  );

  const leaderboard = getLeaderboard();
  const myPoints = leaderboard.find(t => t.id === session.id)?.points ?? 0;
  const teamsAhead = leaderboard.filter(t => t.points > myPoints);
  const actualRank = 1 + teamsAhead.length;

  const rankingSection = document.createElement('div');
  rankingSection.className = 'more-ranking-section';

  const rankTitle = document.createElement('div');
  rankTitle.className = 'more-rank-title';
  rankTitle.textContent = `Ranking #${actualRank}`;

  const rankSub = document.createElement('div');
  rankSub.className = 'more-rank-sub';

  if (actualRank === 1) {
    rankSub.textContent = "You're ahead of everyone else!";
  } else {
    const nextBestTeam = [...teamsAhead].sort((a, b) => a.points - b.points)[0];
    if (nextBestTeam) {
      rankSub.textContent = `${nextBestTeam.points - myPoints}pts behind ${nextBestTeam.name}`;
    }
  }

  rankingSection.appendChild(rankTitle);
  rankingSection.appendChild(rankSub);

  menuList.appendChild(rankingSection);
  menuList.appendChild(rulesBtn);
  menuList.appendChild(yourTeamBtn);
  menuList.appendChild(logoutBtn);
  wrapper.appendChild(menuList);

  const logo = document.createElement('img');
  logo.src = '/sangfroid.png';
  logo.className = 'more-logo';
  wrapper.appendChild(logo);

  container.appendChild(wrapper);
}

function renderYourTeam(container: HTMLElement): void {
  container.innerHTML = '';

  const session = getTeamSession();
  if (!session) return;

  const teamContainer = document.createElement('div');
  teamContainer.className = 'your-team-container more-team-container';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'challenge-detail-close-btn';
  closeBtn.type = 'button';
  closeBtn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  closeBtn.addEventListener('click', () => renderMoreTab(container));
  teamContainer.appendChild(closeBtn);

  const teamNameHeader = document.createElement('h3');
  teamNameHeader.className = 'more-team-header';
  teamNameHeader.style.marginBottom = '0';
  teamNameHeader.textContent = session.name || 'Your Team';
  teamContainer.appendChild(teamNameHeader);

  const createdDate = document.createElement('div');
  createdDate.style.color = 'var(--color-text-muted)';
  createdDate.style.fontSize = '0.9rem';
  createdDate.style.marginBottom = '1.5rem';
  const dateObj = new Date(session.timestamp);
  createdDate.textContent = `Created on ${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  teamContainer.appendChild(createdDate);

  container.appendChild(teamContainer);

  fetchTeamPlayers(session.id).then(players => {

    let leader = players.find(p => p.is_leader);
    let teammates = players.filter(p => !p.is_leader);

    if (!leader && players.length > 0) {
      leader = players[0];
      teammates = players.slice(1);
    }

    const createSlot = (title: string, name: string | null, isLeader: boolean) => {
      const slot = document.createElement('div');
      slot.className = 'more-team-slot';

      const titleEl = document.createElement('div');
      titleEl.className = 'more-team-slot-title';
      titleEl.textContent = title;
      slot.appendChild(titleEl);

      const nameRow = document.createElement('div');
      nameRow.className = 'more-team-slot-name-row';

      const nameEl = document.createElement('h4');
      nameEl.className = 'more-team-slot-name';
      nameEl.textContent = name || 'Empty Slot';
      nameRow.appendChild(nameEl);

      if (isLeader && name) {
        const crown = createSvgIcon('<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"></path><path d="M3 22h18"></path>');
        crown.classList.add('more-team-leader-crown');
        nameRow.appendChild(crown);
      }

      slot.appendChild(nameRow);
      return slot;
    };

    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'more-team-slots-container';

    slotsContainer.appendChild(createSlot('Leader', leader?.name || null, true));
    slotsContainer.appendChild(createSlot('Player', teammates[0]?.name || null, false));
    slotsContainer.appendChild(createSlot('Player', teammates[1]?.name || null, false));

    teamContainer.appendChild(slotsContainer);

    const footerText = document.createElement('div');
    footerText.className = 'more-team-footer-text';
    footerText.textContent = 'To make changes to your team (e.g. removing a player), message John.';
    teamContainer.appendChild(footerText);
  }).catch(err => {
    const loadingErrorText = document.createElement('div');
    loadingErrorText.textContent = 'Error loading team data.';
    teamContainer.appendChild(loadingErrorText);
    console.error(err);
  });
}

async function renderRules(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  const rulesContainer = document.createElement('div');
  rulesContainer.className = 'rules-container more-rules-container';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'challenge-detail-close-btn';
  closeBtn.type = 'button';
  closeBtn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  closeBtn.addEventListener('click', () => renderMoreTab(container));
  rulesContainer.appendChild(closeBtn);

  const contentArea = document.createElement('div');
  contentArea.className = 'rules-content more-rules-content';

  contentArea.innerHTML = await marked.parse(rulesMd);
  rulesContainer.appendChild(contentArea);

  container.appendChild(rulesContainer);
}
