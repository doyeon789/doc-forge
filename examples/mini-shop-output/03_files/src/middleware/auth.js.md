# `src/middleware/auth.js`

> Based on: b430ebb
> Part of: [module middleware](../../../02_modules/middleware.md) · [Architecture](../../../01_architecture.md)

## In one line
Express middleware that requires a valid Bearer JWT and puts the decoded payload on `req.user` (`src/middleware/auth.js:4-14`).

## Why it exists
Without it, protected routes would have no way to know who the caller is, so order handlers could not scope data to a user. It rejects unauthenticated requests before the handler runs (`src/middleware/auth.js:7`, `src/middleware/auth.js:11-13`).

## Key parts
- `auth(req, res, next)` is the only export. It reads the `Authorization` header, strips the `Bearer ` prefix, and answers 401 with `missing token` if no token is present (`src/middleware/auth.js:5-7`).
- It verifies the token with the secret from config. On success it sets `req.user` and calls `next()`. On any verification error it answers 401 with `invalid token` (`src/middleware/auth.js:8-13`).

## Connections
### Who calls this file
- [`src/routes/orders.js`](../../../03_files/src/routes/orders.js.md) imports it and applies it to `POST /orders` and `GET /orders` (`src/routes/orders.js:2`, `src/routes/orders.js:7`, `src/routes/orders.js:16`).

### What this file calls
- [`src/config.js`](../../../03_files/src/config.js.md) supplies `jwtSecret` (`src/middleware/auth.js:2`, `src/middleware/auth.js:9`).
- External library `jsonwebtoken` does the verification (`src/middleware/auth.js:1`).

### Hidden connections
- Config binding: `config.jwtSecret` comes from the `JWT_SECRET` environment variable (value `***`) (`src/config.js:5`). `src/services/userService.js` does not use the name `JWT_SECRET`; it signs tokens with the same `config.jwtSecret` field (`src/services/userService.js:13`), and `.env` also defines `JWT_SECRET` (`.env`). Assumption: `userService` signs the tokens that this middleware verifies, so both must use the same secret (`src/middleware/auth.js:9`).
- Implicit contract: handlers read `req.user.id`, which exists only because this middleware ran first (`src/routes/orders.js:9`, `src/routes/orders.js:18`).

## Watch out when reading
- Any verification failure, including expiry, gives the same `invalid token` 401 because the caught error is not inspected (`src/middleware/auth.js:11-13`).
- If `JWT_SECRET` is unset, `config.jwtSecret` is `undefined` (`src/config.js:5`). Assumption: `jwt.verify` then fails and every request gets 401, since no fallback or startup check is visible (`src/middleware/auth.js:9`).
