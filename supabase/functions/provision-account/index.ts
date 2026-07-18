// provision-account — account operations for checkers/makers/students.
// Runs with the service key server-side (spec §6: never in a client).
// Caller must be an authenticated event_maker or super_admin.
//
// POST body:
//   action: 'create' (default)
//     { first_name, middle_name?, last_name, email,
//       role: 'student'|'checker'|'event_maker',
//       mode: 'invite'|'temp_password',
//       student_no?, school_id?, course?, year_level?, section? }  // student role
//     (legacy callers may still send full_name — the DB trigger splits it)
//   action: 'reset_password'  { email } → { temp_password }
//   action: 'resend_invite'   { email }
//   action: 'set_active'      { email, active: boolean }  (soft delete/restore)
//   action: 'list_users'      {} → { users: [{ id, email, last_sign_in_at }] }
// Returns: { id?, email, temp_password? }

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
  const action = body?.action ?? 'create';

  // A8: last-login column — service role reads auth.users.last_sign_in_at.
  if (action === 'list_users') {
    const out: { id: string; email?: string; last_sign_in_at?: string }[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 500 });
      if (error) return json(400, { error: error.message });
      out.push(...data.users.map((u) => ({
        id: u.id, email: u.email, last_sign_in_at: u.last_sign_in_at,
      })));
      if (data.users.length < 500) break;
    }
    return json(200, { users: out });
  }

  if (!body?.email) return json(400, { error: 'email is required' });

  // Non-create actions operate on an existing profile.
  if (action !== 'create') {
    const { data: target } = await admin
      .from('profiles').select('id').eq('email', body.email).single();
    if (!target) return json(404, { error: 'no account with that email' });

    if (action === 'reset_password') {
      const temp = tempPassword();
      const { error } = await admin.auth.admin.updateUserById(target.id, { password: temp });
      if (error) return json(400, { error: error.message });
      await admin.from('profiles')
        .update({ account_status: 'never_logged_in' }).eq('id', target.id);
      return json(200, { email: body.email, temp_password: temp });
    }
    if (action === 'resend_invite') {
      // Existing confirmed users get a recovery link instead of an invite.
      const { error } = await admin.auth.admin.generateLink({
        type: 'recovery', email: body.email,
      });
      if (error) return json(400, { error: error.message });
      const { error: resetErr } = await admin.auth.resetPasswordForEmail(body.email);
      if (resetErr) return json(400, { error: resetErr.message });
      return json(200, { email: body.email });
    }
    if (action === 'set_active') {
      const { error } = await admin.from('profiles')
        .update({ active: body.active === true }).eq('id', target.id);
      if (error) return json(400, { error: error.message });
      return json(200, { email: body.email });
    }
    return json(400, { error: 'unknown action' });
  }

  // Name parts (A1); tolerate legacy full_name-only callers.
  const first = (body.first_name ?? '').trim();
  const middle = (body.middle_name ?? '').trim() || null;
  const last = (body.last_name ?? '').trim();
  const displayName = first && last
    ? [first, middle ? `${middle[0]}.` : null, last].filter(Boolean).join(' ')
    : (body.full_name ?? '').trim();
  if (!displayName || !body?.role) {
    return json(400, { error: 'first_name + last_name (or full_name), email and role are required' });
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
  // Send parts when we have them; otherwise full_name (the DB trigger splits).
  const nameCols = first && last
    ? { first_name: first, middle_name: middle, last_name: last }
    : { full_name: displayName };

  if (body.mode === 'invite') {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, {
      data: { full_name: displayName },
    });
    if (error) return json(400, { error: error.message });
    userId = data.user.id;
  } else {
    temp = tempPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: body.email,
      password: temp,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    });
    if (error) return json(400, { error: error.message });
    userId = data.user.id;
  }

  const { error: profErr } = await admin.from('profiles').upsert({
    id: userId,
    role: body.role,
    ...nameCols,
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
        ...nameCols,
        email: body.email,
        // omit when absent so an upsert never nulls out a required school
        ...(body.school_id ? { school_id: body.school_id } : {}),
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
