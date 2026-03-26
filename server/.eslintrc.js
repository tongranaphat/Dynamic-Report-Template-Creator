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
        'no-console': 'off',
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'node/no-unpublished-require': 'off',
        'node/no-missing-require': 'off'
    }
};
