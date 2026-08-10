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

  const menuList = document.createElement('div');
  menuList.className = 'more-menu-list';
  menuList.style.display = 'flex';
  menuList.style.flexDirection = 'column';

  const createMenuItem = (label: string, iconHtml: string, onClick: () => void) => {
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '1rem';
    item.style.padding = '0.8rem 1.5rem';
    item.style.cursor = 'pointer';
    item.style.fontSize = '1.3rem';
    item.style.fontWeight = 'bold';
    item.style.borderBottom = '1px solid var(--color-panel-border)';
    item.addEventListener('click', onClick);

    const icon = createSvgIcon(iconHtml);
    icon.style.width = '24px';
    icon.style.height = '24px';
    icon.style.color = 'var(--text-muted)';

    const text = document.createElement('div');
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
  rankingSection.style.margin = '0';
  rankingSection.style.padding = '1.5rem 1.5rem 1rem 1.5rem';
  rankingSection.style.borderBottom = '1px solid var(--color-panel-border)';
  rankingSection.style.display = 'flex';
  rankingSection.style.flexDirection = 'column';
  rankingSection.style.alignItems = 'flex-start';
  rankingSection.style.gap = '0.25rem';

  const rankTitle = document.createElement('div');
  rankTitle.textContent = `Ranking #${actualRank}`;
  rankTitle.style.fontFamily = 'var(--font-family-accent)';
  rankTitle.style.fontSize = '2.2rem';
  rankTitle.style.fontWeight = '700';
  rankTitle.style.textTransform = 'uppercase';
  rankTitle.style.letterSpacing = '1px';
  rankTitle.style.color = 'var(--color-text)';

  const rankSub = document.createElement('div');
  rankSub.style.fontSize = '0.9rem';
  rankSub.style.color = 'var(--color-text-muted)';
  rankSub.style.textAlign = 'left';

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
  container.appendChild(menuList);
}

function renderYourTeam(container: HTMLElement): void {
  container.innerHTML = '';

  const session = getTeamSession();
  if (!session) return;

  const teamContainer = document.createElement('div');
  teamContainer.className = 'your-team-container';
  teamContainer.style.padding = '3rem 1.25rem 1.25rem 1.25rem';
  teamContainer.style.display = 'flex';
  teamContainer.style.flexDirection = 'column';
  teamContainer.style.position = 'relative';

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
  teamNameHeader.textContent = session.name || 'Your Team';
  teamNameHeader.style.margin = '0 0 1rem 0';
  teamNameHeader.style.padding = '0';
  teamNameHeader.style.fontSize = '2rem';
  teamNameHeader.style.fontFamily = 'var(--font-family-accent)';
  teamNameHeader.style.textTransform = 'uppercase';
  teamNameHeader.style.letterSpacing = '1px';
  teamContainer.appendChild(teamNameHeader);

  const loadingText = document.createElement('div');
  loadingText.textContent = 'Loading team members...';
  teamContainer.appendChild(loadingText);

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
      slot.style.display = 'flex';
      slot.style.flexDirection = 'column';
      slot.style.padding = '1rem 1.25rem';
      slot.style.background = 'rgba(255, 255, 255, 0.5)';
      slot.style.border = '2px solid var(--color-panel-border)';
      slot.style.borderRadius = '10px';

      const titleEl = document.createElement('div');
      titleEl.textContent = title;
      titleEl.style.fontSize = '0.8rem';
      titleEl.style.color = 'var(--color-text-muted)';
      titleEl.style.textTransform = 'uppercase';
      titleEl.style.letterSpacing = '1px';
      titleEl.style.marginBottom = '0.25rem';
      titleEl.style.fontFamily = 'var(--font-family-accent)';
      slot.appendChild(titleEl);

      const nameRow = document.createElement('div');
      nameRow.style.display = 'flex';
      nameRow.style.alignItems = 'center';
      nameRow.style.justifyContent = 'space-between';

      const nameEl = document.createElement('div');
      nameEl.textContent = name || 'Empty Slot';
      nameEl.style.fontSize = '1.2rem';
      nameEl.style.fontWeight = name ? '700' : '500';
      nameEl.style.color = name ? 'var(--color-text)' : 'var(--color-text-muted)';
      nameRow.appendChild(nameEl);

      if (isLeader && name) {
        const crown = createSvgIcon('<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"></path><path d="M3 22h18"></path>');
        crown.style.width = '20px';
        crown.style.height = '20px';
        crown.style.color = '#eab308'; // yellow-500
        nameRow.appendChild(crown);
      }

      slot.appendChild(nameRow);
      return slot;
    };

    const slotsContainer = document.createElement('div');
    slotsContainer.style.display = 'flex';
    slotsContainer.style.flexDirection = 'column';
    slotsContainer.style.gap = '0.75rem';

    slotsContainer.appendChild(createSlot('Team Leader', leader?.name || null, true));
    slotsContainer.appendChild(createSlot('Teammate', teammates[0]?.name || null, false));
    slotsContainer.appendChild(createSlot('Teammate', teammates[1]?.name || null, false));

    teamContainer.appendChild(slotsContainer);
  }).catch(err => {
    loadingText.textContent = 'Error loading team data.';
    console.error(err);
  });
}

async function renderRules(container: HTMLElement): Promise<void> {
  container.innerHTML = '';

  const rulesContainer = document.createElement('div');
  rulesContainer.className = 'rules-container';
  rulesContainer.style.padding = '3rem 1.25rem 1.25rem 1.25rem';
  rulesContainer.style.display = 'flex';
  rulesContainer.style.flexDirection = 'column';
  rulesContainer.style.height = '100%';
  rulesContainer.style.position = 'relative';

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
  contentArea.className = 'rules-content';
  contentArea.style.overflowY = 'auto';
  contentArea.style.flex = '1';

  contentArea.innerHTML = await marked.parse(rulesMd);
  rulesContainer.appendChild(contentArea);

  container.appendChild(rulesContainer);
}
