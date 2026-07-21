export type LottiePlayer = Element & { play(): void; stop(): void };

export function getRequiredElement<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) {
    throw new Error(`Required element missing: ${selector}`);
  }

  return el;
}

export function shakeElement(el: Element | null): void {
  if (!el) {
    return;
  }

  el.classList.remove('error');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('error');
}

export function getActiveSubmitBtn(form: HTMLFormElement): HTMLButtonElement | null {
  return form.querySelector<HTMLButtonElement>(
    '.signup-stage:not([hidden]) button[type="submit"]'
  );
}

export function getActiveInvalidInputs(form: HTMLFormElement): NodeListOf<HTMLInputElement> {
  return form.querySelectorAll<HTMLInputElement>(
    '.signup-stage:not([hidden]) input:invalid'
  );
}

export function showSubmissionOverlay(
  submissionOverlay: HTMLElement,
  savingAnim: LottiePlayer,
  successAnim: LottiePlayer,
  teamTagDisplay: HTMLElement
): void {
  submissionOverlay.classList.add('visible');
  savingAnim.classList.remove('hidden', 'fly-away');
  savingAnim.play();
  successAnim.stop();
  successAnim.classList.add('hidden');
  teamTagDisplay.classList.add('hidden');
}

export async function transitionToSuccess(
  savingAnim: LottiePlayer,
  successAnim: LottiePlayer
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  savingAnim.classList.add('hidden');
  successAnim.classList.remove('hidden');
  successAnim.play();
}

export function handleSubmissionError(
  form: HTMLFormElement,
  submissionOverlay: HTMLElement,
  submitBtn: HTMLButtonElement | null
): void {
  shakeElement(form.querySelector<HTMLInputElement>('.signup-stage:not([hidden]) input'));
  if (submitBtn) {
    submitBtn.disabled = false;
  }
  submissionOverlay.classList.remove('visible');
}
