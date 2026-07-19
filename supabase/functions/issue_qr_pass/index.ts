// issue_qr_pass — dynamic QR passes (FEATURE_BATCH_2 A5).
//
// The signed pass is what kills screenshot sharing: it expires after a
// short TTL (settings.qr_pass_ttl_seconds, default 600) and checkers
// verify the ed25519 signature OFFLINE against the public key bundled
// with their roster cache.
//
// POST (student JWT required) → { pass, iat, exp, ttl }
//   pass = "QP1.<student_id>.<iat>.<exp>.<sig_b64url>"
//   signature is over the UTF-8 string "<student_id>.<iat>.<exp>"
// Static-mode students get 409 { static: true } — the app falls back to
// the printed/static QR. Deactivated QR → 403.

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const b64ToBytes = (b64: string) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const bytesToB64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let signingKey: CryptoKey | null = null;
async function getSigningKey(): Promise<CryptoKey> {
  if (signingKey) return signingKey;
  const pkcs8 = Deno.env.get('QR_SIGNING_KEY');
  if (!pkcs8) throw new Error('QR_SIGNING_KEY secret is not set');
  signingKey = await crypto.subtle.importKey(
    'pkcs8', b64ToBytes(pkcs8), { name: 'Ed25519' }, false, ['sign'],
  );
  return signingKey;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: caller } = await admin.auth.getUser(jwt);
  if (!caller?.user) return json(401, { error: 'not signed in' });

  const { data: student } = await admin
    .from('students')
    .select('id, qr_mode, qr_active, active')
    .eq('profile_id', caller.user.id)
    .single();
  if (!student || !student.active) {
    return json(404, { error: 'No roster record is linked to this account.' });
  }
  if (!student.qr_active) {
    return json(403, { error: 'Your QR is deactivated — please see the SG office.' });
  }
  if (student.qr_mode !== 'dynamic') {
    return json(409, { error: 'This account uses a static QR.', static: true });
  }

  const { data: ttlRow } = await admin
    .from('settings').select('value').eq('key', 'qr_pass_ttl_seconds').single();
  const ttl = Math.max(30, parseInt(String(ttlRow?.value ?? '600').replace(/"/g, ''), 10) || 600);

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttl;
  const message = `${student.id}.${iat}.${exp}`;
  const key = await getSigningKey();
  const sig = new Uint8Array(
    await crypto.subtle.sign('Ed25519', key, new TextEncoder().encode(message)),
  );

  return json(200, { pass: `QP1.${message}.${bytesToB64url(sig)}`, iat, exp, ttl });
});
