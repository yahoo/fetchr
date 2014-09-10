/**
 * Copyright 2014, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
var readFlickr = require('../shared/getFlickrPhotos'),
    readFlickrClient,
    config = require('../shared/config'),
    Fetcher = require('../../../libs/fetcher.client.js'),
    fetcher = new Fetcher({
        xhrPath: config.xhrPath,
        requireCrumb: false
    });

//client specific callback
readFlickrClient = function(err, data) {
    if(err) {
        throw err;
    }
    //client specific logic
    var dataContainer = document.getElementById('flickr-data'),
        h1 = document.getElementById('env');
    // set the environment h1
    h1.innerHTML = 'Client';
    // output the data
    dataContainer.innerHTML = JSON.stringify(data);
};

//client-server agnostic call for data
readFlickr(fetcher, readFlickrClient);
