# `src/routes/products.js`

> Based on: b430ebb
> Part of: [module routes](../../../02_modules/routes.md) · [Architecture](../../../01_architecture.md)

## In one line
Express router with the public, read-only product catalog endpoints (`src/routes/products.js:6-14`).

## Why it exists
It exposes the in-memory catalog over HTTP without touching a service layer, and needs no login (`src/routes/products.js:2`, `src/routes/products.js:6`).

## Key parts
- `GET /products`: returns at most the first 50 products (`src/routes/products.js:6-8`).
- `GET /products/:sku`: looks the product up with `findProduct` and answers 404 with `{ error: 'not found' }` when missing (`src/routes/products.js:10-14`).

## Connections
### Who calls this file
- [`src/app.js`](../../../03_files/src/app.js.md) mounts it through the directory scan (`src/app.js:8`).

### What this file calls
- [`src/data/catalog.js`](../../../03_files/src/data/catalog.js.md): `products` and `findProduct` (`src/routes/products.js:2`).
- External: `express` (`src/routes/products.js:1`).

### Hidden connections
- Route registration: loaded by the non-literal `require('./routes/' + r)` in `src/app.js` (`src/app.js:8`). No explicit import exists.

## Watch out when reading
- The 50-item cap is hard-coded and there is no paging parameter, so products after the 50th are not reachable from the list (`src/routes/products.js:7`).
- Unlike the other routers, these handlers have no `try/catch` or `next`; they rely on `findProduct` not throwing (`src/routes/products.js:10-14`).
