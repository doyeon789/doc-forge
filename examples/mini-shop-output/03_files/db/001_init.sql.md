# `db/001_init.sql`

> Based on: b430ebb
> Part of: [module db](../../02_modules/db.md) · [Architecture](../../01_architecture.md)

## In one line
The initial DB migration that creates the `users` and `orders` tables (`db/001_init.sql:1-13`).

## Role
Defines `users` (unique `email`, `password` column) and `orders` (foreign key `user_id` to `users(id)`, `items` as JSONB, `total` as NUMERIC(10, 2), `created_at` defaulting to `now()`) (`db/001_init.sql:1-13`). It is the only schema definition in the repo, so the services' SQL depends on these column names.

## Where it has effect
- [`src/services/userService.js`](../../03_files/src/services/userService.js.md) reads `id`, `email` and `password` from `users` (`src/services/userService.js:6`, `src/services/userService.js:17`).
- [`src/services/orderService.js`](../../03_files/src/services/orderService.js.md) reads `id`, `items` and `total` from `orders` by `user_id` (`src/services/orderService.js:26`).
- [`src/services/orderService.js`](../../03_files/src/services/orderService.js.md) also writes to `orders`: `createOrder` runs `INSERT INTO orders (user_id, items, total) ... RETURNING id`, so it depends on the columns `user_id`, `items`, `total` and on the generated `id` (`src/services/orderService.js:16-19`).
- Assumption: the file is applied by hand or an external tool, since no code in the repo references `001_init` (Grep over the repo found no reference).
