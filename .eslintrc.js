module.exports = {
    ignorePatterns: ['out', 'dist', '**/*.d.ts', '**/*.js'],
    parser: '@typescript-eslint/parser',
    extends: ['plugin:@typescript-eslint/recommended'],
    parserOptions: {
        ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
        sourceType: 'module', // Allows for the use of imports
    },
    plugins: ['filenames', '@typescript-eslint'],
    rules: {
        '@typescript-eslint/naming-convention': [
            'error',
            { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
            { selector: 'class', format: ['PascalCase'] },
            { selector: 'typeAlias', format: ['PascalCase'] },
            { selector: 'interface', format: ['PascalCase'], prefix: ['I'] },
            { selector: 'enum', format: ['PascalCase'] },
            { selector: 'enumMember', format: ['PascalCase'] },
        ],
        semi: 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        curly: 'warn',
        eqeqeq: 'error',
        'no-throw-literal': 'warn',
        'filenames/match-regex': [2, '^[a-z]+([A-Za-z0-9]+)*(.spec|.test|.unit)?', true],
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-require-imports': 'off',
    },
};
