# module `_root`

> Based on: b430ebb
> [Overview](../00_overview.md) · [Architecture](../01_architecture.md)

## In one line
The top-level module that starts the Express app, loads configuration and provides the shared event bus.

## Role
`src/server.js` is the entry point: it starts the HTTP server on the configured port and requires the mailer so its event listener is registered (`src/server.js:1-7`). `src/app.js` builds the Express app, auto-mounts every file in `src/routes`, and sets the final error handler (`src/app.js:8-12`). `src/config.js` loads the environment and exposes `port`, `jwtSecret` and `databaseUrl` (`src/config.js:1-7`). `src/events.js` exports one shared `EventEmitter` so services can communicate without importing each other (`src/events.js:3-4`). `package.json` names `src/server.js` as the entry and lists the `start` and `test` scripts (`package.json:5-9`). The module holds no business logic; that lives in the other modules.

## Files
- [`.env`](../03_files/.env.md): local environment file; keys only (`JWT_SECRET`, `DATABASE_URL`, `PORT`), values hidden.
- [`package.json`](../03_files/package.json.md): npm manifest with entry point, scripts and dependencies.
- [`src/app.js`](../03_files/src/app.js.md): builds the Express app, auto-loads routes, sets the error handler.
- [`src/config.js`](../03_files/src/config.js.md): reads environment values and exports them.
- [`src/events.js`](../03_files/src/events.js.md): shared in-process event bus.
- [`src/server.js`](../03_files/src/server.js.md): starts the HTTP server and registers the mailer.

## Relations to other modules
- Uses [routes](routes.md): `src/app.js` mounts every file found in `src/routes` (`src/app.js:8`).
- Uses [services](services.md): `src/server.js` requires `./services/mailer` for its side effect (`src/server.js:3`).
- Used by [middleware](middleware.md), [db](db.md) and [services](services.md): they import `../config` (`src/middleware/auth.js:2`, `src/db/index.js:2`, `src/services/userService.js:3`).
- Hidden connection, events: `src/services/orderService.js` and `src/services/mailer.js` import `../events` (`src/services/orderService.js:2`, `src/services/mailer.js:1`); [test](test.md) also uses the bus (`test/orderService.test.js:10`, `test/orderService.test.js:15`).
- Hidden connection, config: `src/config.js` reads `PORT`, `JWT_SECRET` and `DATABASE_URL` from the environment (`src/config.js:4-6`), which `.env` supplies.

## Reading order for newcomers
1. `src/server.js`: the entry point, short.
2. `src/app.js`: shows how routes and the error handler are wired.
3. `src/config.js`: the settings the rest of the code depends on.
4. `src/events.js`: needed to follow order and mail flows.

## Watch out when reading
- Routes are loaded by directory scan, so any file dropped in `src/routes` is mounted and must export something `app.use` accepts (`src/app.js:8`).
- The mailer is never called directly from `server.js`; requiring it is what registers its listener (`src/server.js:3`).
- `jwtSecret` and `databaseUrl` have no default, so they are `undefined` if `.env` lacks them (`src/config.js:5-6`).
