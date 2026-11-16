# `src/server.js`

> Based on: b430ebb
> Part of: [module _root](../../02_modules/_root.md) · [Architecture](../../01_architecture.md)

## In one line
Process entry point: wires the app, config and mailer together and starts listening (`src/server.js:1-7`).

## Role
It is the `main` file and the `npm start` target (`package.json:5`, `package.json:7`). It requires [`app`](../../03_files/src/app.js.md) and [`config`](../../03_files/src/config.js.md), then calls `app.listen` on `config.port` and logs the port (`src/server.js:1-7`). It also requires the mailer only for its side effect (`src/server.js:3`).

## Where it has effect
- Started by [`package.json`](../../03_files/package.json.md) (`package.json:7`).
- Hidden connection: `require('./services/mailer')` has no variable, because loading it registers an `order:created` listener on the shared bus (`src/server.js:3`, `src/services/mailer.js:9`). See [`mailer`](../../03_files/src/services/mailer.js.md) and [`src/events.js`](../../03_files/src/events.js.md). If this line were removed, order emails would silently stop.
- Tests do not load this file, so the mailer is not registered in them: the test requires only the db stub, `events`, `orderService` and fixtures (`test/orderService.test.js:4-11`), and `orderService` never requires the mailer (`src/services/orderService.js:1-3`).
