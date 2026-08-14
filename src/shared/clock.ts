import { getGameState, getCurrentPhase, GamePhase, GameStatus } from './store';
import { formatTime } from './format';

export function updateClockDisplay(element: HTMLElement | null, isAdmin: boolean = false): void {
  if (!element) {
    return;
  }

  const state = getGameState();
  const phase = getCurrentPhase();

  element.classList.remove('final-phase-time');
  element.style.color = '';

  if (phase === GamePhase.Stopped) {
    if (isAdmin) {
      element.innerHTML = `<span class="game-time-bold">STOPPED</span>`;
    } else {
      element.textContent = 'STOPPED';
    }
  } else {
    let remaining = state.timeRemainingSeconds;
    if (state.status === GameStatus.Running) {
      const elapsed = Math.floor((Date.now() - state.lastTickTimestamp) / 1000);
      remaining -= elapsed;
    }

    let timeText = '';
    if (phase === GamePhase.Pregame) {
      const pregameRemaining = remaining - (120 * 60);
      timeText = formatTime(Math.max(0, pregameRemaining));
    } else if (phase === GamePhase.Main) {
      timeText = formatTime(Math.max(0, remaining));
    } else if (phase === GamePhase.Final) {
      const finalRemaining = (30 * 60) + remaining;
      timeText = formatTime(Math.max(0, finalRemaining));
      if (isAdmin) {
        if (finalRemaining <= 300) {
          element.classList.add('final-phase-time');
        }
      } else {
        element.classList.add('final-phase-time');
      }
    } else if (phase === GamePhase.Ended) {
      timeText = '00:00:00';
    }

    if (isAdmin) {
      element.innerHTML = `<span class="game-time-bold">${timeText}</span>`;
    } else {
      element.textContent = timeText;
    }
  }
}

export function startClock(element: HTMLElement, isAdmin: boolean = false, extraCheck?: () => boolean): () => void {
  const update = () => {
    if (extraCheck && !extraCheck()) {
      if (element) {
        element.innerHTML = '';
      }
      return;
    }
    updateClockDisplay(element, isAdmin);
  };
  update();
  const interval = setInterval(update, 1000);
  return () => clearInterval(interval);
}
