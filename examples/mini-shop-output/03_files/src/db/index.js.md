# `src/db/index.js`

> Based on: b430ebb
> Part of: [module db](../../../02_modules/db.md) · [Architecture](../../../01_architecture.md)

## In one line
Creates the single PostgreSQL connection pool and exposes a `query` function to the rest of the app (`src/db/index.js:1-8`).

## Why it exists
Services need one shared place to talk to the database, so the pool is built once at load time from the configured URL (`src/db/index.js:4`). Without it each service would create its own connections.

## Key parts
- `pool`: a `pg` `Pool` created with `config.databaseUrl` (`src/db/index.js:4`).
- `query(text, params)`: the only export; a thin pass-through to `pool.query` (`src/db/index.js:6-8`).

## Connections
### Who calls this file
- [`src/services/userService.js`](../../../03_files/src/services/userService.js.md) imports it as `db` and runs user lookups (`src/services/userService.js:2`).
- [`src/services/orderService.js`](../../../03_files/src/services/orderService.js.md) imports it as `db` and runs order queries (`src/services/orderService.js:1`).

### What this file calls
- The `pg` library for the pool (`src/db/index.js:1`).
- [`src/config.js`](../../../03_files/src/config.js.md) for `databaseUrl` (`src/db/index.js:2`).

### Hidden connections
- Config binding: `config.databaseUrl` comes from the `DATABASE_URL` environment variable (`src/config.js:6`).
- Schema: the queries sent through it assume the tables in [`db/001_init.sql`](../../../03_files/db/001_init.sql.md) (`db/001_init.sql:1-13`).
- Test-side replacement: `test/orderService.test.js` finds this module with `require.resolve('../src/db')` and puts a stub with a fake `query` into `Module._cache`, so `orderService` gets the stub instead of the real pool (`test/orderService.test.js:6-8`).

## Watch out when reading
The pool is created on first `require` and `new Pool` is given the URL without any check, so a missing `DATABASE_URL` is not reported here (`src/db/index.js:4`). Assumption: the failure shows up later at the first query, since nothing in this file validates the URL (`src/db/index.js:4-8`). Assumption: `pg` falls back to its own defaults when `connectionString` is undefined (`src/db/index.js:4`).
