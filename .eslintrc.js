module.exports = {
    env: {
        browser: true,
        es2023: true,
        mocha: true,
        node: true,
    },
    extends: ['eslint:recommended'],
    rules: {
        'no-prototype-builtins': 0,
        'no-unexpected-multiline': 0,
    },
    globals: {
        Promise: 'readonly',
    },
};
