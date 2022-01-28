const express = require('express');
const path = require('path');
const Fetchr = require('../../libs/fetcher');
const { itemsService } = require('./resources/item');
const { errorsService } = require('./resources/error');
const { headersService } = require('./resources/headers');
const { alwaysSlowService } = require('./resources/alwaysSlow');
const { slowThenFastService } = require('./resources/slowThenFast');

Fetchr.registerService(itemsService);
Fetchr.registerService(errorsService);
Fetchr.registerService(headersService);
Fetchr.registerService(alwaysSlowService);
Fetchr.registerService(slowThenFastService);

const app = express();

app.use(express.json());

app.use('/static', express.static(path.join(__dirname, 'static')));

app.use('/api', Fetchr.middleware());

app.get('/', (req, res) => {
    res.send(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <script src="/static/fetchr.umd.js"></script>
  </body>
</html>
`);
});

app.use(function (req, res) {
    res.status(404).send({ error: 'page not found' });
});

module.exports = app;
