# module `test`

> Based on: b430ebb
> [Overview](../00_overview.md) · [Architecture](../01_architecture.md)

## In one line
Holds the automated test that checks `createOrder` returns the new order and emits `order:created`, with the database stubbed (`test/orderService.test.js:13-19`).

## Role
The module has one test file and one fixture. The test replaces the `src/db` module in Node's module cache before `orderService` is loaded, so no real database is needed (`test/orderService.test.js:6-8`). It then calls `createOrder` with the first fixture user and one item. It asserts that the returned order id is 42 and that the `order:created` event delivered the same order (`test/orderService.test.js:13-19`). It uses the built-in `node:test` runner and `node:assert`, with no extra test dependency (`test/orderService.test.js:1-2`). It does not cover routes, middleware or the mailer.

## Files
- [`test/orderService.test.js`](../03_files/test/orderService.test.js.md): tests that `createOrder` returns the order and emits `order:created`, using a stubbed db.
- `test/fixtures/users.json`: data file with sample users. The test reads `users[0].id` (`test/orderService.test.js:4`, `test/orderService.test.js:16`).

## Relations to other modules
- Uses [services](services.md): imports `src/services/orderService.js` and calls `createOrder` ([file doc](../03_files/src/services/orderService.js.md)) (`test/orderService.test.js:11`, `test/orderService.test.js:16`).
- Uses [db](db.md): replaces the `src/db` export with a stub whose `query` resolves to `{ rows: [{ id: 42 }] }`, which `createOrder` reads as `rows[0].id` ([file doc](../03_files/src/db/index.js.md)) (`test/orderService.test.js:7-8`).
- Uses [_root](_root.md): listens on the event emitter from `src/events.js` ([file doc](../03_files/src/events.js.md)) (`test/orderService.test.js:10`, `test/orderService.test.js:15`).
- Hidden connection: the event name `order:created` is a string shared with the publisher in `orderService`. The test only works while both sides use the same name (`test/orderService.test.js:15`).
- Assumption: the mailer ([file doc](../03_files/src/services/mailer.js.md)) is not stubbed, so it probably listens to the event or is called by `createOrder`. The batch summary lists it as a connection of the test (`test/orderService.test.js:11`).
- Nothing else imports this module.

## Reading order for newcomers
1. [`test/orderService.test.js`](../03_files/test/orderService.test.js.md): the only test. It shows how the db is stubbed and what `createOrder` promises.
2. `test/fixtures/users.json`: the sample data it reads.

## Watch out when reading
- The stub must be put in `Module._cache` before `orderService` is required. Moving the `require` lines changes the result (`test/orderService.test.js:7-11`).
- The stub path comes from `require.resolve('../src/db')`, so it works only while `src/db` resolves to the same file that `orderService` loads (`test/orderService.test.js:7`).
- The stub returns the same row for every query, so the test does not check the SQL (`test/orderService.test.js:8`).
