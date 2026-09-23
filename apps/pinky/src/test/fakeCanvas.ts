import { vi } from 'vitest';

/** jsdom has no real 2D canvas renderer and never fires <img> load events. This fakes
 * just enough of CanvasRenderingContext2D to run planImage.ts's compositing calls
 * (recording fillText/strokeText so a test can assert the marquee word), and stubs
 * Image so loadImage() resolves instead of hanging. */
export function installFakeCanvas() {
  const fillTextCalls: string[] = [];
  const strokeTextCalls: string[] = [];

  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    crossOrigin = '';
    naturalWidth = 900;
    naturalHeight = 1200;
    width = 900;
    height = 1200;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  const RealImage = globalThis.Image;
  // @ts-expect-error test-only stand-in for the DOM Image constructor
  globalThis.Image = FakeImage;

  const gradient = { addColorStop: vi.fn() };

  const ctx = {
    fillRect: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 9 })),
    fillText: vi.fn((text: string) => {
      fillTextCalls.push(text);
    }),
    strokeText: vi.fn((text: string) => {
      strokeTextCalls.push(text);
    }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    shadowColor: '',
    shadowBlur: 0
  };

  const getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() => ctx as unknown as CanvasRenderingContext2D);

  const toBlobSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation(function (this: HTMLCanvasElement, callback: BlobCallback, type?: string) {
      callback(new Blob(['fake-png-bytes'], { type: type || 'image/png' }));
    });

  return {
    ctx,
    fillTextCalls,
    strokeTextCalls,
    restore: () => {
      getContextSpy.mockRestore();
      toBlobSpy.mockRestore();
      globalThis.Image = RealImage;
    }
  };
}
