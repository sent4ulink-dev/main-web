import { configDefaults, defineConfig } from "vitest/config";

// Unit tests live in tests/. Agent worktrees under .claude/ hold their own
// copies of the repo and must not be picked up.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ".claude/**", ".site-archives/**"],
  },
});
