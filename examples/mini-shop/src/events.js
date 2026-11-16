const { EventEmitter } = require('events');

// one shared bus so services can talk without importing each other
module.exports = new EventEmitter();
