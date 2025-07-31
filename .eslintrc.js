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
    },
  ],
  ignorePatterns: ['ts-build/**', 'public/**'],
}
