export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');

  return h > 0
    ? `${h.toString().padStart(2, '0')}:${mm}:${ss}`
    : `${mm}:${ss}`;
}
