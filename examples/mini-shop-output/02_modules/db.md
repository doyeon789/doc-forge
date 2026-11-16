# module `db`

> Based on: b430ebb
> [Overview](../00_overview.md) · [Architecture](../01_architecture.md)

## In one line
Holds the PostgreSQL connection pool and the initial schema that the services read and write (`src/db/index.js:1-8`, `db/001_init.sql:1-13`).

## Role
`src/db/index.js` creates one shared `pg` Pool from `config.databaseUrl` and exposes only a `query(text, params)` function (`src/db/index.js:4-8`). It does not build queries or hold business logic; callers pass SQL strings. `db/001_init.sql` defines the `users` and `orders` tables that those queries expect (`db/001_init.sql:1-13`). The two files are grouped because the code and the schema it depends on belong together.

## Files
- [`src/db/index.js`](../03_files/src/db/index.js.md): creates the shared pg pool and exports `query`.
- [`db/001_init.sql`](../03_files/db/001_init.sql.md): initial migration creating the `users` and `orders` tables.

## Relations to other modules
- Uses [module `_root`](../02_modules/_root.md): the connection string comes from `config.databaseUrl` in `src/config.js`, which reads the `DATABASE_URL` environment variable (`src/db/index.js:2-4`, `src/config.js:6`).
- Used by [module `services`](../02_modules/services.md): `userService` and `orderService` call `db.query` (`src/services/userService.js:2-6`, `src/services/orderService.js:1-16`).
- Hidden connection (tests): `test/orderService.test.js` does not import `db` but resolves `../src/db` and puts a fake `{ query }` into `Module._cache` before `orderService` loads, so it depends on the path `src/db/index.js` and on the shape of the `query` export (`test/orderService.test.js:6-8`).
- Hidden connection: the SQL in the services names the columns and tables of `001_init.sql` as plain strings, so a schema change is not caught by imports (`src/services/orderService.js:26`, `db/001_init.sql:7-13`).

## Reading order for newcomers
1. [`src/db/index.js`](../03_files/src/db/index.js.md): only 8 lines, and it shows how all DB access is routed.
2. [`db/001_init.sql`](../03_files/db/001_init.sql.md): shows the data model before you read the services.

## Watch out when reading
- The repo contains only one migration and no migration runner. Assumption: the SQL is applied manually. Nothing in the module executes it (`src/db/index.js:1-8`).
- `users.password` is a plain `TEXT` column, so any hashing happens elsewhere (`db/001_init.sql:4`).
- `query` has no transaction support, since it always goes through `pool.query` (`src/db/index.js:7`).
