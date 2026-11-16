# `src/events.js`

> Based on: b430ebb
> Part of: [module _root](../../02_modules/_root.md) · [Architecture](../../01_architecture.md)

## In one line
Exports one shared `EventEmitter` that works as an in-process event bus (`src/events.js:1-4`).

## Role
The comment in the file says it lets services talk without importing each other (`src/events.js:3`). Because Node caches modules, every `require` returns the same emitter instance (`src/events.js:4`).

## Where it has effect
- Publisher: [`orderService`](../../03_files/src/services/orderService.js.md) emits `order:created` with the order (`src/services/orderService.js:21`).
- Subscriber: [`mailer`](../../03_files/src/services/mailer.js.md) listens for `order:created` (`src/services/mailer.js:9`). The two files never import each other. They are linked only by this bus and the event name, and `src/server.js` requires the mailer so the listener is registered (`src/server.js:3`).
- Test: [`test/orderService.test.js`](../../03_files/test/orderService.test.js.md) imports the bus (`test/orderService.test.js:10`).
- If the event name is renamed on one side only, nothing fails: the listener is simply never called.
