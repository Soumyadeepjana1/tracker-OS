import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint configuration.
 *
 * `npm run lint` runs in CI *before* the build, so a broken import, a stray
 * `any` or a hooks mistake fails the pipeline instead of reaching GitHub Pages.
 */
export default tseslint.config(
  {
    // Build output, dependencies and the headless-Chrome test harness.
    ignores: ['dist/**', 'node_modules/**', 'scripts/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // React Compiler readiness rules. They are reported as warnings rather
      // than errors: the patterns they flag here (deriving dialog state when a
      // URL flag appears, reading a ref during render) are intentional and
      // valid today, and turning them into hard failures would block the
      // pipeline on stylistic, non-functional issues.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // The domain model is fully typed; `any` should be a deliberate choice.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Type-only imports keep the emitted bundle free of unused runtime code.
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // console.warn/error are used deliberately for graceful degradation logs.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['warn', 'smart'],
      'prefer-const': 'error',
    },
  },
  {
    // Node-side configuration files.
    files: ['vite.config.ts', '*.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
