# `src/config.js`

> Based on: b430ebb
> Part of: [module _root](../../02_modules/_root.md) · [Architecture](../../01_architecture.md)

## In one line
Loads `.env` and exports the three settings (`port`, `jwtSecret`, `databaseUrl`) used by the app (`src/config.js:1-7`).

## Role
It is the one place that reads `process.env`, so other files import `config` instead of touching the environment (`src/config.js:4-6`). It calls `dotenv` first (`src/config.js:1`), then exports `port` (number, default 3000), `jwtSecret` and `databaseUrl` (`src/config.js:3-7`). The last two have no default, so a missing value is `undefined`.

## Where it has effect
Direct importers:
- [`src/server.js`](../../03_files/src/server.js.md) uses `config.port` (`src/server.js:2`, `src/server.js:5`).
- [`src/db/index.js`](../../03_files/src/db/index.js.md) uses `config.databaseUrl` (`src/db/index.js:2`, `src/db/index.js:4`).
- [`src/middleware/auth.js`](../../03_files/src/middleware/auth.js.md) uses `config.jwtSecret` to verify tokens (`src/middleware/auth.js:2`, `src/middleware/auth.js:9`).
- [`src/services/userService.js`](../../03_files/src/services/userService.js.md) uses `config.jwtSecret` to sign tokens (`src/services/userService.js:3`, `src/services/userService.js:13`).

Hidden: the values come from [`.env`](../../03_files/.env.md) keys `PORT`, `JWT_SECRET` and `DATABASE_URL` (`src/config.js:4-6`). Nothing checks that the secrets are set, so the app starts even with them missing. Assumption: a missing `JWT_SECRET` would only fail later, when a token is signed or verified (`src/config.js:5`).
