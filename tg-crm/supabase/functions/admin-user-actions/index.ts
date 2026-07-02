import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Client scoped to the caller's own JWT -- used only to identify who is calling.
  const callerClient = createClient(url, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: 'Invalid session' }, 401);
  const callerId = userData.user.id;

  // Admin client for everything else -- never exposed to the browser.
  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerEmployee, error: callerError } = await adminClient
    .from('employees')
    .select('id, role, is_active')
    .eq('id', callerId)
    .single();

  if (callerError || !callerEmployee || !callerEmployee.is_active) {
    return json({ error: 'Caller is not a recognized active employee' }, 403);
  }
  const callerRole = callerEmployee.role as string;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const action = body.action as string;

  try {
    if (action === 'create') {
      const { name, phone, email, password, role, parent_id, is_active } = body as {
        name: string; phone: string; email: string; password: string;
        role: 'employee' | 'manager' | 'admin'; parent_id: string | null; is_active: boolean;
      };

      if (callerRole === 'admin') {
        // Admins can create any role.
      } else if (callerRole === 'manager') {
        if (role !== 'employee' || parent_id !== callerId) {
          return json({ error: 'Managers may only create technicians under themselves' }, 403);
        }
      } else {
        return json({ error: 'Not authorized to create accounts' }, 403);
      }

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (authError) return json({ error: authError.message }, 400);
      const newUserId = authData.user?.id;
      if (!newUserId) return json({ error: 'Could not create auth user' }, 500);

      const { error: dbError } = await adminClient.from('employees').insert({
        id: newUserId, name, phone, email, role,
        parent_id: role === 'employee' ? (parent_id || null) : null,
        is_active: is_active ?? true,
      });
      if (dbError) {
        await adminClient.auth.admin.deleteUser(newUserId);
        return json({ error: dbError.message }, 400);
      }

      return json({ ok: true, userId: newUserId });
    }

    if (action === 'reset_password') {
      if (callerRole !== 'admin') return json({ error: 'Only admins can reset passwords' }, 403);
      const { target_id, password } = body as { target_id: string; password: string };
      const { error } = await adminClient.auth.admin.updateUserById(target_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'delete') {
      if (callerRole !== 'admin') return json({ error: 'Only admins can delete employees' }, 403);
      const { target_id } = body as { target_id: string };
      await adminClient.from('employees').delete().eq('id', target_id);
      const { error } = await adminClient.auth.admin.deleteUser(target_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
