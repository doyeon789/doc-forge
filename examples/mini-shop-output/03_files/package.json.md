# `package.json`

> Based on: b430ebb
> Part of: [module _root](../02_modules/_root.md) · [Architecture](../01_architecture.md)

## In one line
npm manifest that names the entry point, the scripts and the four runtime dependencies (`package.json:1-16`).

## Role
The entry point is `src/server.js` (`package.json:5`). `npm start` runs it with node, and `npm test` runs the built-in node test runner on the `test/` folder (`package.json:6-9`). Dependencies are `express`, `jsonwebtoken`, `pg` and `dotenv` (`package.json:10-15`). The package is marked `private` (`package.json:4`).

## Where it has effect
- [`src/server.js`](../03_files/src/server.js.md) is the start script target (`package.json:7`).
- `express` is used in [`src/app.js`](../03_files/src/app.js.md) (`src/app.js:3`).
- `dotenv` is used in [`src/config.js`](../03_files/src/config.js.md) (`src/config.js:1`).
- `jsonwebtoken` is used in [`userService`](../03_files/src/services/userService.js.md) and the [`auth` middleware](../03_files/src/middleware/auth.js.md) (`src/middleware/auth.js:9`, `src/services/userService.js:13`).
- `pg` is used for the pool in [`src/db/index.js`](../03_files/src/db/index.js.md) (`src/db/index.js:4`).
- Tests: [`test/orderService.test.js`](../03_files/test/orderService.test.js.md) is picked up by the `test` script (`package.json:8`).
