import {
  getAdminGameId,
  getGameState,
  setAdminGameId,
} from '../shared/store';
import { createSvgIcon } from '../shared/svg';
import { renderSubmissions } from './submissions';
import { renderControls } from './controls';
import { renderMoreTab } from './more';

export const AdminTab = {
  Submissions: 'submissions',
  Controls: 'controls',
  More: 'more',
} as const;
export type AdminTab = (typeof AdminTab)[keyof typeof AdminTab];

let container: HTMLElement | null = null;
let statusDisplay: HTMLElement | null = null;
let activeTab: AdminTab = AdminTab.Controls;
let refreshInterval: number | undefined;
let availableGames: number[] = [];

export async function mountAdmin(host: HTMLElement): Promise<void> {
  container = host;
  activeTab = AdminTab.Submissions;

  availableGames = [];
  for (const [envKey, id] of [
    ['VITE_GAME_CODE_1', 1],
    ['VITE_GAME_CODE_2', 2],
    ['VITE_GAME_CODE_3', 3],
  ] as const) {
    if (import.meta.env[envKey]?.trim()) {
      availableGames.push(id);
    }
  }

  renderShell();
  updateContent();
  refreshInterval = setInterval(() => {
    if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      updateContent();
    }
  }, 2000);
}

export function unmountAdmin(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = undefined;
  }
  if (container) {
    container.innerHTML = '';
  }
  container = null;
  statusDisplay = null;
}

function renderShell(): void {
  if (!container) {
    return;
  }
  container.innerHTML = '';

  const shell = document.createElement('div');
  shell.className = 'game-shell';

  const header = document.createElement('div');
  header.className = 'game-header';

  const title = document.createElement('div');
  title.className = 'game-team-tag admin-game-selector';

  const select = document.createElement('select');
  select.className = 'admin-game-select';
  select.innerHTML = `<option value="">None</option>` +
    availableGames.map(id =>
      `<option value="${id}" ${getAdminGameId() === id ? 'selected' : ''}>${id}</option>`
    ).join('');

  select.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    setAdminGameId(val ? parseInt(val, 10) : undefined);
    updateContent();
  });

  title.appendChild(select);

  statusDisplay = document.createElement('div');
  statusDisplay.className = 'game-time';

  header.appendChild(title);
  header.appendChild(statusDisplay);
  shell.appendChild(header);

  const tabContent = document.createElement('div');
  tabContent.className = 'game-tab-content';

  const panel = document.createElement('div');
  panel.className = 'game-tab-panel active';
  panel.id = 'adminTabPanel';

  tabContent.appendChild(panel);
  shell.appendChild(tabContent);

  const tabBar = document.createElement('div');
  tabBar.className = 'game-tab-bar';

  const createTab = (id: AdminTab, tabLabel: string, iconHtml: string) => {
    const btn = document.createElement('button');
    btn.className = `game-tab-btn ${activeTab === id ? 'active' : ''}`;
    btn.dataset.tabId = id;

    const svg = createSvgIcon(iconHtml);
    svg.classList.add('game-tab-icon');
    btn.appendChild(svg);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'game-tab-label';
    labelSpan.textContent = tabLabel;
    btn.appendChild(labelSpan);

    btn.addEventListener('click', () => {
      activeTab = id;
      tabBar.querySelectorAll('.game-tab-btn').forEach(t =>
        t.classList.toggle('active', (t as HTMLElement).dataset.tabId === activeTab)
      );
      updateContent();
    });
    return btn;
  };

  tabBar.appendChild(createTab(AdminTab.Controls, 'CONTROLS', '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-8h6m2 12h6"/>'));
  tabBar.appendChild(createTab(AdminTab.Submissions, 'SUBMISSIONS', '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'));
  tabBar.appendChild(createTab(AdminTab.More, 'MORE', '<line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>'));

  shell.appendChild(tabBar);
  container.appendChild(shell);
}

function updateContent(): void {
  const panel = document.getElementById('adminTabPanel');
  if (!panel) {
    return;
  }
  panel.innerHTML = '';

  if (activeTab === AdminTab.Submissions) {
    renderSubmissions(panel, updateContent);
  } else if (activeTab === AdminTab.Controls) {
    renderControls(panel, updateContent);
  } else if (activeTab === AdminTab.More) {
    renderMoreTab(panel);
  }

  if (statusDisplay) {
    const gameId = getAdminGameId();
    if (gameId) {
      const state = getGameState();
      const statusColor = state.status === 'running' ? 'var(--color-success)' : 'var(--color-danger)';
      statusDisplay.innerHTML = `<span style="font-weight: 800; color: ${statusColor}">${state.status.toUpperCase()}</span>`;
    } else {
      statusDisplay.innerHTML = '';
    }
  }
}