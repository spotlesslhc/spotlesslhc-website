// Local test rig for /book: serves the site on :8795 (/x -> x.html) and a mock of
// the Hermes booking API on :8796. Point BOOKING_API in book.html at
// http://localhost:8796/webhooks/booking while testing (never commit that).
// POST behaviour by name: contains "taken" -> 409, "bad" -> 400, "rate" -> 429, "down" -> 503,
// "drop" -> connection dropped; booking a slot twice -> 409; missing fields -> 400.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.xml': 'application/xml' };

http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  if (!path.extname(p)) p += '.html';
  try {
    const body = await readFile(path.join(ROOT, path.normalize(p)));
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(8795, () => console.log('site  http://localhost:8795'));

const taken = new Set();
const ymd = (d) => d.toISOString().slice(0, 10);
const send = (res, status, obj) => res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }).end(JSON.stringify(obj));

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && url.pathname === '/webhooks/booking/availability') {
    const n = Math.min(parseInt(url.searchParams.get('days')) || 45, 60), days = [];
    for (let i = 1; i <= n; i++) {
      const d = new Date(); d.setUTCDate(d.getUTCDate() + i);
      const date = ymd(d), sun = d.getUTCDay() === 0;
      const open = (w) => !sun && i !== 4 && !(w === 'morning' && i % 3 === 0) && !taken.has(date + '|' + w);
      days.push({ date, morning: open('morning'), afternoon: open('afternoon') });
    }
    return send(res, 200, { days });
  }
  if (req.method === 'POST' && url.pathname === '/webhooks/booking') {
    let raw = '';
    req.on('data', (c) => raw += c);
    req.on('end', () => {
      let b; try { b = JSON.parse(raw); } catch { return send(res, 400, { error: 'Invalid request.' }); }
      console.log('POST /webhooks/booking', JSON.stringify(b));
      const name = String(b.name || '');
      if (name.includes('drop')) return req.socket.destroy();
      if (name.includes('bad')) return send(res, 400, { error: 'That date is outside the booking window.' });
      if (name.includes('rate')) return send(res, 429, { error: 'Too many requests.' });
      if (name.includes('down')) return send(res, 503, { error: 'Unavailable.' });
      if (b.website) return send(res, 201, { ok: true, bookingId: 'hp', date: b.date, window: b.window, message: 'Thanks!' });
      if (!b.date || !['morning', 'afternoon'].includes(b.window) || !name.trim() || !b.phone || !b.address)
        return send(res, 400, { error: 'Please add your name, phone and address.' });
      const key = b.date + '|' + b.window;
      if (name.includes('taken') || taken.has(key)) { taken.add(key); return send(res, 409, { code: 'taken' }); }
      taken.add(key);
      send(res, 201, { ok: true, bookingId: 'mock-' + Date.now(), date: b.date, window: b.window, message: "Thanks! You're booked. Bryce will text you shortly to confirm the details." });
    });
    return;
  }
  send(res, 404, { error: 'Not found.' });
}).listen(8796, () => console.log('api   http://localhost:8796'));
