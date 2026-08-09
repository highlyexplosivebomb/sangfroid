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
