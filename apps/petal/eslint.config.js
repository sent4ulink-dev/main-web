import js from "@eslint/js";
import globals from "globals";

// Lint rules are about correctness, not formatting: the codebase keeps its own
// compact style (long lines are fine for shader strings and data tables).
export default [
  { ignores: ["dist/**", "node_modules/**", "public/**", ".claude/**", ".site-archives/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "smart"],
    },
  },
  {
    // The share links' server: a Cloudflare Pages Function (and, in
    // development, Node).
    files: ["server/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.worker, ...globals.node },
    },
  },
  {
    files: ["tests/**/*.js", "*.config.js", "tools/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
