import type { Challenge, Submission } from '../../shared/store';
import { fetchTeamPlayers } from '../../shared/supabase';
import { cancelMatchmakingRequest, startMatchmakingChallenge } from '../../shared/store';

async function updateParticipantStatus(
  challenge: Challenge,
  hostSubmission: Submission,
  statusText: HTMLParagraphElement,
  subText: HTMLParagraphElement,
  isGuest: boolean,
  startBtn?: HTMLButtonElement
): Promise<void> {
  const type = challenge.matchmakingLimitType || 'teams';
  const limit = challenge.matchmakingLimit || 2;
  const guestTeamIds = hostSubmission.guestTeamIds;

  if (type === 'teams') {
    const count = 1 + guestTeamIds.length;
    const remaining = limit - count;
    statusText.textContent = `${count}/${limit} teams joined.`;

    if (isGuest) {
      subText.textContent = remaining > 0
        ? `waiting for ${remaining} more teams to join.`
        : 'Waiting for host team to start challenge...';
    } else {
      if (remaining > 0) {
        subText.textContent = `waiting for ${remaining} more teams to join.`;
        if (startBtn) {
          startBtn.style.display = 'none';
        }
      } else {
        subText.textContent = 'Capacity reached.';
        if (startBtn) {
          startBtn.style.display = 'block';
        }
      }
    }
  } else {
    if (!isGuest && startBtn) {
      startBtn.style.display = 'block';
    }

    try {
      const hostPlayers = await fetchTeamPlayers(hostSubmission.teamId);
      let players = hostPlayers.length;
      for (const gid of guestTeamIds) {
        const guestPlayers = await fetchTeamPlayers(gid);
        players += guestPlayers.length;
      }
      statusText.textContent = `${players}/${limit} players joined.`;
    } catch {
      statusText.textContent = `?/${limit} players joined.`;
    }

    subText.textContent = isGuest
      ? 'Waiting for host team to start challenge...'
      : 'you can start the challenge now, or wait for more players!';
  }
}

export function renderMatchmakingUI(
  challenge: Challenge,
  hostSubmission: Submission,
  isGuest: boolean
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.id = 'matchmakingWrapper';

  const lottie = document.createElement('lottie-player');
  lottie.id = 'matchmakingLottie';
  lottie.setAttribute('src', 'https://lottie.host/67bcaadc-1d58-4673-9c61-0afbf856771b/3sAvnPhd5n.json');
  lottie.setAttribute('background', 'transparent');
  lottie.setAttribute('speed', '1');
  lottie.setAttribute('loop', '');
  lottie.setAttribute('autoplay', '');
  wrapper.appendChild(lottie);

  const textContainer = document.createElement('div');
  textContainer.className = 'matchmaking-text-container';

  const statusText = document.createElement('p');
  statusText.className = 'waiting-status-text waiting-text';
  statusText.textContent = 'Loading participants...';

  const subText = document.createElement('p');
  subText.className = 'waiting-sub-text waiting-text';

  textContainer.appendChild(statusText);
  textContainer.appendChild(subText);
  wrapper.appendChild(textContainer);

  lottie.addEventListener('ready', () => textContainer.classList.add('ready'));
  setTimeout(() => textContainer.classList.add('ready'), 1000);

  if (!isGuest) {
    const actionsRow = document.createElement('div');
    actionsRow.className = 'matchmaking-actions-row';

    const startBtn = document.createElement('button');
    startBtn.className = 'start-btn challenge-submit-btn btn-success';
    startBtn.style.display = 'none';
    startBtn.textContent = 'Start';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-btn challenge-submit-btn btn-danger';
    cancelBtn.textContent = 'Cancel';

    cancelBtn.addEventListener('click', async () => {
      cancelBtn.disabled = true;
      await cancelMatchmakingRequest(hostSubmission.id);
    });

    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      await startMatchmakingChallenge(hostSubmission.id);
    });

    actionsRow.appendChild(startBtn);
    actionsRow.appendChild(cancelBtn);
    wrapper.appendChild(actionsRow);

    updateParticipantStatus(challenge, hostSubmission, statusText, subText, false, startBtn);
  } else {
    updateParticipantStatus(challenge, hostSubmission, statusText, subText, true);
  }

  return wrapper;
}
