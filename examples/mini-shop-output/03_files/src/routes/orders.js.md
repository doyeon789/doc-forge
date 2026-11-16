# `src/routes/orders.js`

> Based on: b430ebb
> Part of: [module routes](../../../02_modules/routes.md) · [Architecture](../../../01_architecture.md)

## In one line
Express router that exposes order creation and order listing, both for the logged-in user (`src/routes/orders.js:7-22`).

## Why it exists
It maps HTTP requests to `orderService` so the business logic stays out of the HTTP layer (`src/routes/orders.js:9`, `src/routes/orders.js:18`). Both endpoints sit behind the `auth` middleware, so `req.user.id` is always set before the service is called (`src/routes/orders.js:7`, `src/routes/orders.js:16`).

## Key parts
- `POST /orders`: creates an order from `req.body.items` (defaults to an empty array) and answers 201 with the order (`src/routes/orders.js:7-14`).
- `GET /orders`: returns the orders of the current user (`src/routes/orders.js:16-22`).
- Both handlers forward errors with `next(e)`, so the global error handler in `src/app.js` formats them (`src/routes/orders.js:11-13`, `src/app.js:10-12`).
- `module.exports = router` is the only export (`src/routes/orders.js:24`).

## Connections
### Who calls this file
- [`src/app.js`](../../../03_files/src/app.js.md) mounts it, but only through the directory scan described below (`src/app.js:8`).

### What this file calls
- [`src/middleware/auth.js`](../../../03_files/src/middleware/auth.js.md): authentication guard on both routes (`src/routes/orders.js:2`).
- [`src/services/orderService.js`](../../../03_files/src/services/orderService.js.md): `createOrder` and `listOrders` (`src/routes/orders.js:3`).
- External: `express` (`src/routes/orders.js:1`).

### Hidden connections
- Route registration: no file imports this router by name. `src/app.js` loads every file in `src/routes/` with a non-literal `require` (`src/app.js:8`). Adding or removing a file in that folder changes the API.

## Watch out when reading
- The routes are declared with full paths (`/orders`) and the router is mounted at the root, so there is no prefix to look for in `src/app.js` (`src/routes/orders.js:7`, `src/app.js:8`).
- The handler does not validate `items`; whatever the client sends goes to the service (`src/routes/orders.js:9`).
