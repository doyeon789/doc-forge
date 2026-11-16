# `src/routes/users.js`

> Based on: b430ebb
> Part of: [module routes](../../../02_modules/routes.md) · [Architecture](../../../01_architecture.md)

## In one line
Express router with the single `POST /login` endpoint that returns an auth token (`src/routes/users.js:6-13`).

## Why it exists
It is the entry point for obtaining the token that protected routes expect, delegating the credential check to `userService` (`src/routes/users.js:8`).

## Key parts
- `POST /login`: passes `email` and `password` from the body to `userService.login` and returns `{ token }` (`src/routes/users.js:6-13`).
- Failures go to `next(e)` and end up in the global error handler (`src/routes/users.js:10-12`, `src/app.js:10-12`).

## Connections
### Who calls this file
- [`src/app.js`](../../../03_files/src/app.js.md) mounts it through the directory scan (`src/app.js:8`).

### What this file calls
- [`src/services/userService.js`](../../../03_files/src/services/userService.js.md): `login` (`src/routes/users.js:2`).
- External: `express` (`src/routes/users.js:1`).

### Hidden connections
- Route registration: loaded by the non-literal `require('./routes/' + r)` in `src/app.js` (`src/app.js:8`).
- Token consumer: Assumption: the returned token is what the `auth` middleware checks on `/orders`, since `/orders` is the only guarded route here (`src/routes/orders.js:7`). See [`src/middleware/auth.js`](../../../03_files/src/middleware/auth.js.md).

## Watch out when reading
- The router has no input validation; missing `email` or `password` reach the service as `undefined` (`src/routes/users.js:8`).
- The file is named `users.js` but only contains login (`src/routes/users.js:6`).
