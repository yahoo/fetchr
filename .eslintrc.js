module.exports = {
    env: {
        browser: true,
        node: true,
    },
    extends: ['eslint:recommended'],
    rules: {
        'no-prototype-builtins': 0,
        'no-unexpected-multiline': 0,
        'dot-notation': [2, { allowKeywords: false }],
    },
    globals: {
        Promise: 'readonly',
    },
};
