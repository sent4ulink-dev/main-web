// Licensed fonts supplied by the owner (see src/fonts/README.md). Nothing here means nothing is loaded.
const files = import.meta.glob('./fonts/*.{woff2,woff,otf,ttf}', { query: '?url', import: 'default', eager: true });

export async function loadLicensedFonts() {
  const jobs = [];
  for (const [path, url] of Object.entries(files)) {
    if (!/lumios/i.test(path)) continue;
    const face = new FontFace('Lumios Typewriter Old', `url(${url})`);
    jobs.push(face.load().then((f) => document.fonts.add(f)).catch((e) => console.warn('font failed', path, e)));
  }
  await Promise.all(jobs);
}
