/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
module.exports = {
    entry: require.resolve('./client/app.js'),
    output: {
        path: __dirname+'/client/build/',
        filename: "app.js"
    }
};
