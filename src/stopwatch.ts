export function initDigitalStopwatch(display: HTMLElement): { stopAndShowResult: () => void } {
  const interval = setInterval(() => {
    const min = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const sec = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    display.textContent = `${min}:${sec}`;
  }, 50);

  return {
    stopAndShowResult: () => {
      clearInterval(interval);
      const passed = Math.random() > 0.5;
      display.textContent = passed ? 'PASS' : 'FAIL';
      display.classList.add(passed ? 'pass' : 'fail');
    },
  };
}
