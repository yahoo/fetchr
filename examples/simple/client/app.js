var readFlickr = require('../shared/getFlickrPhotos'),
    readFlickrClient;

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
readFlickr(readFlickrClient);
