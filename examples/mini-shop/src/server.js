const app = require('./app');
const config = require('./config');
require('./services/mailer');

app.listen(config.port, () => {
  console.log(`mini-shop listening on ${config.port}`);
});
