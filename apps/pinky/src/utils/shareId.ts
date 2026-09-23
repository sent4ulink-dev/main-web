export const DEMO_SHARE_ID = 'test';
// Same demo, reached through the sent4u.link gateway's "Open live demo" link — see
// gateway/index.js at the repo root.
const GATEWAY_DEMO_SHARE_ID = 'test-pinky';

export function getShareId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('share');
}

export function isDemoShareId(id: string | null): boolean {
  return id === DEMO_SHARE_ID || id === GATEWAY_DEMO_SHARE_ID;
}
