import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import filenamesPlugin from 'eslint-plugin-filenames';

export default [
    {
        ignores: ['out/**', 'dist/**', '**/*.d.ts', '**/*.js', 'coverage/**'],
    },
    {
        files: ['**/*.ts'],
        plugins: {
            '@typescript-eslint': tsPlugin,
            filenames: filenamesPlugin,
        },
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2018,
            sourceType: 'module',
        },
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
        },
    },
];
