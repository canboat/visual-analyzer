module.exports = {
  root: true,
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    node: true,
    es2020: true,
    browser: true,
  },
  overrides: [
    {
      files: ['**/*.js', '**/*.jsx'],
      extends: ['eslint:recommended', 'plugin:react/recommended', 'prettier'],
      plugins: ['react'],
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      env: {
        browser: true,
        es2020: true,
      },
      settings: {
        react: {
          version: 'detect',
        },
      },
    },
    {
      files: ['**/*.ts'],
      extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
          },
        ],
      },
    },
    {
      files: ['test/**/*.js'],
      env: {
        node: true,
        mocha: true,
      },
      globals: {
        expect: 'readonly',
      },
    },
  ],
  ignorePatterns: ['ts-build/**', 'public/**', 'dist/**'],
}
