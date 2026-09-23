import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement the Blob object-URL APIs — the download-fallback paths
// (planImage.ts, planCalendar.ts) need these to exist, even though nothing about the
// mock URL itself needs to be correct for a test running outside a real browser.
if (!('createObjectURL' in URL)) {
  // @ts-expect-error jsdom doesn't type this
  URL.createObjectURL = () => 'blob:mock-url';
}
if (!('revokeObjectURL' in URL)) {
  // @ts-expect-error jsdom doesn't type this
  URL.revokeObjectURL = () => {};
}
