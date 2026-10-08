# Loco Acres Farm — holiday order API

Plain Node, zero dependencies. Receives the holiday bird order form from
`/holiday-turkey-goose-duck-preorder/` and emails the order to Joe
(locoacresfarm@yahoo.com), plus a confirmation to the customer if they gave an email.
The $20-per-bird deposit is paid separately through Joe's Square link; this service
never touches payments.

## Deploy

Point any Docker-capable host (Coolify, Dokploy, Railway, Render) at this repo with
`server/` as the build context, then set one environment variable:

| Variable | Required | Default |
|---|---|---|
| `RESEND_API_KEY` | **yes** | — |
| `HOST_EMAIL` | no | `locoacresfarm@yahoo.com` |
| `FROM_EMAIL` | no | `Loco Acres Farm <orders@airoxlab.com>` |
| `PORT` | no | `3000` |
| `ALLOWED_ORIGIN` | no | `https://locoacresfarm.com,https://www.locoacresfarm.com` |

`FROM_EMAIL` must be on a Resend-verified domain (`airoxlab.com` is verified).
Never put the Resend key in the website's HTML or JavaScript.

## Routing

The form posts to `/api/holiday-order` on the site's own origin, so `/api/` on
`locoacresfarm.com` must be proxied to this container (nginx `location /api/ { proxy_pass http://127.0.0.1:<port>; }`).

## Verify

    curl https://locoacresfarm.com/api/health
    # {"ok":true,"configured":true}

## Endpoints

- `POST /api/holiday-order` — JSON `{holiday, birds:[{bird, qty, size}], name, phone, email?, notes?, website}`
  where `holiday` is `Thanksgiving` or `Christmas` and `bird` is `Turkey`, `Goose` or `Duck`.
- `POST /api/holiday-waitlist` — JSON `{name?, phone, notes?}` for the off-season "tell me when orders open" box.
- `GET /api/health`

## If the API is down

The form doesn't lose the order: it falls back to opening a pre-filled text message
to Joe (419-917-1706) from the customer's phone, then shows the Square deposit button.

## Each year

Update the dates in the `HOLIDAY` config at the top of the order script in
`holiday-turkey-goose-duck-preorder/index.html`, and `HOLIDAYS` in `index.js`.
After the Christmas deadline the form switches itself off and shows the waitlist box.
