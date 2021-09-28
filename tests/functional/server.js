const app = require('./app');
const buildClient = require('./buildClient');

buildClient().then(() => {
    app.listen(3000, () => {
        console.log('http://localhost:3000');
    });
});
