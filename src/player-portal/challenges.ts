import type { Challenge, ChallengeType, Submission } from '../shared/store';

export type SubmitCallback = (value: string, hostTeamId?: number) => void;
export type ChallengeRenderer = (
  challenge: Challenge,
  existingSubmission: Submission | undefined,
  onSubmit: SubmitCallback,
) => HTMLElement;

const rendererRegistry = new Map<ChallengeType, ChallengeRenderer>();

export function registerRenderer(type: ChallengeType, renderer: ChallengeRenderer): void {
  rendererRegistry.set(type, renderer);
}

export function getRenderer(type: ChallengeType): ChallengeRenderer | undefined {
  return rendererRegistry.get(type);
}
