const path = require('path');
const webpack = require('webpack');

async function buildClient() {
    return new Promise((resolve, reject) => {
        webpack(
            {
                mode: 'production',
                entry: path.resolve(__dirname, '../../libs/fetcher.client.js'),
                output: {
                    filename: 'fetchr.umd.js',
                    path: path.resolve(__dirname, 'static'),
                    library: {
                        name: 'Fetchr',
                        type: 'umd',
                    },
                },
            },
            (err, stats) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(stats);
                }
            }
        );
    });
}

module.exports = buildClient;
