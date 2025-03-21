const jsRules = {
  'comma-dangle': ['warn', 'always-multiline'],
  curly: ['error', 'all'],
  'max-len': ['error', { code: 120 }],
  'mocha/no-async-describe': 'error',
  'mocha/no-exclusive-tests': 'error',
  'no-nested-ternary': 'error',
  'padded-blocks': 'off',
  'space-before-function-paren': 'off',
  'no-useless-constructor': 'off',
  'n/no-process-exit': 'off',
  'n/no-unsupported-features/es-syntax': 'off',
  'n/no-unpublished-import': 'off',
  'n/no-extraneous-import': 'error',
  'import/no-unresolved': 'error',
  'prettier/prettier': ['error', { endOfLine: 'auto' }],
  'import/order': [
    1,
    {
      groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'object', 'type'],
      alphabetize: { order: 'asc', caseInsensitive: true },
      'newlines-between': 'always',
    },
  ],
};

// TypeScript specific rules
const tsRules = {
  ...jsRules,
  'no-use-before-define': 'off',
  '@typescript-eslint/no-use-before-define': 'error',
  'n/no-missing-import': 'off',
  'import/no-unresolved': 'error',
};

const tsExtends = [
  'semistandard',
  'plugin:@typescript-eslint/recommended', // uses the recommended rules from the @typescript-eslint/eslint-plugin
  'plugin:n/recommended', // uses the recommended rules from eslint-plugin-n (node)
  'prettier', // displays prettier errors as ESLint errors. (must be the last config in extends array)
];

const tsParserOptions = {
  ecmaVersion: 2022,
  sourceType: 'module',
};

module.exports = {
  root: true,
  env: {
    commonjs: true,
    es2022: true,
    node: true,
    mocha: true,
  },
  extends: [
    'semistandard',
    'plugin:n/recommended', // uses the recommended rules from eslint-plugin-n (node)
    'prettier', // displays prettier errors as ESLint errors. (must be the last config in extends array)
  ],
  ignorePatterns: ['node_modules/', 'dist', '!.github'],
  parserOptions: {
    ecmaVersion: 2022,
  },
  plugins: ['mocha', 'import', 'prettier'],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts'],
      },
    },
  },
  rules: jsRules,
  overrides: [
    // 1. TypeScript files that use tsconfig.json (i.e. main src files)
    {
      files: ['**/*.ts'],
      excludedFiles: ['**/*.spec.ts', 'migrations/**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ...tsParserOptions,
        project: './tsconfig.json',
        tsconfigRootDir: '.',
      },
      plugins: ['@typescript-eslint'],
      extends: tsExtends,
      rules: tsRules,
      settings: {
        'import/parsers': {
          '@typescript-eslint/parser': ['.ts'],
        },
        'import/resolver': {
          typescript: {
            alwaysTryTypes: true,
            project: './tsconfig.json',
          },
          node: {
            extensions: ['.js', '.ts'],
          },
        },
      },
    },

    // 2. Catch-all TypeScript configuration (all TS files not covered above)
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ...tsParserOptions,
        project: null,
      },
      plugins: ['@typescript-eslint'],
      extends: tsExtends,
      settings: {
        'import/parsers': {
          '@typescript-eslint/parser': ['.ts'],
        },
        'import/resolver': {
          typescript: {
            alwaysTryTypes: true,
            project: './tsconfig.json',
          },
          node: {
            extensions: ['.js', '.ts'],
          },
        },
      },
      rules: tsRules,
    },

    // 3. TypeScript test files
    {
      files: ['**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-unused-expressions': 'off', // allow mocha expect syntax
      },
    },

    // 4. JavaScript test files
    {
      files: ['test/**/*.js'],
      rules: {
        'n/no-unpublished-require': 'off',
        'no-unused-expressions': 'off',
      },
    },
  ],
};
