# Payment confirmation deployment

The guest return page asks the API to verify the saved PayRex Checkout Session
directly. The API marks a payment as paid only when PayRex reports a completed
session and a succeeded PHP payment intent whose amount and reservation
metadata match the database. This verification also retries sending the
confirmation email if a previous email attempt failed.

Configure these values in the PHP/Apache environment or hosting control panel;
do not put credentials in frontend code or commit them to the repository:

- `STAYEASE_DB_HOST`, `STAYEASE_DB_USER`, `STAYEASE_DB_PASSWORD`, and
  `STAYEASE_DB_NAME`: MySQL connection settings. They default to the local XAMPP
  setup (`localhost`, `root`, an empty password, and `stayease`) when omitted.
- `PAYREX_SECRET_KEY`: the PayRex secret key for the environment in use.
- `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID`: credentials for payment
  confirmation email.
- `STAYEASE_FRONTEND_URL`: the public HTTPS URL of the customer-facing app,
  without a trailing slash. PayRex uses it for checkout success and cancel
  redirects.
- `STAYEASE_ALLOWED_ORIGINS`: comma-separated customer app origins allowed to
  call the API, including scheme and host, with no trailing slash. For example,
  configure the production origin and any local development origin needed.
- `GOOGLE_CLIENT_ID`: the Google OAuth 2.0 Web application client ID. Set the
  same client ID in the PHP server and the frontend's `VITE_GOOGLE_CLIENT_ID`.

- `PAYREX_WEBHOOK_SECRET`: configure this if using PayRex webhooks as an
  additional confirmation path.

## Google sign-in setup

Create an OAuth 2.0 Client ID of type **Web application** in Google Cloud
Console. Add each frontend origin under **Authorized JavaScript origins** (for
example `http://localhost:5173`, `http://127.0.0.1:5173`, and the production
HTTPS origin). Google Identity Services returns its credential to the frontend;
the backend validates the token signature, issuer, audience, expiry, email
verification, and per-login nonce before starting the existing guest session.
No Google client secret or redirect URI is needed for this sign-in flow.

For Vite, set `VITE_GOOGLE_CLIENT_ID` in `StayEase/.env.local` before running
Vite or building the frontend. Configure the identical value as
`GOOGLE_CLIENT_ID` in the PHP server environment. The client ID is public; do
not put private API credentials in `VITE_*` variables. Restart/rebuild the
frontend and restart Apache after changing environment configuration.

For the webhook backup, configure PayRex to send `payment_intent.succeeded` to
`https://<your-domain>/stayease-api/stayease.php?action=payrex-webhook`. The
signed-in browser return verification does not depend on PayRex being able to
reach this webhook, but a public HTTPS endpoint lets webhooks confirm payments
when a guest does not return to the site.
