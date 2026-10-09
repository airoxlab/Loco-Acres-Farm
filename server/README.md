# Loco Acres Farm — server

One zero-dependency Node server (`server/index.js`) runs the whole site:

- **The website:** static files from the repo root, gzip for text, a real `404.html` for
  missing pages, `www.locoacresfarm.com` → `locoacresfarm.com` 301, and folder URLs
  without a trailing slash 301'd to the slash version. `server/`, `.git`, `screenshots/`,
  `README.md` and similar are never served.
- **The holiday order API:** emails each order to Joe (locoacresfarm@yahoo.com) and a
  confirmation to the customer through Resend. The $20-per-bird deposit is paid
  separately through Joe's Square link; this server never touches payments.

## Deploy

Deploy the repo root as a Node app (`npm start`) or with the root `Dockerfile`.
It listens on `PORT` (default 3000). Point `locoacresfarm.com` and `www.locoacresfarm.com`
at it. No separate nginx static config or `/api/` proxy rule is needed.

| Variable | Required | Default |
|---|---|---|
| `RESEND_API_KEY` | **yes** | — |
| `HOST_EMAIL` | no | `locoacresfarm@yahoo.com` |
| `FROM_EMAIL` | no | `Loco Acres Farm <orders@airoxlab.com>` |
| `PORT` | no | `3000` |
| `CANONICAL_HOST` | no | `locoacresfarm.com` |
| `ALLOWED_ORIGIN` | no | `https://locoacresfarm.com,https://www.locoacresfarm.com` |

`FROM_EMAIL` must be on a Resend-verified domain (`airoxlab.com` is verified).
Never put the Resend key in the repo or in any HTML/JS — only in the host's environment.

## Verify

    curl https://locoacresfarm.com/api/health        # {"ok":true,"configured":true}
    curl -I https://locoacresfarm.com/nope            # HTTP/1.1 404
    curl -I https://www.locoacresfarm.com/            # 301 -> https://locoacresfarm.com/

`configured: false` means `RESEND_API_KEY` never reached the process.

## Endpoints

- `POST /api/holiday-order` — JSON `{holiday, birds:[{bird, qty, size}], name, phone, email?, notes?, website}`
  where `holiday` is `Thanksgiving` or `Christmas` and `bird` is `Turkey`, `Goose` or `Duck`.
- `POST /api/holiday-waitlist` — JSON `{name?, phone, notes?}` for the off-season "tell me when orders open" box.
- `GET /api/health`

## If the API is down

The form doesn't lose the order: it falls back to a pre-filled text message to Joe
(419-917-1706) from the customer's phone, then shows the Square deposit button.

## Each year

Update the dates in the `HOLIDAY` config at the top of the order script in
`holiday-turkey-goose-duck-preorder/index.html`, and `HOLIDAYS` in `server/index.js`.
After the Christmas deadline the form switches itself off and shows the waitlist box.
