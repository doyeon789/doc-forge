# `src/services/mailer.js`

> Based on: b430ebb
> Part of: [module services](../../../02_modules/services.md) · [Architecture](../../../01_architecture.md)

## In one line
Sends the "order received" mail when an order is created, by listening for the `order:created` event (`src/services/mailer.js:9-12`).

## Why it exists
It keeps mail sending out of the order code: `orderService` only emits an event and never imports this file (`src/services/orderService.js:21`). The real SMTP is out of scope, so `send` just logs (`src/services/mailer.js:4-7`).

## Key parts
- `send(to, subject, body)`: logs the mail instead of sending it. It is the only export (`src/services/mailer.js:4-7`, `src/services/mailer.js:14`).
- The `order:created` listener: looks up the user by `order.userId` and sends a mail with the order id and total. It does nothing if the user is not found (`src/services/mailer.js:9-12`).

## Connections
### Who calls this file
- [`src/server.js`](../../../03_files/src/server.js.md) requires it only for its side effect, which registers the listener (`src/server.js:3`).
- No other file uses the `send` export in the searched scope.

### What this file calls
- [`src/events.js`](../../../03_files/src/events.js.md) for `events.on` (`src/services/mailer.js:1`, `src/services/mailer.js:9`).
- [`src/services/userService.js`](userService.js.md) for `findById` (`src/services/mailer.js:2`, `src/services/mailer.js:10`).

### Hidden connections
- Event `order:created`: emitted by [`src/services/orderService.js`](orderService.js.md) (`src/services/orderService.js:21`). The test [`test/orderService.test.js`](../../../03_files/test/orderService.test.js.md) listens to the same event (`test/orderService.test.js:15`).

## Watch out when reading
- The listener is registered only when something requires this file. If `src/server.js` stops requiring it, no mail is sent and nothing fails (`src/server.js:3`).
- The listener is async and `emit` does not await it, so an error in `findById` is not seen by the order request. Assumption: this is acceptable because mail is best-effort. `emit` is called without a catch (`src/services/orderService.js:21`).
