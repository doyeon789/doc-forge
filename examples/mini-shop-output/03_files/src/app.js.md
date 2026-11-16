# `src/app.js`

> Based on: b430ebb
> Part of: [module _root](../../02_modules/_root.md) · [Architecture](../../01_architecture.md)

## In one line
Builds the Express app: JSON parsing, automatic route loading and a final error handler (`src/app.js:5-14`).

## Why it exists
It separates "what the app does" from "starting the server", so the app can be required without listening on a port. Assumption: this split is meant to make testing easier, since `listen` lives only in `src/server.js` (`src/server.js:5`).

## Key parts
- `app`: the Express instance, with `express.json()` so request bodies are parsed (`src/app.js:5-6`). It is the module's only export (`src/app.js:14`).
- Route loader: reads every file in `src/routes` and mounts each one with `app.use` (`src/app.js:8`). Adding a file to that folder registers it with no other change.
- Error handler: the last middleware. It answers with `err.status` or 500 and a JSON `{ error }` body (`src/app.js:10-12`).

## Connections
### Who calls this file
- [`src/server.js`](../../03_files/src/server.js.md) requires it and calls `listen` (`src/server.js:1`).

### What this file calls
- `express`, `fs` and `path` (`src/app.js:1-3`).
- Route modules in `src/routes`: [`orders`](../../03_files/src/routes/orders.js.md), [`products`](../../03_files/src/routes/products.js.md), [`users`](../../03_files/src/routes/users.js.md) (`src/app.js:8`).

### Hidden connections
- Reflection-like loading: `require('./routes/' + r)` has a non-literal argument, so no import of the route files appears anywhere. Each file in `src/routes` is connected to this file only through the directory listing (`src/app.js:8`).
- Errors passed to `next(err)` in the routes end up in the handler here (`src/app.js:10-12`).

## Watch out when reading
- Every file in `src/routes` is loaded, including any non-route file placed there, and each export must be usable by `app.use` (`src/app.js:8`).
- `readdirSync` order decides mount order, which matters if two routers use overlapping paths. Assumption: the order is alphabetical on most systems but not guaranteed (`src/app.js:8`).
- The error handler hides nothing: it returns `err.message` to the client (`src/app.js:11`).
