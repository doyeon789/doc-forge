# module `middleware`

> Based on: b430ebb
> [Overview](../00_overview.md) · [Architecture](../01_architecture.md)

## In one line
Holds the Express middleware that rejects requests without a valid Bearer JWT (`src/middleware/auth.js:4-14`).

## Role
The module has one file, `auth`. It reads the `Authorization` header and answers 401 with `missing token` when there is no Bearer token (`src/middleware/auth.js:5-7`). It verifies the token with the secret from `config.jwtSecret` and stores the decoded payload in `req.user` (`src/middleware/auth.js:9`). A failed verification answers 401 with `invalid token` (`src/middleware/auth.js:11-13`). It does not issue tokens and does not check roles or permissions.

## Files
- [`src/middleware/auth.js`](../03_files/src/middleware/auth.js.md): middleware that verifies the Bearer JWT, sets `req.user`, or answers 401.

## Relations to other modules
- Used by [routes](../02_modules/routes.md): `src/routes/orders.js` imports it and puts it in front of `POST /orders` and `GET /orders` (`src/routes/orders.js:2`, `src/routes/orders.js:7`, `src/routes/orders.js:16`).
- Uses the root module [_root](../02_modules/_root.md): the signing secret comes from `config.jwtSecret` in `src/config.js` (`src/middleware/auth.js:2`, `src/middleware/auth.js:9`). `config.jwtSecret` is read from the `JWT_SECRET` env var (`src/config.js:5`). That value is not shown here.

## Reading order for newcomers
1. [`src/middleware/auth.js`](../03_files/src/middleware/auth.js.md): the whole module is 14 lines (`src/middleware/auth.js:1-14`).
2. `src/routes/orders.js`: shows how it is attached per route (`src/routes/orders.js:7`).

## Watch out when reading
- Only routes that list `auth` as an argument are protected, so it is not applied globally (`src/routes/orders.js:7`, `src/routes/orders.js:16`).
- Both failure cases return 401, including an expired token, because every `jwt.verify` error is caught the same way (`src/middleware/auth.js:11-13`).
