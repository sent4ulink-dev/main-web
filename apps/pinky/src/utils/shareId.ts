export const DEMO_SHARE_ID = 'test';

export function getShareId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('share');
}

export function isDemoShareId(id: string | null): boolean {
  return id === DEMO_SHARE_ID;
}
