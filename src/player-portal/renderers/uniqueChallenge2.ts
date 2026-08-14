import type { ChallengeRenderer } from '../challenges';
import {
  SubmissionStatus, requestTeamUp, getTeamSession,
  getSubmissionForChallenge, updateSubmissionData
} from '../../shared/store';
import { renderPhotoChallenge } from './photoChallenge';
import { renderMatchmakingUI } from './challengeMatchmaking';
import { injectChat, buildFeedback } from './rendererUtils';

const isChoiceMade = (value: string) => value === 'split' || value === 'steal';

function buildChoiceUI(submissionId: number): HTMLElement {
  const ui = document.createElement('div');
  ui.className = 'split-steal-ui';

  const prompt = document.createElement('h3');
  prompt.className = 'split-steal-prompt';
  prompt.textContent = 'Split or Steal?';
  ui.appendChild(prompt);

  const info = document.createElement('p');
  info.className = 'split-steal-info';
  info.innerHTML = 'If both split, you share points.<br>If one steals, they get all points.<br>If both steal, no one gets points.';
  ui.appendChild(info);

  const btnRow = document.createElement('div');
  btnRow.className = 'split-steal-btn-row';

  const splitBtn = document.createElement('button');
  splitBtn.className = 'challenge-submit-btn split-btn';
  splitBtn.textContent = 'SPLIT';

  const stealBtn = document.createElement('button');
  stealBtn.className = 'challenge-submit-btn steal-btn';
  stealBtn.textContent = 'STEAL';

  const handleChoice = async (choice: 'split' | 'steal') => {
    splitBtn.disabled = true;
    stealBtn.disabled = true;
    await updateSubmissionData(submissionId, choice, SubmissionStatus.Approved);
  };

  splitBtn.addEventListener('click', () => handleChoice('split'));
  stealBtn.addEventListener('click', () => handleChoice('steal'));

  btnRow.appendChild(splitBtn);
  btnRow.appendChild(stealBtn);
  ui.appendChild(btnRow);

  return ui;
}

function buildOutcomeFeedback(myChoice: string, partnerChoice: string | undefined, points: number): HTMLElement {
  if (!partnerChoice || !isChoiceMade(partnerChoice)) {
    return buildFeedback('submitted', `You chose to ${myChoice.toUpperCase()}. Waiting for the other team.`);
  }

  if (myChoice === 'split' && partnerChoice === 'split') {
    return buildFeedback('correct', `Both split! +${Math.floor(points / 2)} pts`);
  }
  if (myChoice === 'steal' && partnerChoice === 'split') {
    return buildFeedback('correct', `You stole! +${points} pts`);
  }
  if (myChoice === 'split' && partnerChoice === 'steal') {
    return buildFeedback('incorrect', 'They stole! +0 pts');
  }
  return buildFeedback('incorrect', 'Both stole! +0 pts');
}

export const renderUniqueChallenge2: ChallengeRenderer = (challenge, existingSubmission, onSubmit) => {
  const container = document.createElement('div');
  container.className = 'challenge-submit-section';

  const session = getTeamSession();
  if (!session) {
    return container;
  }

  if (!existingSubmission) {
    const requestBtn = document.createElement('button');
    requestBtn.id = 'requestTeamUpBtn';
    requestBtn.className = 'challenge-submit-btn';
    requestBtn.textContent = 'Start Matchmaking';
    requestBtn.addEventListener('click', async () => {
      requestBtn.disabled = true;
      await requestTeamUp(challenge.id, session.id);
    });
    container.appendChild(requestBtn);
    return container;
  }

  const isGuest = !!existingSubmission.hostTeamId;
  const hostSub = isGuest
    ? getSubmissionForChallenge(existingSubmission.hostTeamId!, challenge.id)
    : existingSubmission;
  const guestSub = !isGuest
    ? getSubmissionForChallenge(existingSubmission.guestTeamIds[0], challenge.id)
    : existingSubmission;

  if (existingSubmission.status === SubmissionStatus.MatchmakingRequest) {
    container.appendChild(renderMatchmakingUI(challenge, existingSubmission, false));
    injectChat(container, existingSubmission.id, challenge, existingSubmission, false);
    return container;
  }

  if (existingSubmission.status === SubmissionStatus.MatchmakingAccepted && !isGuest) {
    const photoUI = renderPhotoChallenge(challenge, existingSubmission, onSubmit);
    photoUI.classList.remove('challenge-submit-section');
    container.appendChild(photoUI);
    injectChat(container, existingSubmission.id, challenge, existingSubmission, false);
    return container;
  }

  if (existingSubmission.status === SubmissionStatus.MatchmakingAccepted && isGuest) {
    if (hostSub && hostSub.status === SubmissionStatus.MatchmakingRequest) {
      container.appendChild(renderMatchmakingUI(challenge, hostSub, true));
    } else if (challenge.allowEveryoneToSubmit) {
      const photoUI = renderPhotoChallenge(challenge, existingSubmission, onSubmit);
      photoUI.classList.remove('challenge-submit-section');
      container.appendChild(photoUI);
    } else if (!hostSub || hostSub.status === SubmissionStatus.MatchmakingAccepted) {
      container.appendChild(buildFeedback('submitted', 'Waiting for the host to submit their photo'));
    } else if (hostSub.status === SubmissionStatus.Pending) {
      container.appendChild(buildFeedback('submitted', 'Host submitted the photo'));
    } else if (hostSub.status === SubmissionStatus.Rejected) {
      container.appendChild(buildFeedback('incorrect', 'Host photo was rejected'));
    } else if (hostSub.status === SubmissionStatus.Approved) {
      container.appendChild(buildChoiceUI(existingSubmission.id));
    }
    injectChat(container, hostSub?.id, challenge, hostSub, true);
    return container;
  }

  if (existingSubmission.status === SubmissionStatus.Pending || existingSubmission.status === SubmissionStatus.Rejected) {
    const photoUI = renderPhotoChallenge(challenge, existingSubmission, onSubmit);
    photoUI.classList.remove('challenge-submit-section');
    container.appendChild(photoUI);

    const chatSubId = isGuest ? hostSub?.id : existingSubmission.id;
    const chatSub = isGuest ? hostSub : existingSubmission;
    injectChat(container, chatSubId, challenge, chatSub, isGuest);

    return container;
  }

  if (existingSubmission.status === SubmissionStatus.Approved) {
    const partnerSub = isGuest ? hostSub : guestSub;
    const myChoice = existingSubmission.value;

    if (!isChoiceMade(myChoice)) {
      if (challenge.allowEveryoneToSubmit && partnerSub?.status !== SubmissionStatus.Approved) {
        container.appendChild(buildFeedback('submitted', "Waiting for the other team."));
      } else {
        container.appendChild(buildChoiceUI(existingSubmission.id));
      }
    } else {
      const partnerChoice = partnerSub?.value;
      container.appendChild(buildOutcomeFeedback(myChoice, partnerChoice, challenge.points));
    }

    const chatSubId = isGuest ? hostSub?.id : existingSubmission.id;
    const chatSub = isGuest ? hostSub : existingSubmission;
    injectChat(container, chatSubId, challenge, chatSub, isGuest);
    return container;
  }

  return container;
};
