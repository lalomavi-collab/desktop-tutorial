import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// The `lint` script existed since the project was scaffolded and never had a
// configuration behind it, so `npm run lint` failed on every branch and nobody
// could tell a real finding from the missing config.
//
// What this adds over the checks that already run: `tsc -b` proves the types,
// and scripts/build-check.mjs proves the built site, but neither knows about
// React's rules of hooks, and a dependency array that quietly drops a value is
// a class of bug that only a linter catches. That is the reason to have this
// file, so the rules that carry their weight are errors and the rest stay out
// of the way.
export default tseslint.config(
  { ignores: ["dist", "node_modules", "public"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // The data modules export types alongside their data, which is the point
      // of them, so an unused type import in a consumer is worth seeing but is
      // not worth failing a branch over. An unused runtime value still is.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // The three rules below come from the React Compiler era of
      // eslint-plugin-react-hooks. They are worth seeing and they are not
      // worth failing a branch over today: they fire 14 times across
      // components that work and that this configuration did not touch
      // (Portal, ChatWidget, the consent dialogs, the video bubble), and
      // silencing them would hide the list. They stay as warnings until
      // someone takes that pass deliberately.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    // The build config runs in Node and reads the source modules directly.
    files: ["vite.config.ts", "scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
);
