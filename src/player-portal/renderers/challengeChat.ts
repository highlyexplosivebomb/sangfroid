import {
  getTeamSession, getTeamData, cachedChallengeMessages,
  loadChallengeMessages, sendChallengeMessage, dataVersion,
  getUnreadCountForChat, markChatAsRead
} from '../../shared/store';

import { fetchTeamPlayers } from '../../shared/supabase';
import type { Challenge, Submission } from '../../shared/store';
import { SubmissionStatus } from '../../shared/store';

interface ChatModal {
  overlay: HTMLElement;
  modal: HTMLElement;
  messagesBox: HTMLElement;
  input: HTMLInputElement;
  sendBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
}

function buildChatModal(): ChatModal {
  const overlay = document.createElement('div');
  overlay.className = 'challenge-chat-overlay';

  const modal = document.createElement('div');
  modal.className = 'challenge-chat-modal';

  const header = document.createElement('div');
  header.className = 'challenge-chat-header';

  const heading = document.createElement('h3');
  heading.textContent = 'Team Chat';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.className = 'challenge-submit-btn chat-close-btn';

  header.appendChild(heading);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const messagesBox = document.createElement('div');
  messagesBox.className = 'challenge-chat-messages';
  modal.appendChild(messagesBox);

  const inputRow = document.createElement('div');
  inputRow.className = 'challenge-chat-input-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type a message...';
  input.className = 'form-input challenge-chat-input';

  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send';
  sendBtn.className = 'challenge-submit-btn challenge-chat-send-btn';

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  modal.appendChild(inputRow);

  overlay.appendChild(modal);

  return { overlay, modal, messagesBox, input, sendBtn, closeBtn };
}

function renderChatMessages(
  messagesBox: HTMLElement,
  submissionId: number,
  currentTeamId: number | undefined
): void {
  const messages = cachedChallengeMessages.filter(m => m.submissionId === submissionId);
  messagesBox.innerHTML = '';

  for (const msg of messages) {
    const isMe = currentTeamId !== undefined && msg.teamId === currentTeamId;
    const teamData = getTeamData(msg.teamId);
    const teamName = teamData ? teamData.name : 'Unknown Team';

    const msgEl = document.createElement('div');
    msgEl.className = `chat-message-wrapper ${isMe ? 'is-me' : 'is-them'}`;

    const time = new Date(msg.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const authorEl = document.createElement('span');
    authorEl.className = 'chat-message-author';
    authorEl.textContent = isMe ? time : `${teamName} • ${time}`;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isMe ? 'is-me' : 'is-them'}`;
    bubble.textContent = msg.message;

    msgEl.appendChild(authorEl);
    msgEl.appendChild(bubble);
    messagesBox.appendChild(msgEl);
  }

  messagesBox.scrollTop = messagesBox.scrollHeight;
}

function bindSendHandler(
  input: HTMLInputElement,
  sendBtn: HTMLButtonElement,
  challenge: Challenge,
  submission: Submission
): void {
  const handleSend = async () => {
    const val = input.value.trim();
    if (!val) {
      return;
    }
    input.value = '';
    sendBtn.disabled = true;
    await sendChallengeMessage(challenge.id, submission.id, val);
    sendBtn.disabled = false;
  };

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  });
}

export function createTeamControls(challenge: Challenge, submission: Submission, isGuest: boolean): HTMLElement {
  const container = document.createElement('div');
  container.className = 'team-controls-container';

  const infoBtn = document.createElement('button');
  infoBtn.className = 'icon-btn info-btn';
  infoBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  container.appendChild(infoBtn);

  const infoOverlay = document.createElement('div');
  infoOverlay.className = 'challenge-chat-overlay';
  const infoModal = document.createElement('div');
  infoModal.className = 'challenge-chat-modal';
  const infoHeader = document.createElement('div');
  infoHeader.className = 'challenge-chat-header';
  const infoHeading = document.createElement('h3');
  infoHeading.textContent = 'Team Information';
  const infoCloseBtn = document.createElement('button');
  infoCloseBtn.textContent = 'Close';
  infoCloseBtn.className = 'challenge-submit-btn chat-close-btn';

  infoHeader.appendChild(infoHeading);
  infoHeader.appendChild(infoCloseBtn);
  infoModal.appendChild(infoHeader);

  const infoContent = document.createElement('div');
  infoContent.className = 'info-content';
  infoModal.appendChild(infoContent);
  infoOverlay.appendChild(infoModal);
  document.body.appendChild(infoOverlay);

  infoCloseBtn.addEventListener('click', () => infoOverlay.classList.remove('active'));
  infoOverlay.addEventListener('click', (e) => {
    if (e.target === infoOverlay) {
      infoOverlay.classList.remove('active');
    }
  });

  infoBtn.addEventListener('click', async () => {
    infoOverlay.classList.add('active');
    infoContent.innerHTML = '<p>Loading...</p>';

    let hostName = 'Unknown';
    let hostCount = 0;
    const hostPlayers = await fetchTeamPlayers(submission.teamId);
    hostCount = hostPlayers.length;
    const hostTeamData = getTeamData(submission.teamId);
    if (hostTeamData) {
      hostName = hostTeamData.name;
    }

    const guestInfos: { name: string; count: number }[] = [];
    for (const gid of submission.guestTeamIds) {
      const p = await fetchTeamPlayers(gid);
      const tData = getTeamData(gid);
      guestInfos.push({ name: tData?.name || 'Unknown', count: p.length });
    }

    let html = isGuest
      ? `<p>The host of this group is <strong>${hostName}</strong>. They are in charge of submitting.</p>`
      : `<p>You are the host for this group. You are in charge of submitting.</p>`;

    if (challenge.allowEveryoneToSubmit) {
      html += `<p class="info-submit-permission">Everyone in this group can submit.</p>`;
    }

    html += `<ul class="info-team-list">`;
    html += `<li>${hostName} (Players: ${hostCount})</li>`;
    for (const gi of guestInfos) {
      html += `<li>${gi.name} (Players: ${gi.count})</li>`;
    }
    html += `</ul>`;

    infoContent.innerHTML = html;
  });

  const chatBtn = document.createElement('button');
  chatBtn.className = 'icon-btn chat-btn';
  chatBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

  const dot = document.createElement('div');
  dot.className = 'challenge-chat-dot';
  chatBtn.appendChild(dot);
  container.appendChild(chatBtn);

  const { overlay, messagesBox, input, sendBtn, closeBtn } = buildChatModal();
  document.body.appendChild(overlay);

  if (submission.status === SubmissionStatus.Approved) {
    input.disabled = true;
    sendBtn.disabled = true;
    input.placeholder = 'Challenge completed';
  }

  const currentTeam = getTeamSession();
  let lastRenderedVersion = -1;

  const refreshMessages = () => {
    if (lastRenderedVersion === dataVersion) {
      return;
    }
    lastRenderedVersion = dataVersion;

    if (!overlay.classList.contains('active')) {
      const unreadCount = getUnreadCountForChat(submission.id);
      if (unreadCount > 0) {
        dot.classList.add('active');
      }
    } else {
      markChatAsRead(submission.id);
    }

    renderChatMessages(messagesBox, submission.id, currentTeam?.id);
  };

  chatBtn.addEventListener('click', () => {
    overlay.classList.add('active');
    dot.classList.remove('active');
    markChatAsRead(submission.id);
    messagesBox.scrollTop = messagesBox.scrollHeight;
  });

  closeBtn.addEventListener('click', () => overlay.classList.remove('active'));

  bindSendHandler(input, sendBtn, challenge, submission);

  loadChallengeMessages(submission.id).then(() => {
    if (!overlay.classList.contains('active')) {
      const unreadCount = getUnreadCountForChat(submission.id);
      if (unreadCount > 0) {
        dot.classList.add('active');
      }
    } else {
      markChatAsRead(submission.id);
    }
  }).catch(console.error);

  const interval = setInterval(refreshMessages, 500);
  refreshMessages();

  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      clearInterval(interval);
      observer.disconnect();
      if (document.body.contains(overlay)) {
        overlay.remove();
      }
      if (document.body.contains(infoOverlay)) {
        infoOverlay.remove();
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return container;
}

export function openChallengeChat(challenge: Challenge, submission: Submission): void {
  const currentTeam = getTeamSession();
  const { overlay, messagesBox, input, sendBtn, closeBtn } = buildChatModal();
  overlay.classList.add('active');
  document.body.appendChild(overlay);

  if (submission.status === SubmissionStatus.Approved) {
    input.disabled = true;
    sendBtn.disabled = true;
    input.placeholder = 'Challenge completed';
  }

  let lastRenderedVersion = -1;

  const refreshMessages = () => {
    if (lastRenderedVersion === dataVersion) {
      return;
    }
    lastRenderedVersion = dataVersion;
    renderChatMessages(messagesBox, submission.id, currentTeam?.id);
  };

  const destroy = () => {
    clearInterval(interval);
    if (document.body.contains(overlay)) {
      overlay.remove();
    }
  };

  closeBtn.addEventListener('click', destroy);

  const handleSend = async () => {
    const val = input.value.trim();
    if (!val) {
      return;
    }
    input.value = '';
    sendBtn.disabled = true;
    await sendChallengeMessage(challenge.id, submission.id, val);
    sendBtn.disabled = false;
    input.focus();
  };

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  });

  loadChallengeMessages(submission.id).catch(console.error);

  const interval = setInterval(refreshMessages, 500);
  refreshMessages();
}
