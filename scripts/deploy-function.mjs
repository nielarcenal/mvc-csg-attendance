#!/usr/bin/env node
// Deploy an edge function via the Supabase Management API (no CLI needed).
// Usage: SUPABASE_PROJECT_REF=... SUPABASE_ACCESS_TOKEN=... node scripts/deploy-function.mjs <slug>
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const slug = process.argv[2];
if (!REF || !TOKEN || !slug) {
  console.error('need SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN and a function slug');
  process.exit(1);
}

const auth = { Authorization: `Bearer ${TOKEN}` };

// Preserve the existing verify_jwt setting if the function is already deployed.
let verifyJwt = false;
const listRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions`, { headers: auth });
if (listRes.ok) {
  const existing = (await listRes.json()).find((f) => f.slug === slug);
  if (existing) verifyJwt = existing.verify_jwt ?? false;
}

const source = readFileSync(join(ROOT, 'supabase', 'functions', slug, 'index.ts'), 'utf8');
const form = new FormData();
form.append('metadata', JSON.stringify({
  name: slug, entrypoint_path: 'index.ts', verify_jwt: verifyJwt,
}));
form.append('file', new Blob([source], { type: 'text/typescript' }), 'index.ts');

const res = await fetch(
  `https://api.supabase.com/v1/projects/${REF}/functions/deploy?slug=${slug}`,
  { method: 'POST', headers: auth, body: form },
);
const body = await res.text();
if (!res.ok) { console.error(`deploy failed ${res.status}: ${body}`); process.exit(1); }
const fn = JSON.parse(body);
console.log(`deployed ${fn.slug ?? slug} (version ${fn.version}, verify_jwt=${fn.verify_jwt})`);
