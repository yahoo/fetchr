/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
var webpack = require('webpack'),
    path = require('path');
module.exports = {
    entry: require.resolve('./client/app.js'),
    output: {
        path: __dirname+'/client/build/',
        filename: "app.js"
    },
    plugins: [
        //Replace fetcher lib with client side fetcher lib
        new webpack.NormalModuleReplacementPlugin(/^..\/..\/..\/libs\/fetcher.js$/, path.resolve('../../libs/fetcher.client.js'))
    ]
};
