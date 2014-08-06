/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
var webpack = require('webpack');
module.exports = {
    entry: require.resolve('./client/app.js'),
    output: {
        path: __dirname+'/client/build/',
        filename: "app.js"
    },
    plugins: [
        //Replace fetcher lib with client side fetcher lib
        new webpack.NormalModuleReplacementPlugin(/^..\/..\/..\/index.js$/, require.resolve('fetchr/libs/fetcher.client.js'))
    ]
};
