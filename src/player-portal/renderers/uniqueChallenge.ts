import type { ChallengeRenderer } from '../challenges';

export const renderUniqueChallenge: ChallengeRenderer = (challenge, existingSubmission, onSubmit) => {
  const container = document.createElement('div');
  container.className = 'challenge-unique-container';
  return container;
};
