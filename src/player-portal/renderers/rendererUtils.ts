import type { Challenge, Submission } from '../../shared/store';
import { createTeamControls } from './challengeChat';

export function buildFeedback(className: string, text: string): HTMLElement {
  const slot = document.createElement('div');
  slot.className = 'photo-feedback-slot';
  const el = document.createElement('div');
  el.className = `challenge-feedback ${className}`;
  el.textContent = text;
  slot.appendChild(el);
  return slot;
}

export function injectChat(
  container: HTMLElement,
  submissionId: number | undefined,
  challenge: Challenge,
  submission: Submission | undefined,
  isGuest: boolean
): void {
  if (!submissionId || !submission) {
    return;
  }

  const teamControls = createTeamControls(challenge, submission, isGuest);
  const submitBtn = container.querySelector('.photo-submit-btn');
  const mmActions = container.querySelector('.matchmaking-actions-row');

  if (mmActions) {
    teamControls.style.flex = '0 0 auto';
    mmActions.prepend(teamControls);
  } else if (submitBtn && submitBtn.parentElement) {
    const actionsRow = document.createElement('div');
    actionsRow.className = 'matchmaking-actions-row';
    actionsRow.style.marginTop = '16px';
    submitBtn.replaceWith(actionsRow);
    teamControls.style.flex = '1';
    (submitBtn as HTMLElement).style.flex = '1';
    actionsRow.appendChild(teamControls);
    actionsRow.appendChild(submitBtn);
  } else {
    teamControls.style.width = '100%';
    container.appendChild(teamControls);
  }
}
