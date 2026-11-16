const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
app.use(express.json());

fs.readdirSync(path.join(__dirname, 'routes')).forEach(r => app.use(require('./routes/' + r)));

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});

module.exports = app;
