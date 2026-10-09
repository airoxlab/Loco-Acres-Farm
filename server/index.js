/* Loco Acres Farm — website and holiday bird order endpoint.
 *
 * Serves the static site from the repo root (with a real 404 page and a
 * www -> apex redirect), and accepts POST /api/holiday-order from the order form on the holiday page and
 * sends two emails through Resend: the order to Joe, and a confirmation to the
 * customer (when they gave an email). Also accepts POST /api/holiday-waitlist
 * for the "let me know when orders open" box shown after the season closes.
 *
 * No dependencies — Node 18+ only (uses built-in fetch).
 *
 * Environment:
 *   RESEND_API_KEY   required   Resend API key
 *   HOST_EMAIL       optional   where orders go     (default locoacresfarm@yahoo.com)
 *   FROM_EMAIL       optional   verified sender     (default Loco Acres Farm <orders@airoxlab.com>)
 *   PORT             optional   listen port         (default 3000)
 *   ALLOWED_ORIGIN   optional   CORS origin allow-list, comma separated
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const SITE_ROOT = path.resolve(__dirname, '..');
const CANONICAL_HOST = process.env.CANONICAL_HOST || 'locoacresfarm.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const HOST_EMAIL = process.env.HOST_EMAIL || 'locoacresfarm@yahoo.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Loco Acres Farm <orders@airoxlab.com>';
const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN ||
  'https://locoacresfarm.com,https://www.locoacresfarm.com')
  .split(',').map(s => s.trim()).filter(Boolean);

const PHONE = '419-917-1706';
const ADDRESS = '1760 Woodville Rd, Millbury, OH 43447';
const DEPOSIT = 20;
const BIRDS = { Turkey: '$5/lb', Goose: '$9/lb', Duck: '$7/lb' };
const HOLIDAYS = {
  Thanksgiving: 'Pickup starts Monday, November 23',
  Christmas: 'Pickup on Monday, December 21',
};

/* ---------- helpers ---------- */

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function send(res, status, obj, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(obj));
}

const birdLine = b => `${b.qty} × ${b.bird}${b.size ? `, about ${b.size} lb` : ', any size'}`;

/* ---------- email templates ---------- */

const SHELL = (title, preheader, inner) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#F3E9D2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3E9D2;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFCF3;border:1px solid #DFCFA4;border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
${inner}
<tr><td style="background:#F3E9D2;padding:18px 28px;border-top:1px solid #DFCFA4;font-size:12px;line-height:1.6;color:#6E5F45;text-align:center">
Loco Acres Farm &middot; Joe &amp; Margie Kill<br>
${esc(ADDRESS)} &middot; <a href="tel:+14199171706" style="color:#C77B21;text-decoration:none">${esc(PHONE)}</a>
</td></tr>
</table></td></tr></table></body></html>`;

const HEADER = subtitle => `<tr><td style="background:#4A3216;padding:22px 28px">
<div style="font-size:19px;font-weight:700;color:#FFFCF3">Loco Acres Farm</div>
<div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#E9C27A;margin-top:3px">${esc(subtitle)}</div>
</td></tr>`;

function row(label, value, accent) {
  if (!value) return '';
  return `<tr>
<td style="padding:9px 0;border-bottom:1px solid #F3E9D2;font-size:13px;color:#6E5F45;width:36%;vertical-align:top">${esc(label)}</td>
<td style="padding:9px 0;border-bottom:1px solid #F3E9D2;font-size:15px;color:${accent ? '#A35A10' : '#33220E'};font-weight:${accent ? '700' : '500'};vertical-align:top">${esc(value)}</td>
</tr>`;
}

function hostEmail(d) {
  const count = d.birds.reduce((n, b) => n + b.qty, 0);
  const inner = `${HEADER('New holiday order')}
<tr><td style="padding:26px 28px 6px">
<p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#4A3216">${esc(d.name)} ordered ${count} bird${count === 1 ? '' : 's'} for ${esc(d.holiday)}</p>
<p style="margin:0;font-size:15px;color:#6E5F45">${esc(HOLIDAYS[d.holiday])}</p>
</td></tr>
<tr><td style="padding:14px 28px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${d.birds.map((b, i) => row(i ? '' : 'Birds', birdLine(b), true)).join('')}
${row('Deposit due', `$${count * DEPOSIT} ($${DEPOSIT} per bird, paid through Square)`)}
${row('Phone', d.phone)}
${row('Email', d.email)}
</table></td></tr>
${d.notes ? `<tr><td style="padding:14px 28px 0">
<div style="font-size:13px;color:#6E5F45;margin-bottom:6px">Notes</div>
<div style="background:#FBF3E1;border-left:3px solid #C77B21;border-radius:0 8px 8px 0;padding:13px 15px;font-size:15px;color:#33220E;line-height:1.6">${esc(d.notes).replace(/\n/g, '<br>')}</div>
</td></tr>` : ''}
<tr><td style="padding:22px 28px 26px">
<a href="tel:${esc(d.phone.replace(/[^\d+]/g, ''))}" style="background:#C77B21;color:#FFFCF3;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;font-size:15px;display:inline-block">Call ${esc(d.name.split(' ')[0])}</a>
<a href="sms:${esc(d.phone.replace(/[^\d+]/g, ''))}" style="color:#A35A10;text-decoration:none;font-weight:600;font-size:15px;padding:12px 10px;display:inline-block">Or text them</a>
<p style="margin:14px 0 0;font-size:13px;color:#6E5F45">Check your Square app to confirm the deposit came through.</p>
</td></tr>`;
  return SHELL('New holiday order', `${d.name}: ${d.birds.map(birdLine).join('; ')}`, inner);
}

function customerEmail(d) {
  const count = d.birds.reduce((n, b) => n + b.qty, 0);
  const inner = `${HEADER('Order received')}
<tr><td style="padding:26px 28px 6px">
<p style="margin:0 0 10px;font-size:20px;font-weight:700;color:#4A3216">Thanks, ${esc(d.name.split(' ')[0])}! We have your ${esc(d.holiday)} order.</p>
<p style="margin:0;font-size:15px;line-height:1.65;color:#33220E">Your order is held once your $${count * DEPOSIT} deposit ($${DEPOSIT} per bird) is paid through Square. Orders are filled in the order they are received, and we can't guarantee an exact size. Questions? Call <a href="tel:+14199171706" style="color:#A35A10;font-weight:600;text-decoration:none">${esc(PHONE)}</a>.</p>
</td></tr>
<tr><td style="padding:18px 28px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${d.birds.map((b, i) => row(i ? '' : 'Your order', `${birdLine(b)} (${BIRDS[b.bird]})`, true)).join('')}
${row('Pickup', HOLIDAYS[d.holiday])}
${row('Where', ADDRESS + ' (local pickup only)')}
</table></td></tr>
<tr><td style="padding:20px 28px 26px;font-size:14px;line-height:1.6;color:#6E5F45">
The final price is set by the weight of your bird at pickup, less your deposit.
</td></tr>`;
  return SHELL(`Your ${d.holiday} order at Loco Acres Farm`, `Pickup: ${HOLIDAYS[d.holiday]}`, inner);
}

function waitlistEmail(d) {
  const inner = `${HEADER('Holiday order list')}
<tr><td style="padding:26px 28px 26px">
<p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#4A3216">${esc(d.name || 'Someone')} wants to hear when holiday orders open</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row('Phone', d.phone, true)}
${row('Interested in', d.notes)}
</table></td></tr>`;
  return SHELL('Holiday order list', `${d.name || ''} ${d.phone}`, inner);
}

/* ---------- Resend ---------- */

async function sendMail(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Resend ${r.status}: ${JSON.stringify(body)}`);
  return body;
}

/* ---------- static site ---------- */

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
};
const COMPRESS = new Set(['.html', '.css', '.js', '.json', '.xml', '.txt', '.svg', '.webmanifest']);
// Never serve these, even though they sit in the repo.
const PRIVATE = /^\/(server|screenshots|google-product-photos|node_modules)(\/|$)|\/\.|^\/(README\.md|CNAME|package(-lock)?\.json|Dockerfile)$/i;

function serveFile(req, res, file, status) {
  const ext = path.extname(file).toLowerCase();
  const headers = {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=604800',
    'X-Content-Type-Options': 'nosniff',
  };
  const gzip = COMPRESS.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (gzip) { headers['Content-Encoding'] = 'gzip'; headers['Vary'] = 'Accept-Encoding'; }
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(file);
  stream.on('error', () => res.end());
  (gzip ? stream.pipe(zlib.createGzip()) : stream).pipe(res);
}

function notFound(req, res) {
  const page = path.join(SITE_ROOT, '404.html');
  if (fs.existsSync(page)) return serveFile(req, res, page, 404);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function serveStatic(req, res) {
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]); } catch { return notFound(req, res); }
  if (urlPath.includes('\0') || PRIVATE.test(urlPath)) return notFound(req, res);

  const file = path.resolve(SITE_ROOT, '.' + urlPath);
  if (file !== SITE_ROOT && !file.startsWith(SITE_ROOT + path.sep)) return notFound(req, res);

  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      // /raw-honey-millbury-ohio -> /raw-honey-millbury-ohio/ so relative links resolve
      if (!urlPath.endsWith('/')) {
        const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        res.writeHead(301, { Location: urlPath + '/' + q });
        return res.end();
      }
      const index = path.join(file, 'index.html');
      return fs.stat(index, (e2, st2) => (!e2 && st2.isFile() ? serveFile(req, res, index, 200) : notFound(req, res)));
    }
    if (!err && st.isFile()) return serveFile(req, res, file, 200);
    notFound(req, res);
  });
}

/* ---------- server ---------- */

const clean = (v, n = 1000) => String(v == null ? '' : v).trim().slice(0, n);

function parseOrder(d) {
  const birds = (Array.isArray(d.birds) ? d.birds : []).slice(0, 10).map(b => ({
    bird: clean(b && b.bird, 20),
    qty: Math.max(1, Math.min(20, parseInt(b && b.qty, 10) || 1)),
    size: clean(b && b.size, 20).replace(/[^\d.\-– ]/g, ''),
  })).filter(b => BIRDS[b.bird]);
  return {
    holiday: clean(d.holiday, 20), name: clean(d.name, 120), phone: clean(d.phone, 40),
    email: clean(d.email, 200), notes: clean(d.notes, 2000), birds,
  };
}

const server = http.createServer((req, res) => {
  // One address for Google: www.locoacresfarm.com -> locoacresfarm.com
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0].toLowerCase();
  if (host === 'www.' + CANONICAL_HOST) {
    res.writeHead(301, { Location: `https://${CANONICAL_HOST}${req.url}` });
    return res.end();
  }

  // Everything that isn't the API is the website.
  if (!req.url.startsWith('/api/') && (req.method === 'GET' || req.method === 'HEAD')) {
    return serveStatic(req, res);
  }

  const origin = req.headers.origin;
  const allowed = origin && ALLOWED_ORIGIN.includes(origin) ? origin : null;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': allowed || ALLOWED_ORIGIN[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    });
    return res.end();
  }

  if (req.method === 'GET' && (req.url === '/health' || req.url === '/api/health')) {
    return send(res, 200, { ok: true, configured: Boolean(RESEND_API_KEY) }, allowed);
  }

  const isOrder = req.url.startsWith('/api/holiday-order');
  const isWaitlist = req.url.startsWith('/api/holiday-waitlist');
  if (req.method !== 'POST' || !(isOrder || isWaitlist)) {
    return send(res, 404, { error: 'Not found' }, allowed);
  }

  let raw = '';
  let tooBig = false;
  req.on('data', c => {
    raw += c;
    if (raw.length > 20000) { tooBig = true; req.destroy(); }
  });

  req.on('end', async () => {
    if (tooBig) return send(res, 413, { error: 'Too large' }, allowed);

    let d;
    try { d = JSON.parse(raw || '{}'); } catch { return send(res, 400, { error: 'Bad JSON' }, allowed); }

    // Honeypot: real customers never fill this hidden field.
    if (d.website) return send(res, 200, { ok: true }, allowed);

    const data = parseOrder(d);
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set');
      return send(res, 500, { error: 'Orders are not configured on the server.' }, allowed);
    }

    try {
      if (isWaitlist) {
        if (!data.phone) return send(res, 400, { error: 'Please add a phone number.' }, allowed);
        await sendMail({ from: FROM_EMAIL, to: [HOST_EMAIL], subject: `Holiday order list — ${data.name || data.phone}`, html: waitlistEmail(data) });
        return send(res, 200, { ok: true }, allowed);
      }

      const missing = [];
      if (!HOLIDAYS[data.holiday]) missing.push('holiday');
      if (!data.birds.length) missing.push('bird');
      if (!data.name) missing.push('name');
      if (!data.phone) missing.push('phone');
      if (missing.length) return send(res, 400, { error: 'Missing: ' + missing.join(', ') }, allowed);
      if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
        return send(res, 400, { error: 'That email address does not look right.' }, allowed);
      }

      const count = data.birds.reduce((n, b) => n + b.qty, 0);
      await sendMail({
        from: FROM_EMAIL,
        to: [HOST_EMAIL],
        ...(data.email ? { reply_to: data.email } : {}),
        subject: `${data.holiday} order — ${data.name} — ${data.birds.map(birdLine).join('; ')}`,
        html: hostEmail(data),
      });

      // Customer confirmation is a courtesy: never fail the order over it.
      if (data.email) {
        try {
          await sendMail({
            from: FROM_EMAIL,
            to: [data.email],
            reply_to: HOST_EMAIL,
            subject: `Your ${data.holiday} order at Loco Acres Farm`,
            html: customerEmail(data),
          });
        } catch (e) {
          console.error('customer confirmation failed:', e.message);
        }
      }

      return send(res, 200, { ok: true, deposit: count * DEPOSIT, birds: count }, allowed);
    } catch (e) {
      console.error('order send failed:', e.message);
      return send(res, 502, { error: 'Could not send right now.' }, allowed);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Loco Acres holiday order API on :${PORT}`);
  if (!RESEND_API_KEY) console.warn('WARNING: RESEND_API_KEY not set — sends will fail.');
});
