import { SubmissionStatus, type Challenge, type Submission } from '../../shared/store';
import type { SubmitCallback } from '../challenges';
import { shakeElement } from '../../shared/dom';

const COOLDOWN_MS = 60000;

export function renderInputChallenge(
  challenge: Challenge,
  existingSubmission: Submission | undefined,
  onSubmit: SubmitCallback,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'challenge-submit-section';

  const row = document.createElement('div');
  row.className = 'challenge-submit-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'challenge-text-input';
  input.placeholder = 'Enter answer...';

  const btn = document.createElement('button');
  btn.className = 'challenge-submit-btn';
  btn.type = 'button';
  btn.textContent = 'SUBMIT';

  row.appendChild(input);
  row.appendChild(btn);
  container.appendChild(row);

  const feedbackSlot = document.createElement('div');
  feedbackSlot.className = 'challenge-feedback-slot';
  container.insertBefore(feedbackSlot, row);

  if (existingSubmission?.status === SubmissionStatus.Approved) {
    const feedback = document.createElement('div');
    feedback.className = 'challenge-feedback correct';
    feedback.textContent = `Correct - +${challenge.points} pts`;
    feedbackSlot.appendChild(feedback);
    input.value = existingSubmission.value;
    input.disabled = true;
    btn.disabled = true;
  }

  if (existingSubmission?.status === SubmissionStatus.Rejected) {
    const elapsed = Date.now() - existingSubmission.timestamp;
    if (elapsed < COOLDOWN_MS) {
      const cooldownSecs = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      const feedback = document.createElement('div');
      feedback.className = 'challenge-feedback incorrect';
      feedback.textContent = `Incorrect - try again in ${cooldownSecs}s`;
      feedbackSlot.appendChild(feedback);

      const interval = setInterval(() => {
        const newElapsed = Date.now() - existingSubmission.timestamp;
        if (newElapsed >= COOLDOWN_MS) {
          clearInterval(interval);
          feedback.remove();
          input.disabled = false;
          btn.disabled = false;
          input.value = '';
        } else {
          feedback.textContent = `Incorrect - try again in ${Math.ceil((COOLDOWN_MS - newElapsed) / 1000)}s`;
        }
      }, 1000);

      input.value = existingSubmission.value;
      input.disabled = true;
      btn.disabled = true;
    }
  }

  function handleSubmit(): void {
    const value = input.value.trim();
    if (!value) {
      shakeElement(input);
      return;
    }

    btn.disabled = true;
    input.disabled = true;
    onSubmit(value);
  }

  btn.addEventListener('click', handleSubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  });

  return container;
}
