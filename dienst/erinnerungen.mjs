// LifeVault-Erinnerungen per Web-Push – damit Erinnerungen auch bei geschlossener App ankommen.
//
// Läuft als GitHub Action im privaten Daten-Repo (lifevault-daten), etwa alle 30 Minuten
// (Workflow .github/workflows/erinnerungen.yml dort). Arbeitsordner = Daten-Repo:
//   data.json             Einträge der App (liest nur)
//   push/vapid.json       Push-Schlüssel, legt die App beim ersten „Push aktivieren“ an (liest nur)
//   push/geraete.json     Geräte mit Push-Abo, schreibt nur die App (liest nur)
//   push/status.json      Was schon gesendet wurde, tote Geräte, erledigte Tests – schreibt nur dieser Dienst
//
// Keine Abhängigkeiten: Verschlüsselung (RFC 8291, aes128gcm) und VAPID (RFC 8292) mit node:crypto.
// Die Erinnerungs-Regeln sind dieselben wie checkNotifications() in index.html (gleiche Schlüssel,
// gleiche Texte). Wer dort etwas ändert, zieht es hier mit.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';

process.env.TZ = process.env.TZ || 'Europe/Berlin';   // Uhrzeiten der Erinnerungen sind deutsche Ortszeit

const DIR = process.env.LV_DIR || process.cwd();
const VORLAUF = 30 * 60e3;          // so viel früher darf eine Erinnerung raus (der Dienst läuft alle 30 Min.)
const NACHLAUF = 3 * 3600e3;        // verspätete oder ausgefallene Läufe holen bis zu 3 Std. nach
const BEHALTEN = 60 * 864e5;        // Gesendet-Liste so lange aufheben (wie sv_notified in der App)
const TTL = 12 * 3600;              // so lange hält der Push-Dienst die Nachricht vor, falls das Gerät offline ist
const SUBJECT_FALLBACK = 'https://benschgo.github.io/LifeVault/';

/* ---------- Datum (wie in index.html) ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
function fmtDue(s, ref) {
  const d = daysBetween(ref, s);
  if (d === 0) return 'Heute';
  if (d === 1) return 'Morgen';
  if (d === -1) return 'Gestern';
  if (d < 0) return `vor ${-d} Tagen`;
  if (d < 7) return parseYmd(s).toLocaleDateString('de-DE', { weekday: 'long' });
  return parseYmd(s).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}
function eventOccursOn(e, dy) {
  if (!e.date || dy < e.date) return false;
  if (e.date === dy) return true;
  if (!e.repeat || e.repeat === 'once') return false;
  const start = parseYmd(e.date), d = parseYmd(dy);
  if (e.repeat === 'weekly') return Math.round((d - start) / 864e5) % 7 === 0;
  if (e.repeat === 'monthly') return d.getDate() === start.getDate();
  if (e.repeat === 'yearly') return d.getDate() === start.getDate() && d.getMonth() === start.getMonth();
  return false;
}
function nextOccurrence(e, fromYmd) {
  if (!e.date) return null;
  if (!e.repeat || e.repeat === 'once') return e.date >= fromYmd ? e.date : null;
  const d = parseYmd(fromYmd);
  for (let i = 0; i < 400; i++) {
    const dy = ymd(d);
    if (dy >= e.date && eventOccursOn(e, dy)) return dy;
    d.setDate(d.getDate() + 1);
  }
  return null;
}
function triggerTs(dateYmd, remindDays, timeHHMM) {
  if (remindDays == null || !dateYmd) return null;
  const d = parseYmd(dateYmd); d.setDate(d.getDate() - remindDays);
  const [hh, mm] = (timeHHMM || '08:00').split(':').map(Number);
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d.getTime();
}

/* ---------- Welche Erinnerungen gibt es? (nur die pro Eintrag eingestellten) ---------- */
export function erinnerungen(data, jetzt) {
  const live = k => (Array.isArray(data && data[k]) ? data[k] : []).filter(x => x && !x.deleted);
  const felder = new Map(live('fields').map(f => [f.id, f]));
  const heute = ymd(new Date(jetzt));
  const out = [];
  const add = (key, ts, titel, datum, fieldId, url) => {
    const f = fieldId ? felder.get(fieldId) : null;
    const ref = ymd(new Date(Math.max(jetzt, ts)));   // Text passend zum Zeitpunkt der Erinnerung
    out.push({ key, ts, title: titel, body: fmtDue(datum, ref) + (f ? ' · ' + f.name : ''), url });
  };
  live('todos').filter(t => !t.done && t.due).forEach(t => {
    const ts = triggerTs(t.due, t.remind, t.notifyTime);
    if (ts != null) add('t:' + t.id + ':' + t.due, ts, 'Aufgabe fällig: ' + t.title, t.due, t.fieldId, '#/todo');
  });
  live('exams').forEach(e => {
    const ts = triggerTs(e.date, e.remind, e.notifyTime);
    if (ts != null) add('e:' + e.id + ':' + e.date, ts, 'Arbeit: ' + e.title, e.date, e.fieldId, '#/cal');
  });
  live('events').forEach(e => {
    const occ = nextOccurrence(e, heute); if (!occ) return;
    const ts = triggerTs(occ, e.remind, e.notifyTime);
    if (ts != null) add('ev:' + e.id + ':' + occ, ts, 'Termin: ' + e.title, occ, e.fieldId, '#/cal');
  });
  return out;
}

/* ---------- Web-Push: Verschlüsselung (RFC 8291) ---------- */
export function verschluesseln(klartext, p256dh, auth, fest = {}) {
  const uaPublic = Buffer.from(p256dh, 'base64url');
  const authSecret = Buffer.from(auth, 'base64url');
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error('Schlüssel des Geräts ungültig');
  const ecdh = crypto.createECDH('prime256v1');
  if (fest.asPrivate) ecdh.setPrivateKey(fest.asPrivate); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = fest.salt || crypto.randomBytes(16);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(klartext), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const head = Buffer.alloc(21);
  salt.copy(head, 0); head.writeUInt32BE(4096, 16); head[20] = asPublic.length;
  return Buffer.concat([head, asPublic, ct]);
}

/* ---------- Web-Push: Absender-Ausweis (VAPID, RFC 8292) ---------- */
export function vapidJwt(aud, vapid, nowMs = Date.now()) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const sub = /^(https:|mailto:)/.test(vapid.subject || '') ? vapid.subject : SUBJECT_FALLBACK;
  const unsigned = b64({ typ: 'JWT', alg: 'ES256' }) + '.' + b64({ aud, exp: Math.floor(nowMs / 1000) + 12 * 3600, sub });
  const { x, y, d } = vapid.jwk;
  const key = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x, y, d }, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' });
  return unsigned + '.' + sig.toString('base64url');
}

const kurz = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
export const endpunktId = ep => crypto.createHash('sha256').update(String(ep)).digest('base64url').slice(0, 16);

async function senden(geraet, nachricht, vapid, jwtCache) {
  let aud, body;
  try {
    aud = new URL(geraet.endpoint).origin;
    body = verschluesseln(JSON.stringify(nachricht), geraet.keys.p256dh, geraet.keys.auth);
  } catch (e) { return { ok: false, dauerhaft: true, info: 'Abo unbrauchbar: ' + e.message }; }
  if (!jwtCache.has(aud)) jwtCache.set(aud, vapidJwt(aud, vapid));
  let r;
  try {
    r = await fetch(geraet.endpoint, {
      method: 'POST',
      headers: {
        TTL: String(TTL), Urgency: 'high',
        'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
        Authorization: `vapid t=${jwtCache.get(aud)}, k=${vapid.publicKey}`
      },
      body
    });
  } catch (e) { return { ok: false, dauerhaft: false, info: 'keine Verbindung (' + e.message + ')' }; }
  if (r.ok) return { ok: true };
  const text = (await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160);
  const info = `${new URL(geraet.endpoint).host} antwortet ${r.status}${text ? ': ' + text : ''}`;
  if (r.status === 404 || r.status === 410) return { ok: false, dauerhaft: true, tot: true, info };   // Abo abgelaufen/abgemeldet
  if ([400, 401, 403, 413].includes(r.status)) return { ok: false, dauerhaft: true, info };
  return { ok: false, dauerhaft: false, info };                                                 // 429, 5xx: nächster Lauf versucht es noch mal
}

/* ---------- Ablauf ---------- */
function lies(p, fallback) {
  try { return JSON.parse(readFileSync(join(DIR, p), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw new Error(p + ' ist kaputt: ' + e.message); }
}
const gueltig = g => g && typeof g.id === 'string' && /^https:\/\//.test(g.endpoint || '') && g.keys && g.keys.p256dh && g.keys.auth;
const warn = m => console.log('::warning::' + m);

export async function main(jetzt = Number(process.env.LV_NOW) || Date.now()) {
  const geraete = ((lies('push/geraete.json', {}) || {}).geraete || []).filter(gueltig);
  if (!geraete.length) { console.log('Kein Gerät hat Push aktiviert – nichts zu tun.'); return { gesendet: 0 }; }
  const vapid = lies('push/vapid.json', null);
  if (!vapid || !vapid.publicKey || !vapid.jwk || !vapid.jwk.d) throw new Error('push/vapid.json fehlt oder ist unvollständig – in LifeVault unter Optionen Push neu aktivieren');
  const alt = lies('push/status.json', null);
  const erstlauf = !alt;
  const st = { v: 1, gesendet: {}, tot: {}, test: {} };
  if (alt) for (const k of ['gesendet', 'tot', 'test']) if (alt[k] && typeof alt[k] === 'object') st[k] = alt[k];
  const iso = new Date(jetzt).toISOString();
  let geaendert = erstlauf, nGesendet = 0, nTest = 0, nFehler = 0;
  const jwtCache = new Map();
  const aktive = () => geraete.filter(g => !st.tot[endpunktId(g.endpoint)]);

  async function anAlle(liste, nachricht) {
    const res = await Promise.all(liste.map(async g => {
      const r = await senden(g, nachricht, vapid, jwtCache);
      if (r.tot) { st.tot[endpunktId(g.endpoint)] = iso; geaendert = true; console.log(`Gerät „${g.name || g.id}“ ist nicht mehr erreichbar (Abo abgelaufen) – wird übersprungen, bis es Push neu aktiviert.`); }
      else if (!r.ok) { nFehler++; warn(`Gerät „${g.name || g.id}“: ${r.info}`); }
      return r;
    }));
    return { einer: res.some(r => r.ok), erledigt: res.every(r => r.ok || r.dauerhaft) };
  }

  // 1. Testnachrichten (in der App unter Optionen angefordert)
  for (const g of aktive()) {
    if (!g.test || st.test[g.id] === g.test) continue;
    const r = await anAlle([g], { title: 'LifeVault: Push funktioniert', body: 'Deine Erinnerungen kommen jetzt auch, wenn die App geschlossen ist.', url: '#/settings', tag: 'lv-test', key: 'test:' + g.id + ':' + g.test });
    if (r.einer) nTest++;
    if (r.erledigt) { st.test[g.id] = g.test; geaendert = true; }
  }

  // 2. Fällige Erinnerungen
  const data = lies('data.json', null);
  for (const e of data ? erinnerungen(data, jetzt) : []) {
    if (st.gesendet[e.key] || e.ts > jetzt + VORLAUF) continue;
    if (erstlauf && e.ts <= jetzt) { st.gesendet[e.key] = iso; continue; }   // beim allerersten Lauf nichts Altes nachschicken
    if (e.ts < jetzt - NACHLAUF) continue;
    const ziel = aktive(); if (!ziel.length) break;
    const r = await anAlle(ziel, { title: kurz(e.title, 120), body: kurz(e.body, 160), url: e.url, tag: e.url + ':' + e.title, key: e.key });
    if (r.einer) nGesendet++;
    if (r.erledigt) { st.gesendet[e.key] = iso; geaendert = true; }
  }

  // 3. Aufräumen
  const grenze = jetzt - BEHALTEN;
  for (const [k, t] of Object.entries(st.gesendet)) if (!(Date.parse(t) >= grenze)) { delete st.gesendet[k]; geaendert = true; }
  const bekannt = new Set(geraete.map(g => endpunktId(g.endpoint)));
  for (const k of Object.keys(st.tot)) if (!bekannt.has(k)) { delete st.tot[k]; geaendert = true; }
  const ids = new Set(geraete.map(g => g.id));
  for (const k of Object.keys(st.test)) if (!ids.has(k)) { delete st.test[k]; geaendert = true; }

  if (geaendert) {
    mkdirSync(join(DIR, 'push'), { recursive: true });
    writeFileSync(join(DIR, 'push/status.json'), JSON.stringify(st, null, 1) + '\n');
  }
  console.log(`${aktive().length} von ${geraete.length} Gerät(en) erreichbar · ${nGesendet} Erinnerung(en) gesendet` +
    (nTest ? ` · ${nTest} Test(s)` : '') + (nFehler ? ` · ${nFehler} Fehler` : '') + (erstlauf ? ' · erster Lauf' : ''));
  return { gesendet: nGesendet, tests: nTest, fehler: nFehler, erstlauf };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.log('::error::' + e.message); process.exit(1); });
}
