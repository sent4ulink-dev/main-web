import { defineConfig } from 'vitest/config';

// Deliberately separate from vite.config.ts (the dev/build config) rather than merging
// test options into it — keeps the production dev-server config untouched. No React
// plugin needed here: tsconfig's "jsx": "react-jsx" is enough for esbuild (which Vitest
// already uses to transform .tsx) to compile JSX on its own, and pulling in
// @vitejs/plugin-react drags in a second, differently-versioned copy of Vite's plugin
// types that don't structurally match this one, which trips up `tsc --noEmit`.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts']
  }
});
