import { useEffect, useState } from 'react';

/** Self-adjusting: ticks once a minute while >1h remains, once a second under an hour. */
export function useEditWindowCountdown(editUntil: number | null): number {
  const [msLeft, setMsLeft] = useState<number>(() => (editUntil ? editUntil - Date.now() : 0));

  useEffect(() => {
    if (!editUntil) {
      setMsLeft(0);
      return;
    }
    let timeoutId: ReturnType<typeof setTimeout>;
    const tick = () => {
      const remaining = editUntil - Date.now();
      setMsLeft(remaining);
      if (remaining <= 0) return;
      const delay = remaining > 60 * 60 * 1000 ? 60000 : 1000;
      timeoutId = setTimeout(tick, delay);
    };
    tick();
    return () => clearTimeout(timeoutId);
  }, [editUntil]);

  return Math.max(0, msLeft);
}

export function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return 'Editing closed';
  const totalSeconds = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h left to edit`;
  if (hours > 0) return `${hours}h ${minutes}m left to edit`;
  return `${minutes}m ${seconds}s left to edit`;
}
