// provision-account — creates login accounts for checkers/makers/students.
// Runs with the service key server-side (spec §6: never in a client).
// Caller must be an authenticated event_maker or super_admin.
//
// POST body:
//   { full_name, email, role: 'student'|'checker'|'event_maker',
//     mode: 'invite'|'temp_password',
//     student_no?, course?, year_level?, section? }   // student role only
// Returns: { id, email, temp_password? }

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

function tempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return 'Mvc-' + Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Authenticate the caller from their JWT, then check role.
  const auth = req.headers.get('Authorization') ?? '';
  const { data: caller } = await admin.auth.getUser(auth.replace('Bearer ', ''));
  if (!caller?.user) return json(401, { error: 'not signed in' });

  const { data: prof } = await admin
    .from('profiles').select('role').eq('id', caller.user.id).single();
  if (!prof || !['super_admin', 'event_maker'].includes(prof.role)) {
    return json(403, { error: 'only event makers and super-admins can provision accounts' });
  }

  const body = await req.json().catch(() => null);
  if (!body?.full_name || !body?.email || !body?.role) {
    return json(400, { error: 'full_name, email and role are required' });
  }
  if (!['student', 'checker', 'event_maker'].includes(body.role)) {
    return json(400, { error: 'invalid role' });
  }
  if (body.role === 'event_maker' && prof.role !== 'super_admin') {
    return json(403, { error: 'only super-admins can create event makers' });
  }

  // Create the auth user — invite email or temp password.
  let userId: string;
  let temp: string | undefined;
  if (body.mode === 'invite') {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, {
      data: { full_name: body.full_name },
    });
    if (error) return json(400, { error: error.message });
    userId = data.user.id;
  } else {
    temp = tempPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: body.email,
      password: temp,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    });
    if (error) return json(400, { error: error.message });
    userId = data.user.id;
  }

  const { error: profErr } = await admin.from('profiles').upsert({
    id: userId,
    role: body.role,
    full_name: body.full_name,
    email: body.email,
    account_status: body.mode === 'invite' ? 'invited' : 'never_logged_in',
    invited_by: caller.user.id,
  });
  if (profErr) return json(500, { error: profErr.message });

  // Student role → link (or create) the roster record.
  if (body.role === 'student' && body.student_no) {
    const { error: stuErr } = await admin.from('students').upsert(
      {
        student_no: body.student_no,
        full_name: body.full_name,
        email: body.email,
        course: body.course ?? null,
        year_level: body.year_level ?? null,
        section: body.section ?? null,
        profile_id: userId,
      },
      { onConflict: 'student_no' },
    );
    if (stuErr) return json(500, { error: stuErr.message });
  }

  return json(200, { id: userId, email: body.email, temp_password: temp });
});
