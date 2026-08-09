export const SangfroidView = {
  Landing: 'landing',
  PlayerPortal: 'player-portal',
  AdminPortal: 'admin-portal',
} as const;
export type SangfroidView = (typeof SangfroidView)[keyof typeof SangfroidView];

type MountFn = () => void;
type UnmountFn = () => void;

interface ViewEntry {
  mount: MountFn;
  unmount: UnmountFn;
}

const views = new Map<SangfroidView, ViewEntry>();
let activeView: SangfroidView | undefined;

export function registerView(name: SangfroidView, mount: MountFn, unmount: UnmountFn): void {
  views.set(name, { mount, unmount });
}

export function navigateTo(name: SangfroidView): void {
  if (activeView === name) {
    return;
  }

  if (activeView) {
    const prev = views.get(activeView);
    prev?.unmount();
  }

  activeView = name;
  const next = views.get(name);
  if (!next) {
    throw new Error(`View not registered: ${name}`);
  }
  next.mount();

  const path = name === SangfroidView.Landing ? '/' : `/${name}`;
  if (window.location.pathname !== path) {
    history.pushState({ view: name }, '', path);
  }
}

export function getCurrentView(): SangfroidView | undefined {
  return activeView;
}

export function getViewFromPath(): SangfroidView {
  const path = window.location.pathname.slice(1);
  if (views.has(path as SangfroidView)) {
    return path as SangfroidView;
  }
  return SangfroidView.Landing;
}

window.addEventListener('popstate', (e) => {
  if (e.state?.view) {
    navigateTo(e.state.view as SangfroidView);
  } else {
    navigateTo(getViewFromPath());
  }
});
