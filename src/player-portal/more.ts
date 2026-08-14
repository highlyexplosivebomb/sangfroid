import { getTeamSession, logoutTeam, getLeaderboard, getAnnouncements, getMatchmakingRequests, hasDismissedAnnouncement, markAnnouncementDismissed, isMatchmakingDeclined, declineMatchmakingRequest, acceptTeamUp, getTeamData, getChallenges, getSubmissionForChallenge, SubmissionStatus, getActiveChatSubmissions, getUnreadCountForChat, markChatAsRead } from '../shared/store';
import { navigateTo, SangfroidView } from '../shared/router';
import { fetchTeamPlayers } from '../shared/supabase';
import { createSvgIcon } from '../shared/svg';
import { openChallengeChat } from './renderers/challengeChat';
import { marked } from 'marked';
import rulesMd from '../../rules.md?raw';

export function renderMoreTab(container: HTMLElement | null): void {
  if (!container) {
    return;
  }
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

  const messagesBtn = createMenuItem(
    'Messages',
    '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline>',
    () => renderMessages(container)
  );
  messagesBtn.id = 'moreTabMessagesBtn';

  const unreadAnnouncements = getAnnouncements().filter(a => !hasDismissedAnnouncement(a.id));
  const otherTeamRequests = getMatchmakingRequests().filter(r =>
    r.teamId !== session.id &&
    !isMatchmakingDeclined(r.id) &&
    r.status === 'matchmaking_request' &&
    !getSubmissionForChallenge(session.id, r.challengeId)
  );
  const unreadChats = getActiveChatSubmissions().reduce((sum, sub) => sum + getUnreadCountForChat(sub.id), 0);
  const totalMessages = unreadAnnouncements.length + otherTeamRequests.length + unreadChats;
  if (totalMessages > 0) {
    const textEl = messagesBtn.querySelector('.more-menu-text');
    if (textEl) {
      textEl.textContent = `Messages (${totalMessages})`;
    }
  }

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
  menuList.appendChild(messagesBtn);
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
  if (!session) {
    return;
  }

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
  createdDate.className = 'more-team-footer-text';
  createdDate.style.marginBottom = '1.5rem';
  createdDate.style.marginTop = '0.5rem';
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

export function renderMessages(container: HTMLElement): void {
  container.innerHTML = '';

  const session = getTeamSession();
  if (!session) {
    return;
  }

  const announcements = getAnnouncements();
  const requests = getMatchmakingRequests().filter(r => r.teamId !== session.id);
  const activeChats = getActiveChatSubmissions();

  const escapeHtmlMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escapeHtml = (str: string) => str.replace(/[&<>"']/g, m => escapeHtmlMap[m]);

  const items: Array<{ type: 'announcement' | 'request' | 'chat'; data: any; timestamp: number }> = [
    ...announcements.map(ann => ({ type: 'announcement' as const, data: ann, timestamp: ann.timestamp })),
    ...requests.map(req => ({ type: 'request' as const, data: req, timestamp: req.timestamp })),
    ...activeChats.map(sub => ({ type: 'chat' as const, data: sub, timestamp: sub.timestamp })),
  ];

  items.sort((a, b) => b.timestamp - a.timestamp);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const messagesHtml = items.map(item => {
    if (item.type === 'announcement') {
      const ann = item.data;
      const isDismissed = hasDismissedAnnouncement(ann.id);
      const actionsHtml = isDismissed
        ? `<div class="message-status-dismissed">DISMISSED</div>`
        : `<button id="dismissBtn_${ann.id}" class="challenge-submit-btn">DISMISS</button>`;
      return `
        <div class="more-team-slot message-item">
          <div class="message-item-header">
            <div class="more-team-slot-title">Announcement</div>
            <div class="message-item-time">${formatTime(ann.timestamp)}</div>
          </div>
          <div class="message-item-body">
            <h4 class="more-team-slot-name">${escapeHtml(ann.message)}</h4>
          </div>
          ${actionsHtml}
        </div>
      `;
    } else if (item.type === 'request') {
      const req = item.data;
      const challenge = getChallenges().find(c => c.id === req.challengeId);
      const teamData = getTeamData(req.teamId);
      const teamName = teamData ? teamData.name : 'Another team';
      const challengeTitle = challenge?.title || 'the Unique challenge';
      const existingSub = getSubmissionForChallenge(session.id, req.challengeId);
      const hasAccepted = existingSub && existingSub.status === 'matchmaking_accepted';
      const hasDeclined = isMatchmakingDeclined(req.id);
      let actionsHtml = '';
      if (hasAccepted) {
        actionsHtml = `<div class="message-status-accepted">ACCEPTED</div>`;
      } else if (hasDeclined) {
        actionsHtml = `<div class="message-status-declined">DECLINED</div>`;
      } else {
        actionsHtml = `
          <div class="message-action-row">
            <button id="acceptBtn_${req.id}" class="challenge-submit-btn split-btn">ACCEPT</button>
            <button id="declineBtn_${req.id}" class="challenge-submit-btn steal-btn">DECLINE</button>
          </div>
        `;
      }
      return `
        <div class="more-team-slot message-item">
          <div class="message-item-header">
            <div class="more-team-slot-title">Matchmaking Request</div>
            <div class="message-item-time">${formatTime(req.timestamp)}</div>
          </div>
          <div class="message-item-body">
            <h4 class="more-team-slot-name">${escapeHtml(challengeTitle)}</h4>
          </div>
          <div class="message-item-meta">Initiated By: ${escapeHtml(teamName)}</div>
          <div id="req_info_${req.id}" class="message-item-meta">Loading participants...</div>
          ${actionsHtml}
        </div>
      `;
    } else if (item.type === 'chat') {
      const sub = item.data;
      const challenge = getChallenges().find(c => c.id === sub.challengeId);
      const unreadCount = getUnreadCountForChat(sub.id);
      const titleWithUnread = escapeHtml(challenge?.title || 'Challenge') + (unreadCount > 0 ? ` (${unreadCount})` : '');
      return `
        <button id="openChatBtn_${sub.id}" class="challenge-submit-btn message-chat-btn">
          <div class="message-chat-title">${titleWithUnread}</div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.7;">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
      `;
    }
  }).join('');

  container.innerHTML = `
    <div id="messagesContainer" class="messages-container more-messages-container">
      <button id="closeMessagesBtn" class="challenge-detail-close-btn" type="button" style="z-index: 100;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div style="padding-top: 48px;">
        ${items.length === 0 ? '<div id="messagesEmpty" class="messages-empty">You have no new messages.</div>' : ''}
        ${messagesHtml}
      </div>
    </div>
  `;

  document.getElementById('closeMessagesBtn')?.addEventListener('click', () => renderMoreTab(container));

  announcements.forEach(ann => {
    container.querySelector(`#dismissBtn_${ann.id}`)?.addEventListener('click', () => {
      markAnnouncementDismissed(ann.id);
      renderMessages(container);
    });
  });

  requests.forEach(async req => {
    const challenge = getChallenges().find(c => c.id === req.challengeId);

    container.querySelector(`#acceptBtn_${req.id}`)?.addEventListener('click', async () => {
      const existingSub = getSubmissionForChallenge(session.id, req.challengeId);
      if (existingSub && existingSub.status === SubmissionStatus.MatchmakingRequest) {
        alert('Please cancel your existing matchmaking request for this challenge before accepting another.');
        return;
      }
      await acceptTeamUp(req, session.id);
      renderMessages(container);
    });

    container.querySelector(`#declineBtn_${req.id}`)?.addEventListener('click', () => {
      declineMatchmakingRequest(req.id);
      renderMessages(container);
    });

    const infoEl = container.querySelector(`#req_info_${req.id}`);
    if (infoEl && challenge) {
      const type = challenge.matchmakingLimitType || 'teams';
      const limit = challenge.matchmakingLimit || 2;
      const guestTeamIds = req.guestTeamIds || [];

      let count = 0;
      if (type === 'teams') {
        count = 1 + guestTeamIds.length;
        infoEl.textContent = `Joined Teams: ${count}/${limit}`;
      } else {
        const hostPlayers = await fetchTeamPlayers(req.teamId);
        let players = hostPlayers.length;
        for (const gid of guestTeamIds) {
          const guestPlayers = await fetchTeamPlayers(gid);
          players += guestPlayers.length;
        }
        infoEl.textContent = `Joined Players: ${players}/${limit}`;
      }
    }
  });

  activeChats.forEach(sub => {
    container.querySelector(`#openChatBtn_${sub.id}`)?.addEventListener('click', () => {
      const challenge = getChallenges().find(c => c.id === sub.challengeId);
      if (challenge) {
        markChatAsRead(sub.id);
        renderMessages(container);
        openChallengeChat(challenge, sub);
      }
    });
  });
}
