var webpack = require('webpack');
module.exports = {
    entry: require.resolve('./client/app.js'),
    output: {
        path: __dirname+'/client/build/',
        filename: "app.js"
    },
    plugins: [
        //Replace fetcher lib with client side fetcher lib
        new webpack.NormalModuleReplacementPlugin(/^fetchr$/, require.resolve('fetchr/libs/fetcher.client.js'))
    ]
};
