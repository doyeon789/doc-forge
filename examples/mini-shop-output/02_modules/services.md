# module `services`

> Based on: b430ebb
> [Overview](../00_overview.md) · [Architecture](../01_architecture.md)

## In one line
Holds the business logic for users and orders, plus a mailer that reacts to new orders.

## Role
`userService` handles login and user lookup (`src/services/userService.js:5-19`), and `orderService` prices and stores orders (`src/services/orderService.js:5-28`). `mailer` is a listener: it subscribes to `order:created` and only logs a mail, because real SMTP is out of scope (`src/services/mailer.js:4-12`). Assumption: the files are grouped because they hold the domain logic that sits between routes and the DB, and `orderService` is the one that uses both the DB and the event bus (`src/services/orderService.js:1-2`). It does not handle HTTP: errors carry a `status` field for the caller to turn into a response (`src/services/orderService.js:10-12`).

## Files
- [`src/services/mailer.js`](../03_files/src/services/mailer.js.md): logs an order confirmation mail when `order:created` fires.
- [`src/services/orderService.js`](../03_files/src/services/orderService.js.md): prices and stores orders, lists them, and emits `order:created`.
- [`src/services/userService.js`](../03_files/src/services/userService.js.md): login with JWT issuing, and user lookup by id.

## Relations to other modules
- Uses [db](db.md): `orderService` and `userService` query through `db.query` (`src/services/orderService.js:16-19`, `src/services/userService.js:6`). `mailer` does not import `db`; it reaches the DB only indirectly through `userService.findById` (`src/services/mailer.js:1-2`, `src/services/mailer.js:10`).
- Uses [data](data.md): `orderService` looks up prices with `findProduct` from the catalog (`src/services/orderService.js:3`, `src/services/orderService.js:8`).
- Uses `src/config.js` (module [_root](_root.md)): `userService` signs tokens with `config.jwtSecret` (`src/services/userService.js:13`).
- Used by [routes](routes.md): `src/routes/users.js` and `src/routes/orders.js` import the services (`src/routes/users.js:2`, `src/routes/orders.js:3`).
- Hidden connection (event): `orderService` emits `order:created` on the shared bus `src/events.js` (`src/services/orderService.js:21`). `mailer` listens to it (`src/services/mailer.js:9`) and calls `userService.findById` to get the recipient (`src/services/mailer.js:10`).
- `mailer` is never imported by name. `src/server.js` loads it only for its side effect of registering the listener (`src/server.js:3`).

## Reading order for newcomers
1. `src/services/orderService.js`: the core flow of pricing, insert and event emit.
2. `src/services/mailer.js`: shows the event consumer side.
3. `src/services/userService.js`: login and the JWT.

## Watch out when reading
- If `mailer` is not required from `src/server.js`, no mail is logged, and nothing else fails (`src/server.js:3`).
- `login` compares the stored password to the input directly (`src/services/userService.js:8`). Assumption: this is a demo simplification, not hashing, since the query selects the `password` column as is (`src/services/userService.js:6`).
- The order is inserted before the event is emitted, and the emit does not wait for the async listener (`src/services/orderService.js:16-21`).
