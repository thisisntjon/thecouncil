import js from "@eslint/js";
import globals from "globals";

// Flat config for The Council (ESM / Node .mjs).
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "runs/**",
      "generated-runs/**",
      "logs/**",
      "client/**" // React UI lints via its own Vite/React tooling
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }] // intentional swallow idiom in scripts/server
    }
  }
];
