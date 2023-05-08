module.exports = {
    ignorePatterns: ['out', 'dist', '**/*.d.ts', '**/*.js'],
    parser: '@typescript-eslint/parser',
    extends: ['plugin:@typescript-eslint/recommended'],
    parserOptions: {
        ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
        sourceType: 'module', // Allows for the use of imports
    },
    rules: {
        '@typescript-eslint/naming-convention': 'error',
        semi: 'off',
        '@typescript-eslint/semi': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        curly: 'warn',
        eqeqeq: 'error',
        'no-throw-literal': 'warn',
    },
};
