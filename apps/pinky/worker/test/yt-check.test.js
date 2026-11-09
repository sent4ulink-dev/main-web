// The step editor's song box asks this Worker whether a YouTube song can play inside the card.
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index.js';

const call = (path, method = 'GET') => worker.fetch(new Request(`https://api.test${path}`, { method, headers: { Origin: 'https://sent4u.link' } }), { CORS_ORIGIN: 'https://sent4u.link' });
const youtube = (status, body = {}) => vi.spyOn(globalThis, 'fetch').mockImplementation(async (u) => {
  expect(String(u)).toMatch(/^https:\/\/www\.youtube\.com\/oembed\?format=json&url=/);
  return Response.json(body, { status });
});

describe('the song check', () => {
  afterEach(() => vi.restoreAllMocks());
  it('says whether a YouTube song can play inside the card', async () => {
    youtube(200, { title: 'A song' });
    const r = await call('/api/yt-check/dQw4w9WgXcQ');
    expect(await r.json()).toEqual({ ok: true, title: 'A song' });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://sent4u.link');
    vi.restoreAllMocks(); youtube(401);
    expect(await (await call('/api/yt-check/dQw4w9WgXcQ')).json()).toEqual({ ok: false, reason: 'blocked' });
    vi.restoreAllMocks(); youtube(404);
    expect(await (await call('/api/yt-check/dQw4w9WgXcQ')).json()).toEqual({ ok: false, reason: 'missing' });
    vi.restoreAllMocks(); youtube(500);
    expect(await (await call('/api/yt-check/dQw4w9WgXcQ')).json()).toEqual({ ok: true });
  });
  it('answers only a real song id', async () => {
    expect((await call('/api/yt-check/not-an-id')).status).toBe(404);
  });
});
