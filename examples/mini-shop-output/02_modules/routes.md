# module `routes`

> Based on: b430ebb
> [Overview](../00_overview.md) · [Architecture](../01_architecture.md)

## In one line
Defines the HTTP endpoints (login, products, orders) as Express routers that hand the real work to services and data modules.

## Role
Each file exports one `express.Router` and contains only request parsing, calling a service or the catalog, and shaping the response (`src/routes/orders.js:5-24`, `src/routes/products.js:4-16`, `src/routes/users.js:4-15`). Business logic is not here: the order and user routes delegate to the services (`src/routes/orders.js:3`, `src/routes/users.js:2`), while the product routes read the catalog data module directly (`src/routes/products.js:2`). Errors from async handlers are passed to `next(e)` so the global error handler in `src/app.js` answers them (`src/routes/users.js:10-12`, `src/app.js:10-12`). The files are grouped together because `src/app.js` mounts every file in this folder automatically (`src/app.js:8`).

## Files
- [`src/routes/orders.js`](../03_files/src/routes/orders.js.md): authenticated `POST /orders` and `GET /orders` for the current user.
- [`src/routes/products.js`](../03_files/src/routes/products.js.md): public `GET /products` and `GET /products/:sku`.
- [`src/routes/users.js`](../03_files/src/routes/users.js.md): `POST /login`, returns a token.

## Relations to other modules
- Uses [middleware](../02_modules/middleware.md): the `auth` middleware guards both order routes and supplies `req.user.id` (`src/routes/orders.js:2`, `src/routes/orders.js:7`).
- Uses [services](../02_modules/services.md): `orderService.createOrder` / `listOrders` and `userService.login` (`src/routes/orders.js:9`, `src/routes/orders.js:18`, `src/routes/users.js:8`).
- Uses [data](../02_modules/data.md): the product routes read `products` and `findProduct` from the catalog directly, with no service in between (`src/routes/products.js:2`).
- Hidden connection: the app entry point loads every file in `src/routes` through `fs.readdirSync` and `require`, so there is no import of these files anywhere (`src/app.js:8`). The entry point belongs to the module documented in [_root](../02_modules/_root.md).

## Reading order for newcomers
1. `src/app.js` (see above): shows how routers are mounted and how errors are handled (`src/app.js:8-12`).
2. [`src/routes/users.js`](../03_files/src/routes/users.js.md): the smallest router, the pattern the others follow.
3. [`src/routes/orders.js`](../03_files/src/routes/orders.js.md): adds the `auth` middleware.

## Watch out when reading
- Adding any file to `src/routes` mounts it automatically, and a non-router file there would break startup (`src/app.js:8`).
- Routers are mounted at the root without a prefix, so paths such as `/orders` come from the route definitions themselves (`src/routes/orders.js:7`).
- `GET /products` returns at most 50 items and has no paging parameters (`src/routes/products.js:7`).
- `POST /orders` falls back to an empty item list when `items` is missing (`src/routes/orders.js:9`).
- Only the products route handles "not found" itself with a 404; other errors rely on the global handler (`src/routes/products.js:12`).
