# mini-shop overview

> Based on: b430ebb
> [Architecture](01_architecture.md)

## In one line
mini-shop is a small Express HTTP API for a shop: users log in, browse a product catalog and place orders (`README.md:3`, `src/app.js:1-14`).

## What and why
The README describes it as a "Small Express shop API" (`README.md:3`). Assumption: it is a sample or learning-size project rather than a production shop, because mail sending is only logged and the README is a single line (`src/services/mailer.js:4-7`, `README.md:1-3`).

Main features:
- Login with email and password that returns a JWT valid for one hour (`src/routes/users.js:6-13`, `src/services/userService.js:5-14`).
- Public product listing (first 50 items) and lookup by SKU from an in-memory catalog (`src/routes/products.js:6-14`).
- Authenticated order creation that prices the items from the catalog and stores the order in Postgres (`src/routes/orders.js:7-14`, `src/services/orderService.js:5-23`).
- Listing the current user's orders (`src/routes/orders.js:16-22`, `src/services/orderService.js:25-28`).
- An order confirmation "mail" triggered by the `order:created` event, written to the console instead of SMTP (`src/services/orderService.js:21`, `src/services/mailer.js:9-12`).

## Tech stack
- Language and runtime: JavaScript on Node.js with CommonJS modules (`src/server.js:1-3`, `package.json:5-8`). The test script uses the built-in `node --test` runner (`package.json:8`).
- Web framework: Express `^4.19.2` (`package.json:11`).
- Authentication: `jsonwebtoken` `^9.0.2` (`package.json:12`, `src/middleware/auth.js:1`).
- Database: PostgreSQL through `pg` `^8.11.3` with a shared connection pool (`package.json:13`, `src/db/index.js:1-4`). The schema is plain SQL with `users` and `orders` tables (`db/001_init.sql:1-13`).
- Configuration: `dotenv` `^16.4.5` loads `.env` (`package.json:14`, `src/config.js:1`).
- Build tool: none; there is no build or transpile step, only `npm start` and `npm test` (`package.json:6-9`).

## Modules
- [_root](02_modules/_root.md): entry point, Express app setup, config and the shared event bus (`src/server.js:1-7`, `src/app.js:1-14`).
- [routes](02_modules/routes.md): the three Express routers for login, products and orders (`src/routes/orders.js:1-24`).
- [services](02_modules/services.md): business logic for login, orders and the order mail listener (`src/services/orderService.js:5-23`).
- [middleware](02_modules/middleware.md): Bearer JWT check that fills `req.user` (`src/middleware/auth.js:4-14`).
- [db](02_modules/db.md): pg pool with a single `query` function, plus the SQL schema (`src/db/index.js:6-8`, `db/001_init.sql:1-13`).
- [data](02_modules/data.md): generated in-memory product catalog with `findProduct` lookup (`src/data/catalog.js:1`, `src/data/catalog.js:2595-2598`).
- [test](02_modules/test.md): the one automated test for `createOrder` and its fixture (`test/orderService.test.js:13-19`).

## Scope of analysis
- 19 files were scanned and 17 have a file doc: 13 `source`, 1 `test`, 2 `config` (`package.json`, and `.env`, which is `secret` and documented from key names only) and 1 `sql`.
- 2 files have no file doc: 1 `doc` file (`README.md`) and 1 `data` file (`test/fixtures/users.json`), listed in its module doc.
- The manifest `excluded` list is empty, so no file was left out by the scan.

## Suggested reading order
1. [Architecture](01_architecture.md): the layers and the event-based side path, before any code.
2. [`src/server.js`](03_files/src/server.js.md): the entry point, short, and the only place that loads the mailer listener (`src/server.js:3`).
3. [`src/app.js`](03_files/src/app.js.md): shows how routes are mounted by scanning a folder and where errors end up (`src/app.js:8-12`).
4. [`src/config.js`](03_files/src/config.js.md): the single place environment variables are read (`src/config.js:1-7`).
5. [routes module](02_modules/routes.md): the full HTTP surface in three small files.
6. [`src/services/orderService.js`](03_files/src/services/orderService.js.md): the core business rule (pricing, storing, emitting the event) (`src/services/orderService.js:5-23`).
7. [`src/services/mailer.js`](03_files/src/services/mailer.js.md): the hidden consumer of `order:created` (`src/services/mailer.js:9-12`).
8. [middleware module](02_modules/middleware.md) and [`src/services/userService.js`](03_files/src/services/userService.js.md): how tokens are issued and checked (`src/services/userService.js:13`, `src/middleware/auth.js:9`).
9. [db module](02_modules/db.md): the pool and the schema that the services' SQL strings rely on (`db/001_init.sql:1-13`).
10. [`test/orderService.test.js`](03_files/test/orderService.test.js.md): how the db is stubbed for tests (`test/orderService.test.js:6-8`).

## How to run
1. Install dependencies with `npm install` (`package.json:10-15`). Assumption: a recent Node.js is needed, since the test script relies on the `node --test` runner and no `engines` field is set (`package.json:8`).
2. Set the environment variables, in `.env` or the shell (`src/config.js:1-7`, `.env`):
   - `PORT`: HTTP port, defaults to 3000 (`src/config.js:4`).
   - `JWT_SECRET`: key used to sign and verify login tokens (`src/config.js:5`).
   - `DATABASE_URL`: Postgres connection string (`src/config.js:6`).
3. Assumption: create the database schema by running `db/001_init.sql` by hand (for example with `psql`), because the repo has no migration runner or script for it (`db/001_init.sql:1-13`, `package.json:6-9`).
4. Start the server with `npm start`, which runs `node src/server.js` (`package.json:7`, `README.md:3`).
5. Run the tests with `npm test`, which runs `node --test test/` (`package.json:8`). The test stubs the db, so it does not need Postgres (`test/orderService.test.js:6-8`).
