# `test/orderService.test.js`

> Based on: b430ebb
> Part of: [module test](../../02_modules/test.md) · [Architecture](../../01_architecture.md)

## What it verifies
Checks that `createOrder` returns the order built from the database row and publishes the `order:created` event with that same order (`test/orderService.test.js:13-18`). It runs with the real event bus and a stubbed database, so no database is needed (`test/orderService.test.js:6-11`).

## Files under test
- [`src/services/orderService.js`](../../03_files/src/services/orderService.js.md): the service whose `createOrder` is called (`test/orderService.test.js:11`, `test/orderService.test.js:16`).
- [`src/events.js`](../../03_files/src/events.js.md): the shared event bus used to observe the emitted event (`test/orderService.test.js:10`, `test/orderService.test.js:15`).
- [`src/db/index.js`](../../03_files/src/db/index.js.md): replaced by a stub, not run. The test resolves `../src/db` and writes a fake module into `Module._cache` before `orderService` is loaded, so the service gets the stub (`test/orderService.test.js:6-8`).
- [`src/data/catalog.js`](../../03_files/src/data/catalog.js.md): not imported by the test, but `createOrder` looks up each sku with `findProduct` and throws a 400 error for an unknown one (`src/services/orderService.js:3-13`). The test's hard-coded `SKU-0001` must therefore exist in the catalog (`test/orderService.test.js:16`, `src/data/catalog.js:3`).

Hidden connections:
- The test is run by the npm `test` script, `node --test test/` ([`package.json`](../../03_files/package.json.md)) (`package.json:8`).
- The event name `order:created` is emitted in `src/services/orderService.js:21`. A listener also exists in [`src/services/mailer.js`](../../03_files/src/services/mailer.js.md) (`src/services/mailer.js:9`). Assumption: the mailer is loaded only if `orderService` requires it, and this test does not check it. The test only observes the event through its own listener (`test/orderService.test.js:15`).
- The test data `test/fixtures/users.json` is a data file with no doc; the test takes `users[0].id` from it (`test/orderService.test.js:4`, `test/orderService.test.js:16`).

## Test cases worth reading
- `createOrder emits order:created`: the only case. It registers a one-time listener with `events.once` before the call. It then checks that the returned order id and the id seen by the listener both equal the stubbed row id `42` (`test/orderService.test.js:13-18`).
- The stub must be installed before `require` of the service. Moving the `require` lines above the `Module._cache` assignment would hit the real database (`test/orderService.test.js:8-11`).
