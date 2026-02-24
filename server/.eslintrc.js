module.exports = {
    env: {
        node: true,
        commonjs: true,
        es2021: true
    },
    extends: ['eslint:recommended', 'prettier', 'plugin:node/recommended'],
    overrides: [],
    parserOptions: {
        ecmaVersion: 'latest'
    },
    plugins: [],
    rules: {
        'no-console': 'off', // Backend usually needs console logs or a logger
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'node/no-unpublished-require': 'off', // Creates issues with devDependencies sometimes
        'node/no-missing-require': 'off' // Can define false positives with some project structures
    }
};
