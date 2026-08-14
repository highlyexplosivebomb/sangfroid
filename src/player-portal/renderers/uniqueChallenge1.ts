import type { ChallengeRenderer } from '../challenges';
import { SubmissionStatus, requestTeamUp, getTeamSession, getSubmissionForChallenge } from '../../shared/store';
import { renderPhotoChallenge } from './photoChallenge';
import { renderMatchmakingUI } from './challengeMatchmaking';
import { injectChat } from './rendererUtils';

export const renderUniqueChallenge1: ChallengeRenderer = (challenge, existingSubmission, onSubmit) => {
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
    requestBtn.textContent = 'Request Team-Up';
    requestBtn.addEventListener('click', async () => {
      requestBtn.disabled = true;
      await requestTeamUp(challenge.id, session.id);
    });
    container.appendChild(requestBtn);
    return container;
  }

  if (existingSubmission.status === SubmissionStatus.MatchmakingRequest) {
    container.appendChild(renderMatchmakingUI(challenge, existingSubmission, false));
    injectChat(container, existingSubmission.id, challenge, existingSubmission, false);
    return container;
  }

  if (existingSubmission.status === SubmissionStatus.MatchmakingAccepted) {
    const hostTeamId = existingSubmission.hostTeamId;

    if (existingSubmission.guestTeamIds.length > 0) {
      const photoUI = renderPhotoChallenge(challenge, existingSubmission, onSubmit);
      photoUI.classList.remove('challenge-submit-section');
      container.appendChild(photoUI);
      injectChat(container, existingSubmission.id, challenge, existingSubmission, false);
      return container;
    }

    if (hostTeamId) {
      const hostSub = getSubmissionForChallenge(hostTeamId, challenge.id);
      if (hostSub && hostSub.status === SubmissionStatus.MatchmakingRequest) {
        container.appendChild(renderMatchmakingUI(challenge, hostSub, true));
      } else if (challenge.allowEveryoneToSubmit) {
        const photoUI = renderPhotoChallenge(challenge, existingSubmission, (photoUrl) => {
          onSubmit(photoUrl, hostTeamId);
        });
        photoUI.classList.remove('challenge-submit-section');
        container.appendChild(photoUI);
      }
      injectChat(container, hostSub?.id, challenge, hostSub, true);
      return container;
    }
  }

  const isGuest = !!existingSubmission.hostTeamId;

  if (isGuest && !challenge.allowEveryoneToSubmit) {
    const feedbackSlot = document.createElement('div');
    feedbackSlot.className = 'photo-feedback-slot';
    
    const text = document.createElement('div');
    if (existingSubmission.status === SubmissionStatus.Pending) {
      text.className = 'challenge-feedback submitted';
      text.textContent = 'Submitted - under review. This may take a few mins.';
    } else if (existingSubmission.status === SubmissionStatus.Approved) {
      text.className = 'challenge-feedback correct';
      text.textContent = `Submission approved - +${challenge.points} pts`;
    } else if (existingSubmission.status === SubmissionStatus.Rejected) {
      text.className = 'challenge-feedback incorrect';
      text.textContent = 'Submission rejected - try again';
    }
    feedbackSlot.appendChild(text);
    container.appendChild(feedbackSlot);
  } else {
    const photoUI = renderPhotoChallenge(challenge, existingSubmission, onSubmit);
    photoUI.classList.remove('challenge-submit-section');
    container.appendChild(photoUI);
  }

  let submissionId = existingSubmission.id;
  let referenceSub = existingSubmission;
  if (isGuest) {
    const hostSub = getSubmissionForChallenge(existingSubmission.hostTeamId!, challenge.id);
    if (hostSub) {
      submissionId = hostSub.id;
      referenceSub = hostSub;
    }
  }
  injectChat(container, submissionId, challenge, referenceSub, isGuest);

  return container;
};
