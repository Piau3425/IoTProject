module.exports = {
    root: true,
    env: { browser: true, es2020: true },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    parser: '@typescript-eslint/parser',
    plugins: ['react-refresh'],
    rules: {
        // Disabled: shadcn/ui components export variants alongside components
        'react-refresh/only-export-components': 'off',
        // Allow unused vars with _ prefix
        '@typescript-eslint/no-unused-vars': [
            'error',
            { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
        ],
        // Warn for explicit any, but don't error
        '@typescript-eslint/no-explicit-any': 'warn',
    },
}
