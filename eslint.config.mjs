import js from "@eslint/js";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jestPlugin from "eslint-plugin-jest";

export default [
  // ── 1) Global Ignores ──
  {
    ignores: [
      'eslint.config.mjs',
      '**/node_modules/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.md',
      '**/*.yml',
      '**/*.yaml',
      '**/*.css',
      '**/*.scss',
      '**/*.sass',
      '**/*.html',
      '**/*.json',
      '**/Dockerfile',
      '**/.github/**/*.yml',
      '**/*.sh',
      '**/*.ipynb',
      'backend/tests/performance/api-load-test.js',
    ],
  },

  // ── 2) Root-level Node scripts ──
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'off',
      'no-useless-assignment': 'off',
      'no-useless-escape': 'off',
    },
  },

  // ── 3) Backend (Node/CommonJS) ──
  {
    files: ['backend/**/*.{js,ts}', '!backend/**/*.test.{js,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'off',
      'no-useless-assignment': 0,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 0,
    },
  },

  // ── 4) Backend Tests (CommonJS + Jest) ──
  {
    files: ['backend/**/*.test.{js,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: { jest: jestPlugin },
    rules: {
      ...js.configs.recommended.rules,
      ...jestPlugin.configs.recommended.rules,
      'jest/no-done-callback': 'off',
      'jest/no-conditional-expect': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // ── 6) Frontend Tests (CommonJS + Jest) ──
  {
    files: [
      'frontend/**/*.{js,jsx,ts,tsx}',
      '!frontend/__tests__/**',
      '!frontend/public/sw.js',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: globals.browser,
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: '18' },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'warn',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },

  // ── 6) Frontend Tests (CommonJS + Jest) ──
  {
    files: ['frontend/__tests__/**/*.{js,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: { jest: jestPlugin },
    rules: {
      ...js.configs.recommended.rules,
      ...jestPlugin.configs.recommended.rules,
      'jest/no-done-callback': 'off',
      'jest/no-conditional-expect': 'off',
    },
  },

  // ── 7) Service Worker ──
  {
    files: ['frontend/public/sw.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: globals.serviceworker,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'off',
    },
  },
];
