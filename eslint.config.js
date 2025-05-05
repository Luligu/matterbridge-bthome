// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginJest from 'eslint-plugin-jest';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import eslintPluginN from 'eslint-plugin-n';
import eslintPluginPromise from 'eslint-plugin-promise';

export default [
  {
    name: 'global ignores',
    ignores: ['dist/', 'build/', 'node_modules/', 'coverage/', 'frontend/', 'rock-s0/', 'bin'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  eslintPluginPrettier,
  eslintPluginPromise.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
    rules: {
      'no-console': 'warn',
      'no-undef': 'off',
      'spaced-comment': ['error', 'always'],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    name: 'javascript',
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    name: 'typescript',
    files: ['**/*.ts'],
    ignores: ['**/__test__/*', '**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
  },
  {
    name: 'jest',
    files: ['**/__test__/*', '**/*.test.ts', '**/*.spec.ts'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      jest: eslintPluginJest,
    },
    ...tseslint.configs.disableTypeChecked,
    ...eslintPluginJest.configs['flat/recommended'],
  },
  {
    name: 'node',
    files: ['**/*.ts'],
    plugins: {
      n: eslintPluginN,
    },
    rules: {
      'n/prefer-node-protocol': 'error',
    },
  },
];
