'use strict';
// File unico generato: contiene tutte le funzioni del negozio. Rotte: /api/<nome>
const __defs = {}, __cache = {};
function __req(n) { if (__cache[n]) return __cache[n].exports; const m = (__cache[n] = { exports: {} }); __defs[n](m, m.exports); return m.exports; }
__defs['config'] = function (module, exports) {
'use strict';
// Catalogo prodotti. Gli ID dei prezzi Stripe si impostano come variabili d'ambiente su Netlify.
const PRODUCTS = {
  ARF:             { name: 'ARF',             plans: { month: 'STRIPE_PRICE_ARF_MONTH', year: 'STRIPE_PRICE_ARF_YEAR' } },
  MONITORAGGIO:    { name: 'MONITORAGGIO',    plans: { year: 'STRIPE_PRICE_MONITORAGGIO_YEAR' } },
  ESISTENZA_VITA:  { name: 'ESISTENZA_VITA',  plans: { year: 'STRIPE_PRICE_ESISTENZA_VITA_YEAR' } }
};
const MAX_OPERATORS = 200;
function priceId(env, sku, plan) {
  const p = PRODUCTS[sku]; if (!p || !p.plans[plan]) return null;
  return env[p.plans[plan]] || null;
}
module.exports = { PRODUCTS, MAX_OPERATORS, priceId };

};
__defs['dates'] = function (module, exports) {
'use strict';
// Date contrattuali (art. 8-9). Tutti i calcoli sono in ora di Roma.
function romeStart(y, m, d) { // m: 0-11 ; ritorna secondi UNIX della mezzanotte di Roma
  for (const off of [1, 2]) {
    const t = Date.UTC(y, m, d, 0 - off, 0, 0);
    const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(new Date(t));
    if (h === '00') return Math.floor(t / 1000);
  }
  return Math.floor(Date.UTC(y, m, d, -1) / 1000);
}
function romeParts(date) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const g = (t) => +f.find((x) => x.type === t).value;
  return { y: g('year'), m: g('month') - 1, d: g('day') };
}
// Prima data di rinnovo: annuale 1 gennaio successivo; mensile 1° del mese successivo
function renewalAnchor(plan, now) {
  const p = romeParts(now);
  return plan === 'year' ? romeStart(p.y + 1, 0, 1) : romeStart(p.y, p.m + 1, 1);
}
// Data di cessazione a seguito di disdetta (secondi UNIX, mezzanotte del giorno successivo all'ultimo giorno di validità)
function cancelEffective(plan, now) {
  const p = romeParts(now);
  if (plan === 'year') {
    const beforeDeadline = p.m < 10 || (p.m === 10 && p.d <= 30); // entro il 30 novembre
    return romeStart(p.y + (beforeDeadline ? 1 : 2), 0, 1);
  }
  return romeStart(p.y, p.m + (p.d <= 15 ? 1 : 2), 1); // entro il 15 del mese
}
function toIso(sec) { return new Date(sec * 1000).toISOString(); }
module.exports = { renewalAnchor, cancelEffective, romeStart, romeParts, toIso };

};
__defs['tokens'] = function (module, exports) {
'use strict';
const crypto = require('crypto');
const b64 = (b) => Buffer.from(b).toString('base64url');
function sign(payload, secret, ttlSec, now) {
  const body = b64(JSON.stringify(Object.assign({}, payload, { exp: Math.floor((now || Date.now()) / 1000) + ttlSec })));
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(token, secret, now) {
  if (!token || typeof token !== 'string' || !secret) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const exp = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(exp);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!p.exp || p.exp < Math.floor((now || Date.now()) / 1000)) return null;
    return p;
  } catch (e) { return null; }
}
module.exports = { sign, verify };

};
__defs['validate'] = function (module, exports) {
'use strict';
// Codice fiscale italiano: persone fisiche (16 car.) e soggetti giuridici (11 cifre, controllo come P.IVA)
const ODD = { 0:1,1:0,2:5,3:7,4:9,5:13,6:15,7:17,8:19,9:21,A:1,B:0,C:5,D:7,E:9,F:13,G:15,H:17,I:19,J:21,K:2,L:4,M:18,N:20,O:11,P:3,Q:6,R:8,S:12,T:14,U:16,V:10,W:22,X:25,Y:24,Z:23 };
function cfPersona(cf) {
  if (!/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cf)) return false;
  let s = 0;
  for (let i = 0; i < 15; i++) { const c = cf[i]; s += i % 2 === 0 ? ODD[c] : (/\d/.test(c) ? +c : c.charCodeAt(0) - 65); }
  return String.fromCharCode(65 + (s % 26)) === cf[15];
}
function luhn11(v) {
  if (!/^\d{11}$/.test(v)) return false;
  let s = 0;
  for (let i = 0; i < 11; i++) { let n = +v[i]; if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; } s += n; }
  return s % 10 === 0;
}
function codiceFiscale(v) {
  v = String(v || '').toUpperCase().replace(/\s+/g, '');
  return cfPersona(v) || luhn11(v);
}
function email(v) { return typeof v === 'string' && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
module.exports = { codiceFiscale, email, luhn11, cfPersona };

};
__defs['stripe'] = function (module, exports) {
'use strict';
const crypto = require('crypto');
// Client Stripe minimale via REST (nessuna dipendenza). `fetchImpl` iniettabile per i test.
function encode(obj, prefix, out) {
  out = out || [];
  Object.keys(obj).forEach((k) => {
    const v = obj[k]; if (v === undefined || v === null) return;
    const key = prefix ? prefix + '[' + k + ']' : k;
    if (Array.isArray(v)) v.forEach((x, i) => (x && typeof x === 'object') ? encode(x, key + '[' + i + ']', out) : out.push([key + '[' + i + ']', x]));
    else if (typeof v === 'object') encode(v, key, out);
    else out.push([key, v]);
  });
  return out;
}
function client(secretKey, fetchImpl) {
  const f = fetchImpl || fetch;
  async function call(method, path, params) {
    const pairs = params ? encode(params) : [];
    const body = pairs.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    const url = 'https://api.stripe.com/v1' + path + (method === 'GET' && body ? '?' + body : '');
    const res = await f(url, { method, headers: { Authorization: 'Bearer ' + secretKey, 'Content-Type': 'application/x-www-form-urlencoded' }, body: method === 'GET' ? undefined : body });
    const json = await res.json();
    if (!res.ok) { const e = new Error((json.error && json.error.message) || 'Stripe error'); e.status = res.status; throw e; }
    return json;
  }
  return { get: (p, q) => call('GET', p, q), post: (p, b) => call('POST', p, b), del: (p) => call('DELETE', p) };
}
// Verifica firma webhook (header Stripe-Signature), tolleranza 5 minuti
function verifyWebhook(rawBody, header, secret, now) {
  if (!header || !secret) return false;
  const parts = {}; header.split(',').forEach((p) => { const [k, v] = p.split('='); (parts[k] = parts[k] || []).push(v); });
  const t = parts.t && parts.t[0]; if (!t || !parts.v1) return false;
  if (Math.abs((now || Date.now()) / 1000 - +t) > 300) return false;
  const exp = crypto.createHmac('sha256', secret).update(t + '.' + rawBody).digest('hex');
  return parts.v1.some((s) => s.length === exp.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(exp)));
}
module.exports = { client, verifyWebhook, encode };

};
__defs['store'] = function (module, exports) {
'use strict';
// Archivio chiave/valore. In produzione usa Netlify Blobs; nei test si inietta una Map.
function memory() {
  const m = new Map();
  return { get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), set: async (k, v) => { m.set(k, JSON.stringify(v)); }, _m: m };
}
function blobs() {
  let s = null; // connessione creata solo al primo uso
  const st = () => (s = s || require('@netlify/blobs').getStore('gm-shop'));
  return { get: async (k) => st().get(k, { type: 'json' }), set: async (k, v) => { await st().setJSON(k, v); } };
}
module.exports = { memory, blobs };

};
__defs['email'] = function (module, exports) {
'use strict';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Invio via Resend REST. Se manca la chiave, non invia (ritorna false) e il sito continua a funzionare.
async function send(env, fetchImpl, { to, subject, html }) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) return false;
  const res = await (fetchImpl || fetch)('https://api.resend.com/emails', { method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.RESEND_FROM, to: Array.isArray(to) ? to : [to], subject, html }) });
  return res.ok;
}
module.exports = { send, esc };

};
__defs['ctx'] = function (module, exports) {
'use strict';
// Dipendenze condivise; i test sostituiscono `ctx.override`.
const stripeLib = __req('stripe');
const storeLib = __req('store');
const ctx = { override: null };
function deps() {
  if (ctx.override) return ctx.override;
  const env = process.env;
  return { env, stripe: stripeLib.client(env.STRIPE_SECRET_KEY), store: storeLib.blobs(), fetch, now: () => Date.now() };
}
function json(status, obj) { return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) }; }
function siteUrl(env) { return (env.SITE_URL || '').replace(/\/+$/, ''); }
module.exports = { ctx, deps, json, siteUrl };

};
__defs['auth'] = function (module, exports) {
'use strict';
const tokens = __req('tokens');
function who(event, d) {
  const h = event.headers || {};
  const t = h['x-token'] || h['X-Token'];
  const p = tokens.verify(t, d.env.AUTH_SECRET, d.now());
  return p && p.k === 'acct' ? p.email : null;
}
async function ownLicence(d, email, id) {
  const l = id && await d.store.get('licences/' + id);
  return l && l.email === email ? l : null;
}
module.exports = { who, ownLicence };

};
__defs['catalogo'] = function (module, exports) {
'use strict';
const { deps, json } = __req('ctx');
const { PRODUCTS, priceId } = __req('config');
// GET /api/catalogo -> prezzi unitari (per Operatore Finanziario, IVA esclusa) letti da Stripe
exports.handler = async () => {
  const d = deps(); const out = {};
  try {
    for (const sku of Object.keys(PRODUCTS)) {
      out[sku] = {};
      for (const plan of Object.keys(PRODUCTS[sku].plans)) {
        const id = priceId(d.env, sku, plan);
        if (!id) continue;
        const p = await d.stripe.get('/prices/' + id);
        out[sku][plan] = { amount: p.unit_amount, currency: p.currency };
      }
    }
    return json(200, { products: out, publishableKey: d.env.STRIPE_PUBLISHABLE_KEY || null, termsVersion: d.env.TERMS_VERSION || null });
  } catch (e) { return json(502, { error: 'catalogo_non_disponibile' }); }
};

};
__defs['checkout'] = function (module, exports) {
'use strict';
const { deps, json, siteUrl } = __req('ctx');
const { PRODUCTS, MAX_OPERATORS, priceId } = __req('config');
const V = __req('validate');
const D = __req('dates');
const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n || 200);
// POST /api/checkout -> crea la sessione Stripe Checkout (incorporata) e salva la Dichiarazione Operatori
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'metodo' });
  const d = deps(); let b;
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'json' }); }
  const sku = b.sku, plan = b.plan, c = b.company || {}, ops = Array.isArray(b.operators) ? b.operators : [];
  if (!PRODUCTS[sku] || !PRODUCTS[sku].plans[plan]) return json(400, { error: 'prodotto' });
  if (b.accept !== true) return json(400, { error: 'accettazione' });
  const company = { name: clean(c.name), cf: clean(c.cf, 16).toUpperCase().replace(/\s/g, ''), vat: clean(c.vat, 20), address: clean(c.address, 300), pec: clean(c.pec), email: clean(c.email), ref: clean(c.ref) };
  if (!company.name || !company.address || !company.ref) return json(400, { error: 'dati_cliente' });
  if (!V.email(company.email)) return json(400, { error: 'email' });
  if (!V.codiceFiscale(company.cf)) return json(400, { error: 'cf_cliente' });
  if (!ops.length || ops.length > MAX_OPERATORS) return json(400, { error: 'operatori' });
  const seen = new Set(); const operators = [];
  for (const o of ops) {
    const cf = clean(o.cf, 16).toUpperCase().replace(/\s/g, ''), name = clean(o.name);
    if (!name || !V.codiceFiscale(cf)) return json(400, { error: 'cf_operatore', detail: name || cf });
    if (seen.has(cf)) return json(400, { error: 'cf_duplicato', detail: cf });
    seen.add(cf); operators.push({ name, cf });
  }
  const id = priceId(d.env, sku, plan);
  if (!id || !siteUrl(d.env)) return json(503, { error: 'non_configurato' });
  try {
    const price = await d.stripe.get('/prices/' + id);
    if (!price.recurring || price.recurring.interval !== plan) return json(500, { error: 'prezzo_non_valido' });
    const n = operators.length, now = new Date(d.now());
    const anchor = D.renewalAnchor(plan, now);
    const tax = d.env.STRIPE_AUTOMATIC_TAX === '1';
    const session = await d.stripe.post('/checkout/sessions', {
      ui_mode: d.env.STRIPE_UI_MODE || 'embedded', mode: 'subscription', customer_email: company.email,
      line_items: [
        { price: id, quantity: n },
        { price_data: { currency: price.currency, product: price.product, unit_amount: price.unit_amount * n, tax_behavior: 'exclusive' }, quantity: 1 }
      ],
      subscription_data: { trial_end: anchor, metadata: { sku, plan, operators: String(n), azienda: company.name.slice(0, 100) } },
      billing_address_collection: 'required', tax_id_collection: { enabled: true },
      automatic_tax: tax ? { enabled: true } : undefined,
      metadata: { sku, plan, operators: String(n) },
      return_url: siteUrl(d.env) + '/?session_id={CHECKOUT_SESSION_ID}#/grazie'
    });
    await d.store.set('pending/' + session.id, { sku, plan, company, operators, createdAt: now.toISOString(), accepted: { at: now.toISOString(), version: b.termsVersion || null } });
    return json(200, { clientSecret: session.client_secret, sessionId: session.id, firstPeriodEndsAt: D.toIso(anchor) });
  } catch (e) { return json(502, { error: 'stripe', message: e.message }); }
};

};
__defs['stripe-webhook'] = function (module, exports) {
'use strict';
const crypto = require('crypto');
const { deps, json, siteUrl } = __req('ctx');
const { verifyWebhook } = __req('stripe');
const mail = __req('email');
function newKey(sku) {
  const g = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return 'GM-' + sku.slice(0, 3) + '-' + g() + g() + '-' + g() + g() + '-' + g() + g();
}
async function onCompleted(d, s) {
  if (s.mode !== 'subscription' || s.payment_status !== 'paid') return;
  const pending = await d.store.get('pending/' + s.id);
  if (!pending) return;
  const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription && s.subscription.id;
  if (!subId || await d.store.get('licences/' + subId)) return; // idempotente
  const email = (pending.company.email || '').toLowerCase();
  const lic = { id: subId, sku: pending.sku, plan: pending.plan, key: newKey(pending.sku), customer: s.customer, sessionId: s.id, email,
    company: pending.company, operators: pending.operators, accepted: pending.accepted, status: 'active', createdAt: new Date(d.now()).toISOString() };
  await d.store.set('licences/' + subId, lic);
  const idx = (await d.store.get('customers/' + email)) || { subs: [] };
  if (!idx.subs.includes(subId)) idx.subs.push(subId);
  await d.store.set('customers/' + email, idx);
  const url = siteUrl(d.env) + '/#/account';
  await mail.send(d.env, d.fetch, { to: email, subject: 'GM – Licenza ' + lic.sku + ': pagamento ricevuto',
    html: '<p>Grazie. Il pagamento è stato ricevuto.</p><p><strong>Programma:</strong> ' + mail.esc(lic.sku) + '<br><strong>Operatori Finanziari:</strong> ' + lic.operators.length + '<br><strong>Chiave di licenza:</strong> ' + lic.key +
      '</p><p>Puoi scaricare il programma dall\'area clienti: <a href="' + url + '">' + url + '</a> (accesso con link inviato via email).</p>' });
  if (d.env.ADMIN_EMAIL) await mail.send(d.env, d.fetch, { to: d.env.ADMIN_EMAIL, subject: 'Nuovo acquisto ' + lic.sku + ' – ' + pending.company.name,
    html: '<p>' + mail.esc(pending.company.name) + ' (' + mail.esc(pending.company.cf) + ')<br>' + mail.esc(lic.sku) + ' / ' + lic.plan + ' / ' + lic.operators.length + ' operatori<br>Sub: ' + subId + '</p><ul>' +
      lic.operators.map((o) => '<li>' + mail.esc(o.name) + ' – ' + mail.esc(o.cf) + '</li>').join('') + '</ul>' });
}
async function setStatus(d, subId, status) {
  const l = await d.store.get('licences/' + subId); if (!l) return;
  l.status = status; l.updatedAt = new Date(d.now()).toISOString(); await d.store.set('licences/' + subId, l);
}
exports.handler = async (event) => {
  const d = deps();
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body || '';
  const sig = event.headers && (event.headers['stripe-signature'] || event.headers['Stripe-Signature']);
  if (!verifyWebhook(raw, sig, d.env.STRIPE_WEBHOOK_SECRET, d.now())) return json(400, { error: 'firma' });
  let ev; try { ev = JSON.parse(raw); } catch (e) { return json(400, { error: 'json' }); }
  try {
    const o = ev.data.object;
    if (ev.type === 'checkout.session.completed') await onCompleted(d, o);
    else if (ev.type === 'customer.subscription.deleted') await setStatus(d, o.id, 'ended');
    else if (ev.type === 'customer.subscription.updated') await setStatus(d, o.id, o.status === 'canceled' ? 'ended' : o.status === 'past_due' || o.status === 'unpaid' ? 'suspended' : 'active');
    else if (ev.type === 'invoice.payment_failed' && d.env.ADMIN_EMAIL) await mail.send(d.env, d.fetch, { to: d.env.ADMIN_EMAIL, subject: 'Pagamento non riuscito', html: '<p>Fattura ' + mail.esc(o.id) + ' – cliente ' + mail.esc(o.customer_email || o.customer) + '</p>' });
    return json(200, { received: true });
  } catch (e) { return json(500, { error: 'elaborazione' }); }
};

};
__defs['account-link'] = function (module, exports) {
'use strict';
const { deps, json, siteUrl } = __req('ctx');
const tokens = __req('tokens');
const mail = __req('email');
const V = __req('validate');
// POST /api/account-link {email} -> invia un link di accesso (risposta sempre uguale, per non rivelare chi è cliente)
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'metodo' });
  const d = deps(); let email;
  try { email = String(JSON.parse(event.body || '{}').email || '').trim().toLowerCase(); } catch (e) { return json(400, { error: 'json' }); }
  if (!V.email(email)) return json(400, { error: 'email' });
  try {
    const idx = await d.store.get('customers/' + email);
    if (idx && d.env.AUTH_SECRET) {
      const t = tokens.sign({ email, k: 'acct' }, d.env.AUTH_SECRET, 2 * 3600, d.now());
      const link = siteUrl(d.env) + '/#/account?t=' + t;
      await mail.send(d.env, d.fetch, { to: email, subject: 'GM – Accesso all\'area clienti', html: '<p>Per accedere alla tua area clienti usa questo link (valido 2 ore):</p><p><a href="' + link + '">Accedi</a></p><p>Se non hai richiesto l\'accesso, ignora questo messaggio.</p>' });
    }
  } catch (e) { /* risposta neutra */ }
  return json(200, { ok: true });
};

};
__defs['account'] = function (module, exports) {
'use strict';
const { deps, json } = __req('ctx');
const { who } = __req('auth');
const D = __req('dates');
// GET /api/account (header x-token) -> licenze del cliente
exports.handler = async (event) => {
  const d = deps(); const email = who(event, d);
  if (!email) return json(401, { error: 'accesso' });
  const idx = (await d.store.get('customers/' + email)) || { subs: [] };
  const out = [];
  for (const id of idx.subs) {
    const l = await d.store.get('licences/' + id); if (!l) continue;
    let sub = null; try { sub = await d.stripe.get('/subscriptions/' + id); } catch (e) {}
    const item = sub && sub.items && sub.items.data && sub.items.data[0];
    const next = sub ? (sub.trial_end && sub.status === 'trialing' ? sub.trial_end : (item && item.current_period_end) || sub.current_period_end) : null;
    out.push({ id, sku: l.sku, plan: l.plan, key: l.key, operators: l.operators, company: l.company.name, status: sub ? sub.status : l.status,
      nextRenewal: next ? D.toIso(next) : null, endsAt: sub && sub.cancel_at ? D.toIso(sub.cancel_at) : null,
      cancelIfNow: D.toIso(D.cancelEffective(l.plan, new Date(d.now()))) });
  }
  return json(200, { email, licences: out });
};

};
__defs['download'] = function (module, exports) {
'use strict';
const { deps, json } = __req('ctx');
const { who, ownLicence } = __req('auth');
// GET /api/download?licence=sub_... (header x-token) -> URL firmato (5 min) dell'installer, solo a pagamento avvenuto (art. 8.8)
exports.handler = async (event) => {
  const d = deps(); const email = who(event, d);
  if (!email) return json(401, { error: 'accesso' });
  const l = await ownLicence(d, email, event.queryStringParameters && event.queryStringParameters.licence);
  if (!l) return json(404, { error: 'licenza' });
  let status = l.status;
  try { status = (await d.stripe.get('/subscriptions/' + l.id)).status; } catch (e) {}
  if (!['active', 'trialing'].includes(status)) return json(403, { error: 'licenza_non_attiva' });
  const path = d.env['DOWNLOAD_PATH_' + l.sku], base = d.env.SUPABASE_URL, bucket = d.env.SUPABASE_BUCKET || 'installers';
  if (!path || !base || !d.env.SUPABASE_SERVICE_KEY) return json(503, { error: 'file_non_disponibile' });
  const res = await d.fetch(base + '/storage/v1/object/sign/' + bucket + '/' + path, { method: 'POST',
    headers: { Authorization: 'Bearer ' + d.env.SUPABASE_SERVICE_KEY, apikey: d.env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 300 }) });
  if (!res.ok) return json(502, { error: 'file_non_disponibile' });
  const j = await res.json();
  return json(200, { url: base + '/storage/v1' + j.signedURL });
};

};
__defs['cancel'] = function (module, exports) {
'use strict';
const { deps, json } = __req('ctx');
const { who, ownLicence } = __req('auth');
const D = __req('dates');
const mail = __req('email');
// POST /api/cancel {licence, action:'cancel'|'resume'} -> disdetta secondo artt. 9: annuale entro 30/11 (effetto 1/1); ARF mensile entro il 15 (effetto fine mese, altrimenti fine mese successivo)
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'metodo' });
  const d = deps(); const email = who(event, d);
  if (!email) return json(401, { error: 'accesso' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'json' }); }
  const l = await ownLicence(d, email, b.licence);
  if (!l) return json(404, { error: 'licenza' });
  try {
    if (b.action === 'resume') {
      await d.stripe.post('/subscriptions/' + l.id, { cancel_at: '' });
      return json(200, { endsAt: null });
    }
    const at = D.cancelEffective(l.plan, new Date(d.now()));
    await d.stripe.post('/subscriptions/' + l.id, { cancel_at: at });
    const iso = D.toIso(at);
    await mail.send(d.env, d.fetch, { to: email, subject: 'GM – Disdetta registrata', html: '<p>La disdetta della licenza ' + mail.esc(l.sku) + ' è stata registrata. La licenza resterà valida fino al ' + iso.slice(0, 10) + ' compreso.</p>' });
    if (d.env.ADMIN_EMAIL) await mail.send(d.env, d.fetch, { to: d.env.ADMIN_EMAIL, subject: 'Disdetta ' + l.sku + ' – ' + l.company.name, html: '<p>Sub ' + l.id + ' valida fino al ' + iso.slice(0, 10) + ' compreso (cessa ' + iso + ')</p>' });
    return json(200, { endsAt: iso });
  } catch (e) { return json(502, { error: 'stripe', message: e.message }); }
};

};
__defs['portal'] = function (module, exports) {
'use strict';
const { deps, json, siteUrl } = __req('ctx');
const { who, ownLicence } = __req('auth');
// POST /api/portal {licence} -> Customer Portal Stripe (solo carta e fatture)
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'metodo' });
  const d = deps(); const email = who(event, d);
  if (!email) return json(401, { error: 'accesso' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'json' }); }
  const l = await ownLicence(d, email, b.licence);
  if (!l || !l.customer) return json(404, { error: 'licenza' });
  try {
    const s = await d.stripe.post('/billing_portal/sessions', { customer: l.customer, return_url: siteUrl(d.env) + '/#/account' });
    return json(200, { url: s.url });
  } catch (e) { return json(502, { error: 'stripe', message: e.message }); }
};

};
const NAMES = ["catalogo","checkout","stripe-webhook","account-link","account","download","cancel","portal"];
exports.__req = __req;
exports.handler = async (event, context) => {
  const src = (event.rawUrl || '') + ' ' + (event.path || '');
  const m = /\/(catalogo|checkout|stripe-webhook|account-link|account|download|cancel|portal)(?=[/?\s]|$)/.exec(src);
  if (!m) return { statusCode: 404, body: '{"error":"rotta"}' };
  try { require('@netlify/blobs').connectLambda(event); } catch (e) { /* senza Blobs: solo le rotte che non lo usano */ }
  return __req(m[1]).handler(event, context);
};
