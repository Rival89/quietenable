// eslint.config.js (flat config; ESLint v9+)
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  // 1) global ignores
  { ignores: ["dist", "build", "coverage", "**/*.d.ts", "node_modules"] },

  // 2) JS/TS files
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.es2021 },
    },
    rules: {
      // tweak as desired
      "no-unused-vars": "off", // defer to TS rule
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  }
);
