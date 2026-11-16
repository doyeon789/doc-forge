# `src/services/userService.js`

> Based on: b430ebb
> Part of: [module services](../../../02_modules/services.md) · [Architecture](../../../01_architecture.md)

## In one line
User lookups: checks login credentials and returns a JWT, and finds a user by id (`src/services/userService.js:5-19`).

## Why it exists
It keeps user queries and token issuing in one place, used by the login route and by the mailer (`src/routes/users.js:8`, `src/services/mailer.js:10`).

## Key parts
- `login(email, password)`: loads the user by email and throws status 401 if the user is missing or the password differs. On success it signs a token with `id` and `email` that expires in 1 hour, using `jwtSecret` from config (`src/services/userService.js:5-14`).
- `findById(id)`: returns `{id, email}` or `null`. It does not select the password (`src/services/userService.js:16-19`).

## Connections
### Who calls this file
- [`src/routes/users.js`](../../../03_files/src/routes/users.js.md) calls `login` (`src/routes/users.js:8`).
- [`src/services/mailer.js`](../../../03_files/src/services/mailer.js.md) calls `findById` (`src/services/mailer.js:10`).

### What this file calls
- [`src/db/index.js`](../../../03_files/src/db/index.js.md) for `db.query` (`src/services/userService.js:6`, `src/services/userService.js:17`).
- [`src/config.js`](../../../03_files/src/config.js.md) for `jwtSecret` (`src/services/userService.js:13`).
- External library `jsonwebtoken` for `jwt.sign` (`src/services/userService.js:1`, `src/services/userService.js:13`).

### Hidden connections
- The token is made here but checked elsewhere, so the signing secret and payload shape must match the verifier. [`src/middleware/auth.js`](../../../03_files/src/middleware/auth.js.md) calls `jwt.verify` with the same `config.jwtSecret` and sets `req.user` (`src/middleware/auth.js:9`). The route reads `req.user.id` (`src/routes/orders.js:9`).

## Watch out when reading
- Passwords are compared as plain text (`user.password !== password`), so they appear to be stored unhashed (`src/services/userService.js:8`).
- The same 401 error is used for an unknown email and a wrong password (`src/services/userService.js:8-11`).
