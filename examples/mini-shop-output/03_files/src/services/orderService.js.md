# `src/services/orderService.js`

> Based on: b430ebb
> Part of: [module services](../../../02_modules/services.md) · [Architecture](../../../01_architecture.md)

## In one line
Creates and lists orders: prices the items from the catalog, stores the order, and announces it with an event (`src/services/orderService.js:5-28`).

## Why it exists
It holds the order rules (known SKUs, total calculation) apart from the HTTP layer, so the route only passes the user and items (`src/routes/orders.js:9`).

## Key parts
- `createOrder(userId, items)`: totals `price * qty` per item from the catalog and rejects an unknown SKU with status 400. It then inserts the row, builds the order object and emits `order:created` (`src/services/orderService.js:5-23`).
- `listOrders(userId)`: returns the user's rows from `orders` (`src/services/orderService.js:25-28`).

## Connections
### Who calls this file
- [`src/routes/orders.js`](../../../03_files/src/routes/orders.js.md) calls `createOrder` and `listOrders` (`src/routes/orders.js:9`, `src/routes/orders.js:18`).
- [`test/orderService.test.js`](../../../03_files/test/orderService.test.js.md) tests `createOrder` with a stubbed db (`test/orderService.test.js:11-16`).

### What this file calls
- [`src/db/index.js`](../../../03_files/src/db/index.js.md) for `db.query` (`src/services/orderService.js:16-19`, `src/services/orderService.js:26`).
- [`src/data/catalog.js`](../../../03_files/src/data/catalog.js.md) for `findProduct` (`src/services/orderService.js:8`).
- [`src/events.js`](../../../03_files/src/events.js.md) for `events.emit` (`src/services/orderService.js:21`).

### Hidden connections
- Event `order:created`: handled by [`src/services/mailer.js`](../../../03_files/src/services/mailer.js.md) (`src/services/mailer.js:9-12`). It looks up the user and, only if one is found, `send()` writes a console.log line, because real SMTP is out of scope (`src/services/mailer.js:4-7`, `src/services/mailer.js:10-11`).
- Event `order:created`: also subscribed once by [`test/orderService.test.js`](../../../03_files/test/orderService.test.js.md) with `events.once` to check the emitted order (`test/orderService.test.js:15`).

## Watch out when reading
- The price comes from the server-side catalog and the client sends only `sku` and `qty` (`src/services/orderService.js:8-14`). The code does not check `qty` for a valid number, so a negative or non-numeric `qty` would change the total (`src/services/orderService.js:14`).
- The event is emitted after the insert and its listeners are not awaited, so a failing listener does not roll back the order (`src/services/orderService.js:16-22`).
