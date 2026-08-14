import type { ChallengeRenderer } from '../challenges';

export const renderUniqueChallenge3: ChallengeRenderer = (_challenge, _existingSubmission, _onSubmit) => {
  const container = document.createElement('div');
  container.className = 'challenge-submit-section';
  return container;
};
