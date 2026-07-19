#!/usr/bin/env node
// QR v2 signing keys (FEATURE_BATCH_2 A5).
//
// Generates an ed25519 keypair once:
//   * private key (PKCS8, base64)  → edge function secret QR_SIGNING_KEY
//   * public key (raw 32B, base64) → settings.qr_public_key (read by every
//     authenticated client; ships with the checker roster bundle)
//
// Idempotent: refuses to overwrite an existing QR_SIGNING_KEY unless
// --rotate is passed (rotation invalidates passes signed with the old key
// the moment checkers refresh their roster).
//
// Usage: SUPABASE_PROJECT_REF=... SUPABASE_ACCESS_TOKEN=... node scripts/setup-qr-keys.mjs [--rotate]

import { generateKeyPairSync } from 'node:crypto';

const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!REF || !TOKEN) {
  console.error('Missing env: SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}
const rotate = process.argv.includes('--rotate');
const api = 'https://api.supabase.com/v1/projects/' + REF;
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const secretsRes = await fetch(`${api}/secrets`, { headers: auth });
if (!secretsRes.ok) throw new Error(`list secrets ${secretsRes.status}: ${await secretsRes.text()}`);
const existing = (await secretsRes.json()).some((s) => s.name === 'QR_SIGNING_KEY');
if (existing && !rotate) {
  console.log('QR_SIGNING_KEY already set — nothing to do (use --rotate to replace it).');
  process.exit(0);
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const pkcs8B64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
// SPKI for ed25519 = 12-byte algorithm prefix + the raw 32-byte key.
const spki = publicKey.export({ type: 'spki', format: 'der' });
const publicB64 = spki.subarray(spki.length - 32).toString('base64');

const setRes = await fetch(`${api}/secrets`, {
  method: 'POST', headers: auth,
  body: JSON.stringify([{ name: 'QR_SIGNING_KEY', value: pkcs8B64 }]),
});
if (!setRes.ok) throw new Error(`set secret ${setRes.status}: ${await setRes.text()}`);

const q = await fetch(`${api}/database/query`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    query: `insert into settings (key, value) values ('qr_public_key', '"${publicB64}"'::jsonb)
            on conflict (key) do update set value = excluded.value;`,
  }),
});
if (!q.ok) throw new Error(`settings upsert ${q.status}: ${await q.text()}`);

console.log(`QR signing key ${existing ? 'rotated' : 'installed'}.`);
console.log(`public key (settings.qr_public_key): ${publicB64}`);
