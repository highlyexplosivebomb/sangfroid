export function initDigitalStopwatch(display: HTMLDivElement): { stopAndShowResult: () => void } {
  const interval = setInterval(() => {
    const min = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const sec = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    display.textContent = `${min}:${sec}`;
  }, 50);

  return {
    stopAndShowResult: () => {
      clearInterval(interval);
      const passed = Math.random() > 0.5;
      if (passed) {
        display.textContent = 'PASS';
        display.style.color = '#22c55e';
        display.style.textShadow = '0 0 16px rgba(34, 197, 94, 0.8), 0 0 32px rgba(34, 197, 94, 0.4)';
      } else {
        display.textContent = 'FAIL';
        display.style.color = 'var(--color-danger)';
        display.style.textShadow = '0 0 16px rgba(185, 28, 28, 0.8), 0 0 32px rgba(185, 28, 28, 0.4)';
      }
    }
  };
}
