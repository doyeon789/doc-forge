const events = require('../events');
const userService = require('./userService');

function send(to, subject, body) {
  // real SMTP is out of scope for mini-shop, so log instead
  console.log(`[mail] to=${to} subject=${subject}\n${body}`);
}

events.on('order:created', async order => {
  const user = await userService.findById(order.userId);
  if (user) send(user.email, `Order #${order.id} received`, `Total: ${order.total}`);
});

module.exports = { send };
