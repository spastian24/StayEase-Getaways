# StayEase

StayEase is a React/Vite hotel reservation app with a PHP/MySQL API.

## Local development

1. Install Node.js, PHP 8.2+, MySQL, and the PHP `mysqli`, `mysqlnd`, `openssl`,
   and `curl` extensions.
2. Create the `stayease` database and tables using
   [`stayease-api/database-setup.sql`](./stayease-api/database-setup.sql).
3. Serve the `stayease-api` directory from Apache at
   `http://localhost/stayease-api`.
4. Run `npm install` and `npm run dev` from the project directory.

The API uses XAMPP-compatible database defaults. For other environments, set
`STAYEASE_DB_HOST`, `STAYEASE_DB_USER`, `STAYEASE_DB_PASSWORD`, and
`STAYEASE_DB_NAME` on the PHP server.

## Production build

Run `npm run build`; publish the contents of `dist` from the same HTTPS host as
the `stayease-api` directory. The API path must remain `/stayease-api`.
Configure API credentials as server-side environment variables, not in the
frontend. See [`stayease-api/DEPLOYMENT.md`](./stayease-api/DEPLOYMENT.md) for
database, PayRex payment verification/webhook, email, allowed-origin, and
optional Google sign-in configuration.

`.env` files, dependencies, build output, and local credentials are excluded
from Git. Create local environment files as needed; never commit provider
secrets.
